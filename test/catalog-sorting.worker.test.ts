import { env, exports } from "cloudflare:workers";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { catalogPageQuery, validateSearch } from "../worker/catalog";
import type { CatalogResponse } from "../shared/api";

const worker = exports.default;
const ids = ["sort_alpha", "sort_beta", "sort_tie", "sort_zero", "sort_conflict", "sort_missing"];
const names = ["Alpha", "Beta", "Beta", "Zero", "Conflict", "Missing"];
beforeAll(async () => {
  for (const [index, id] of ids.entries()) {
    await env.DB.prepare(`INSERT INTO products (id, brand, brand_normalized, name, name_normalized, category, classifier_version, created_at, updated_at)
      VALUES (?, 'Sort fixture', 'sort fixture', ?, ?, 'other', 'fixture', '2026-11-13', '2026-11-13')`)
      .bind(id, `Sort boundary ${names[index]}`, `sort boundary ${names[index]?.toLowerCase()}`).run();
    if (id === "sort_missing") continue;
    const protein = id === "sort_alpha" ? 20 : id === "sort_zero" ? 0 : id === "sort_conflict" ? 100 : 10;
    const factor = protein / 10;
    await env.DB.prepare(`INSERT INTO nutrition_facts (product_id, status, confidence, authority, basis, preparation_state, calories, protein_grams, carbohydrate_grams, fat_grams, fibre_grams, observed_at, updated_at)
      VALUES (?, ?, 'low', 40, ?, 'as_sold', ?, ?, ?, ?, ?, '2026-11-13', '2026-11-13')`)
      .bind(id, id === "sort_conflict" ? "conflict" : "unverified", id === "sort_tie" ? "per_100ml" : "per_100g", protein * 10, protein, protein, factor * 2, factor).run();
  }
});
afterAll(async () => {
  for (const id of ids) await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
});
async function catalog(params: string): Promise<CatalogResponse> {
  const response = await worker.fetch(`http://localhost/api/products?q=sort%20boundary&scope=all&${params}`);
  expect(response.status).toBe(200);
  return response.json() as Promise<CatalogResponse>;
}
describe("global catalog sorting", () => {
  it.each([["protein_density", "idx_products_active_density"], ["name", "idx_products_active_name"], ["completeness", "idx_products_active_completeness"]])("keeps the default %s page covered by its index", async (sort, index) => {
    const input = validateSearch(new URLSearchParams({ sort })).value!;
    const query = catalogPageQuery(input);
    const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).bind(...query.bindings).all<{ detail: string }>();
    const details = plan.results.map((row) => row.detail).join("\n");
    expect(details).toContain(`COVERING INDEX ${index}`);
    expect(details).not.toContain("TEMP B-TREE");
  });
  it("places serving and unknown bases last without treating them as per-100 amounts", async () => {
    const cases = [["basis_known", "per_100g", 10], ["basis_serving", "per_serving", 90], ["basis_unknown", "unknown", 99]] as const;
    try {
      for (const [id, basis, protein] of cases) {
        await env.DB.prepare(`INSERT INTO products (id, brand, brand_normalized, name, name_normalized, category, classifier_version, created_at, updated_at)
          VALUES (?, 'Basis fixture', 'basis fixture', ?, ?, 'other', 'fixture', '2026-11-13', '2026-11-13')`).bind(id, id, `basis comparison ${id}`).run();
        await env.DB.prepare(`INSERT INTO nutrition_facts (product_id, status, confidence, authority, basis, preparation_state, calories, protein_grams, observed_at, updated_at)
          VALUES (?, 'unverified', 'low', 40, ?, 'as_sold', 400, ?, '2026-11-13', '2026-11-13')`).bind(id, basis, protein).run();
      }
      for (const order of ["asc", "desc"]) {
        const r = await worker.fetch(`http://localhost/api/products?q=basis%20comparison&scope=all&sort=protein&order=${order}`);
        const body = await r.json() as CatalogResponse;
        expect(body.products.map((row) => row.id)).toEqual(["basis_known", "basis_serving", "basis_unknown"]);
        expect(body.products.find((row) => row.id === "basis_serving")?.nutrition.basis).toBe("per_serving");
      }
    } finally {
      for (const [id] of cases) await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    }
  });

  it.each(["protein", "carbs", "fat", "fibre", "calories"])("sorts %s across pages in both directions, with zero valid and conflicts/missing last", async (sort) => {
    for (const order of ["asc", "desc"]) {
      const pages = await Promise.all([1, 2, 3].map((page) => catalog(`sort=${sort}&order=${order}&pageSize=2&page=${page}`)));
      const rows = pages.flatMap((page) => page.products);
      expect(rows.map((row) => row.id)).toEqual(order === "asc"
        ? ["sort_zero", "sort_beta", "sort_tie", "sort_alpha", "sort_conflict", "sort_missing"]
        : ["sort_alpha", "sort_beta", "sort_tie", "sort_zero", "sort_conflict", "sort_missing"]);
      expect(new Set(rows.map((row) => row.id)).size).toBe(6);
      expect(rows.find((row) => row.id === "sort_tie")?.nutrition.basis).toBe("per_100ml");
      expect(rows.find((row) => row.id === "sort_zero")?.nutrition.proteinGrams).toBe(0);
      expect(rows.find((row) => row.id === "sort_conflict")?.metrics.proteinPer100Calories.value).toBeNull();
      expect(pages.every((page) => page.pagination.total === 6)).toBe(true);
    }
  });
  it("supports reversing product-name order and keeps legacy defaults", async () => {
    expect((await catalog("sort=name&order=desc&pageSize=10")).products.map((row) => row.id))
      .toEqual(["sort_zero", "sort_missing", "sort_conflict", "sort_beta", "sort_tie", "sort_alpha"]);
    const old = await catalog("sort=name&pageSize=10");
    expect(old.products[0]?.id).toBe("sort_alpha");
    expect(old.filters.order).toBe("asc");
  });
  it.each(["sort=calories&order=invalid", "sort=cost", "sort=protein%3BDROP%20TABLE%20products", "sort=name&order=desc%3BDELETE"])("rejects invalid sort input %s", async (params) => {
    expect((await worker.fetch(`http://localhost/api/products?${params}`)).status).toBe(400);
  });
});
