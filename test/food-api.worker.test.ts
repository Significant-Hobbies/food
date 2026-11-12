import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Recipe } from "../shared/recipes";

const worker = exports.default;

describe("Food public data interfaces", () => {
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
