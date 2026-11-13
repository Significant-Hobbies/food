export const CATALOG_SORTS = [
  { key: "protein_density", label: "Protein / 100 kcal" },
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "fat", label: "Fat" },
  { key: "fibre", label: "Fibre" },
  { key: "calories", label: "Calories" },
  { key: "name", label: "Product name" },
  { key: "completeness", label: "Record completeness" },
] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number]["key"];
export type SortOrder = "asc" | "desc";
export function isCatalogSort(value: string): value is CatalogSort {
  return CATALOG_SORTS.some((sort) => sort.key === value);
}
export function defaultSortOrder(sort: string): SortOrder {
  return sort === "name" ? "asc" : "desc";
}
export function nextSortOrder(current: string, order: SortOrder, next: CatalogSort): SortOrder {
  return current === next ? (order === "asc" ? "desc" : "asc") : defaultSortOrder(next);
}
