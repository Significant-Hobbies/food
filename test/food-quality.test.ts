import { describe, expect, it } from "vitest";
import { normalizeOpenFoodFactsRecord } from "../scripts/adapters/open-food-facts";
import mismatchedLabels from "../data/fixtures/source-label-mismatches.json";

const record = {
  code: "3017620422003", product_name: "Nutrition boundary fixture", brands: "Fixture",
  quantity: "100 g", nutriments: { "energy-kcal_100g": 400, proteins_100g: 20, carbohydrates_100g: 50, fat_100g: 13 },
};

describe("Open Food Facts output quality", () => {
  it("withholds exact source-label mismatches without promoting a visual review to verified data", () => {
    for (const source of mismatchedLabels) {
      const result = normalizeOpenFoodFactsRecord(source);
      expect(result.staged?.nutrition.status).toBe("conflict");
      expect(result.staged?.nutrition.labelVerifiedAt).toBeNull();
      expect(result.issues.some((issue) => issue.code === "source_label_visual_mismatch")).toBe(true);
      const changed = normalizeOpenFoodFactsRecord({ ...source, last_modified_t: Number(source.last_modified_t) + 1 });
      expect(changed.issues.some((issue) => issue.code === "source_label_visual_mismatch")).toBe(false);
    }
  });
  it("excludes source-marked obsolete products without inventing a current replacement", () => {
    const result = normalizeOpenFoodFactsRecord({ ...record, obsolete: true });
    expect(result.staged).toBeNull();
    expect(result.issues[0]?.code).toBe("obsolete_source_record");
  });
  it("withholds nutrition that Open Food Facts itself marks as erroneous", () => {
    const result = normalizeOpenFoodFactsRecord({ ...record, data_quality_errors_tags: ["en:nutrition-proteins-greater-than-100"] });
    expect(result.staged?.nutrition.status).toBe("conflict");
    expect(result.issues.some((issue) => issue.code === "source_nutrition_error")).toBe(true);
    expect(result.staged?.rawEvidence.data_quality_errors_tags).toEqual(["en:nutrition-proteins-greater-than-100"]);
  });
  it("uses an explicit kJ conversion only when kcal is absent", () => {
    const result = normalizeOpenFoodFactsRecord({ ...record, nutriments: { "energy-kj_100g": 1673.6, proteins_100g: 20 } });
    expect(result.staged?.nutrition.per100g.calories).toBeCloseTo(400);
    expect(result.issues.some((issue) => issue.code === "calories_derived_from_kj")).toBe(true);
    const zero = normalizeOpenFoodFactsRecord({ ...record, nutriments: { "energy-kcal_100g": 0, "energy-kj_100g": 1673.6 } });
    expect(zero.staged?.nutrition.per100g.calories).toBe(0);
  });
  it("keeps volume quantities separate and never promotes community data to verified", () => {
    const result = normalizeOpenFoodFactsRecord({ ...record, quantity: "500 ml", serving_size: "250 ml", nutrition_data_per: "100ml" });
    expect(result.staged?.nutrition.basis).toBe("per_100ml");
    expect(result.staged?.netQuantityGrams).toBeNull();
    expect(result.staged?.servingSizeGrams).toBeNull();
    expect(result.staged?.nutrition.status).toBe("unverified");
    expect(result.staged?.nutrition.labelVerifiedAt).toBeNull();
    const missing = normalizeOpenFoodFactsRecord({ ...record, nutriments: {} });
    expect(missing.staged?.nutrition.per100g.proteinGrams).toBeNull();
    expect(missing.staged?.nutrition.per100g.calories).toBeNull();
  });
});
