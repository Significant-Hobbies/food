import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Recipes } from "../src/Recipes";
import { defaultRecipeFilters, filterRecipes, recipeDensity, recipes } from "../shared/recipes";

describe("source-linked recipe collection", () => {
  it("retains the full curated collection and publisher serving boundaries", () => {
    expect(recipes).toHaveLength(50);
    expect(new Set(recipes.map((recipe) => recipe.publisher)).size).toBe(14);
    for (const recipe of recipes) {
      expect(new URL(recipe.url).protocol).toBe("https:");
      expect(recipe.nutrition.servingBasis).toBeTruthy();
      expect(recipe.nutrition.sourceNote).toBeTruthy();
      expect(recipeDensity(recipe)).toBeGreaterThanOrEqual(10);
    }
  });
  it("combines search, dietary, availability and ingredient exclusions", () => {
    const found = filterRecipes(recipes, { ...defaultRecipeFilters, query: "tofu", dietary: "vegan", indiaFit: "easy", excludedIngredients: ["protein-powder"] });
    expect(found.some((recipe) => recipe.id === "easy-tofu-scramble")).toBe(true);
    expect(found.every((recipe) => recipe.dietary === "vegan" && recipe.indiaFit === "easy")).toBe(true);
    expect(filterRecipes(recipes, { ...defaultRecipeFilters, query: "tofu", excludedIngredients: ["soy"] })).toEqual([]);
  });
  it("sorts by comparable ratios and leaves unknown or zero-calorie values unranked", () => {
    const sample = recipes[0]!;
    const missing = { ...sample, id: "missing", nutrition: { ...sample.nutrition, calories: null } };
    expect(recipeDensity(missing)).toBeNull();
    expect(recipeDensity({ ...missing, nutrition: { ...missing.nutrition, calories: 0 } })).toBeNull();
    const sorted = filterRecipes([...recipes, missing], { ...defaultRecipeFilters, sort: "protein-density" });
    expect(sorted.at(-1)?.id).toBe("missing");
    expect(recipeDensity(sorted[0]!)).toBeGreaterThanOrEqual(recipeDensity(sorted[1]!)!);
    expect(filterRecipes(recipes, { ...defaultRecipeFilters, query: "not-a-real-recipe" })).toEqual([]);
  });
  it("renders source links, serving bases, estimates and usable filters", () => {
    const html = renderToStaticMarkup(createElement(Recipes));
    expect(html.match(/class="recipe-card"/g)).toHaveLength(50);
    expect(html).toContain("publisher estimates");
    expect(html).toContain("Read the original recipe");
    expect(html).toContain("recipe-india");
    expect(html).toContain(recipes[0]!.url);
    expect(html).toContain("publisher-stated");
  });
});
