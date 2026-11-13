import { describe, expect, it } from "vitest";
import { nextSortOrder, isCatalogSort } from "../shared/catalog-sort";
describe("comparison sort interactions", () => {
  it("starts a different nutrient high-first and toggles the active column", () => {
    expect(nextSortOrder("protein_density", "desc", "protein")).toBe("desc");
    expect(nextSortOrder("protein", "desc", "protein")).toBe("asc");
    expect(nextSortOrder("protein", "asc", "protein")).toBe("desc");
    expect(nextSortOrder("protein", "asc", "name")).toBe("asc");
    expect(isCatalogSort("cost")).toBe(false);
  });
});
