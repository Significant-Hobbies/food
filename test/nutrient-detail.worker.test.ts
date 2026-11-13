import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { getProductDetail } from "../worker/catalog";

const at = "2026-07-17T00:00:00.000Z";

it("bounds actual product-detail nutrient reads and preserves evidence through the index migration", async () => {
  // Keep all real migrations and triggers active while seeding 10,000 nutrients.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sources
      (id, name, kind, identity_authority, nutrition_authority, ingredient_authority,
       retention_notes, created_at)
      VALUES ('nutrient-open', 'Nutrient fixture', 'open_data', 20, 20, 20, 'Synthetic fixture', ?),
        ('nutrient-official', 'Official fixture', 'official', 100, 100, 100, 'Synthetic fixture', ?),
        ('nutrient-weak', 'Weak fixture', 'official', 99, 99, 99, 'Synthetic fixture', ?)`)
      .bind(at, at, at),
    env.DB.prepare(`INSERT INTO ingestion_runs
      (id, source_id, adapter_version, mode, input_identifier, status, started_at)
      VALUES ('nutrient-run', 'nutrient-open', 'fixture', 'sample', 'synthetic', 'completed', ?)`)
      .bind(at),
    env.DB.prepare(`WITH RECURSIVE numbers(n) AS (
      SELECT 0 UNION ALL SELECT n + 1 FROM numbers WHERE n < 999
    ) INSERT INTO products
      (id, brand, brand_normalized, name, name_normalized, category,
       classifier_version, created_at, updated_at)
      SELECT 'nutrient-' || n, 'Fixture', 'fixture', 'Nutrient ' || n, 'nutrient ' || n,
        'other', 'fixture', ?, ? FROM numbers`).bind(at, at),
    env.DB.prepare(`INSERT INTO source_records
      (id, source_id, source_record_id, product_id, source_url, content_hash,
       observed_at, first_seen_run_id, last_seen_run_id, raw_evidence_json)
      SELECT id, CASE WHEN id IN ('nutrient-1', 'nutrient-3', 'nutrient-4') THEN 'nutrient-official'
        WHEN id = 'nutrient-2' THEN 'nutrient-weak' ELSE 'nutrient-open' END,
        id, id, 'https://example.invalid/' || id, ?,
        CASE WHEN id = 'nutrient-3' THEN '2026-07-16T00:00:00.000Z' ELSE ? END,
        'nutrient-run', 'nutrient-run', '{}' FROM products WHERE id GLOB 'nutrient-*'`)
      .bind("a".repeat(64), at),
    env.DB.prepare(`INSERT INTO source_records
      (id, source_id, source_record_id, product_id, source_url, content_hash,
       observed_at, first_seen_run_id, last_seen_run_id, raw_evidence_json)
      VALUES ('nutrient-other', 'nutrient-official', 'nutrient-other', 'nutrient-4',
        'https://example.invalid/other', ?, ?, 'nutrient-run', 'nutrient-run', '{}')`)
      .bind("b".repeat(64), at),
    env.DB.prepare(`INSERT INTO nutrition_facts
      (product_id, source_record_id, status, confidence, authority, basis,
       preparation_state, calories, protein_grams, observed_at, updated_at)
      SELECT id, id, 'verified', 'high', 100, 'per_100g', 'as_sold', 300, 20, ?, ?
      FROM products WHERE id IN ('nutrient-0', 'nutrient-1', 'nutrient-2', 'nutrient-3', 'nutrient-4')`)
      .bind(at, at),
    env.DB.prepare(`WITH RECURSIVE codes(n) AS (
      SELECT 0 UNION ALL SELECT n + 1 FROM codes WHERE n < 9
    ) INSERT INTO nutrient_values
      (id, product_id, source_record_id, nutrient_code, quantity, unit, basis,
       preparation_state, status, observed_at)
      SELECT p.id || '-' || codes.n, p.id,
        CASE WHEN p.id = 'nutrient-4' AND codes.n = 0 THEN 'nutrient-other' ELSE p.id END,
        'nutrient_' || codes.n, codes.n + 0.5, 'g', 'per_100g', 'as_sold',
        CASE WHEN p.id = 'nutrient-5' AND codes.n = 0 THEN 'conflict'
          WHEN p.id IN ('nutrient-0', 'nutrient-1', 'nutrient-2', 'nutrient-3', 'nutrient-4')
          THEN 'verified' ELSE 'unverified' END, ?
      FROM products p CROSS JOIN codes WHERE p.id GLOB 'nutrient-*'`).bind(at),
  ]);
  expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM nutrient_values WHERE product_id GLOB 'nutrient-*'")
    .first()).toEqual({ count: 10000 });

  // Observe native results from the real catalog batch, without replacing its SQL.
  const queries: string[] = [];
  let nutrientRowsRead = -1;
  const observedDb = new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare") return (query: string) => {
        queries.push(query);
        return target.prepare(query);
      };
      if (key === "batch") return async (statements: D1PreparedStatement[]) => {
        const results = await target.batch(statements);
        const nutrientIndex = queries.findIndex((query) => query.includes("FROM nutrient_values nutrient"));
        expect(nutrientIndex).toBeGreaterThanOrEqual(0);
        nutrientRowsRead = results[nutrientIndex]!.meta.rows_read;
        return results;
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  async function detail(id: string) {
    queries.length = 0;
    const output = await getProductDetail(observedDb, id);
    expect(nutrientRowsRead).toBeGreaterThanOrEqual(0);
    return { output, rowsRead: nutrientRowsRead };
  }

  const cases = [
    ["nutrient-0", ["unverified"]], // Community authority cannot verify.
    ["nutrient-1", ["verified"]],
    ["nutrient-2", ["unverified"]], // Official source below required authority.
    ["nutrient-3", ["unverified"]], // Stale source observation.
    ["nutrient-4", ["unverified", "verified"]], // A different source cannot borrow trust.
    ["nutrient-5", ["conflict", "unverified"]],
    ["nutrient-999", ["unverified"]],
    ["nutrient-missing", []],
  ] as const;
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === "0025_nutrient_product_lookup.sql");
  expect(migration).toBeDefined();
  await env.DB.prepare("DROP INDEX idx_nutrient_values_product_code").run();
  try {
    const before = [];
    for (const [id, statuses] of cases) {
      const result = await detail(id);
      expect(result.rowsRead).toBeGreaterThanOrEqual(10000);
      if (id === "nutrient-missing") expect(result.output).toBeNull();
      else {
        expect(result.output?.nutrients).toHaveLength(10);
        expect([...new Set(result.output?.nutrients.map(({ status }) => status))].sort()).toEqual(statuses);
        expect(result.output?.nutrients.map(({ code, quantity, unit, basis, observedAt }) =>
          ({ code, quantity, unit, basis, observedAt }))).toEqual(Array.from({ length: 10 }, (_, n) => ({
            code: `nutrient_${n}`, quantity: n + 0.5, unit: "g", basis: "per_100g", observedAt: at,
          })));
      }
      before.push(result.output);
    }
    await env.DB.batch(migration!.queries.map((query) => env.DB.prepare(query)));
    // Re-applying the append-only migration must also be safe.
    await env.DB.batch(migration!.queries.map((query) => env.DB.prepare(query)));
    for (const [index, [id]] of cases.entries()) {
      const result = await detail(id);
      expect(result.output).toEqual(before[index]);
      // Trust views add reads for authoritative sources; unrelated nutrients must not.
      expect(result.rowsRead, id).toBeLessThanOrEqual(200);
      // D1 can count one cursor read beyond the selected product range.
      if (id === "nutrient-999") expect(result.rowsRead).toBeLessThanOrEqual(11);
      if (id === "nutrient-missing") expect(result.rowsRead).toBeLessThanOrEqual(1);
    }
    expect(await env.DB.prepare("PRAGMA index_list(nutrient_values)")
      .all<{ name: string; unique: number }>()).toMatchObject({ results: expect.arrayContaining([
        expect.objectContaining({ name: "idx_nutrient_values_product_code", unique: 0 }),
      ]) });
    expect(await env.DB.prepare("PRAGMA index_info(idx_nutrient_values_product_code)")
      .all<{ name: string }>()).toMatchObject({ results: [{ name: "product_id" }, { name: "nutrient_code" }] });
  } finally {
    await env.DB.batch(migration!.queries.map((query) => env.DB.prepare(query)));
  }
});
