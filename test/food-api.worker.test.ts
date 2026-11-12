import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Recipe } from "../shared/recipes";

const worker = exports.default;

describe("Food public data interfaces", () => {
  it("distinguishes quarantined nutrition from absent nutrition without projecting invalid values", async () => {
    const id = "food-quarantine-fixture";
    await env.DB.prepare(`INSERT INTO products (id, brand, brand_normalized, name, name_normalized, category, classifier_version, created_at, updated_at)
      VALUES (?, 'Food fixture', 'food fixture', 'Quarantine boundary fixture', 'quarantine boundary fixture', 'other', 'fixture', '2026-11-12T00:00:00Z', '2026-11-12T00:00:00Z')`).bind(id).run();
    const detail = async () => (await (await worker.fetch(`http://localhost/api/products/${id}`)).json()) as { nutritionStatus: string; metrics: { proteinPer100Calories: { value: number | null } }; nutrition: { calories: number | null; proteinGrams: number | null } };
    try {
      await env.DB.prepare(`INSERT INTO review_items (id, type, priority, status, product_id, candidate_product_ids_json, evidence_json, created_at)
        VALUES ('food-quarantine-review', 'nutrition_validation', 80, 'open', ?, '[]', ?, '2026-11-12T00:00:00Z')`).bind(id, JSON.stringify({ code: "source_label_visual_mismatch", severity: "warning" })).run();
      expect((await detail()).nutritionStatus).toBe("missing");
      await env.DB.prepare("UPDATE review_items SET evidence_json = ? WHERE id = 'food-quarantine-review'").bind(JSON.stringify({ code: "source_label_visual_mismatch", severity: "error" })).run();
      const quarantined = await detail();
      expect(quarantined.nutritionStatus).toBe("conflict");
      expect(quarantined.nutrition.calories).toBeNull();
      expect(quarantined.nutrition.proteinGrams).toBeNull();
      expect(quarantined.metrics.proteinPer100Calories.value).toBeNull();
      const search = await (await worker.fetch("http://localhost/api/products?q=quarantine%20boundary&scope=all&verification=conflict")).json() as { products: Array<{ id: string; nutritionStatus: string }> };
      expect(search.products).toEqual(expect.arrayContaining([expect.objectContaining({ id, nutritionStatus: "conflict" })]));
      await env.DB.prepare("UPDATE review_items SET status = 'dismissed' WHERE id = 'food-quarantine-review'").run();
      expect((await detail()).nutritionStatus).toBe("missing");
      await env.DB.prepare("UPDATE review_items SET status = 'open', evidence_json = 'invalid JSON' WHERE id = 'food-quarantine-review'").run();
      expect((await detail()).nutritionStatus).toBe("missing");
    } finally {
      await env.DB.prepare("DELETE FROM review_items WHERE id = 'food-quarantine-review'").run();
      await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    }
  });

  it("offers the same source-linked recipe filters as the app", async () => {
    const response = await worker.fetch("http://localhost/api/recipes?q=tofu&dietary=vegan&indiaFit=easy&sort=protein-density");
    expect(response.status).toBe(200);
    const body = await response.json() as { recipes: Recipe[]; collectionTotal: number; nutritionAuthority: string; nutritionBasis: string };
    expect(body.collectionTotal).toBe(50);
    expect(body.recipes.some((recipe) => recipe.id === "easy-tofu-scramble")).toBe(true);
    expect(body.recipes.every((recipe) => recipe.dietary === "vegan" && recipe.indiaFit === "easy")).toBe(true);
    expect(body.nutritionAuthority).toBe("publisher_stated_estimate");
    expect(body.nutritionBasis).toBe("per_stated_recipe_serving");
    expect(body.recipes[0]?.nutrition.servingBasis).toBeTruthy();
    const excluded = await worker.fetch("http://localhost/api/recipes?q=tofu&exclude=soy");
    expect((await excluded.json() as { recipes: Recipe[] }).recipes).toEqual([]);
  });
  it("keeps quality accounting and source identity available without pretending it is verification", async () => {
    const response = await worker.fetch("http://localhost/api/data-quality");
    expect(response.status).toBe(200);
    const body = await response.json() as { stagedRecords: number; excludedRecords: number; indiaRecords: number; sourceSha256: string; limitations: string[] };
    expect(body.stagedRecords + body.excludedRecords).toBe(body.indiaRecords);
    expect(body.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(body.limitations.join(" ")).toContain("not independently verified");
  });
  it("bounds recipe queries and does not add production write routes", async () => {
    expect((await worker.fetch(`http://localhost/api/recipes?q=${"x".repeat(201)}`)).status).toBe(400);
    expect((await worker.fetch("http://localhost/api/recipes?dietary=unknown")).status).toBe(400);
    expect((await worker.fetch("https://food.significanthobbies.com/api/recipes", { method: "POST", body: "{}" })).status).toBe(404);
    expect((await worker.fetch("https://food.significanthobbies.com/api/products/example/identity-evidence", { method: "POST", body: "{}" })).status).toBe(403);
  });
});
