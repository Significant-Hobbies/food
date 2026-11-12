import snapshot from "../data/recipes.json";

export interface Recipe {
  id: string;
  title: string;
  publisher: string;
  url: string;
  format: string;
  indiaFit: string;
  indiaFitNote: string;
  dietary: string;
  proteinSources: string[];
  ingredients: string[];
  nutrition: {
    protein: number | null;
    calories: number | null;
    servingBasis: string;
    sourceNote: string;
    proteinQualifier?: string;
    calorieQualifier?: string;
  };
  defaultRank: number;
}

export const recipes: Recipe[] = snapshot.recipes;
export const recipeCollectedAt = snapshot.collectedAt;
export const proteinSources: Record<string, string> = {
  "soy-tofu-tvp": "Soy, tofu & TVP",
  tempeh: "Tempeh",
  "seitan-gluten": "Seitan & wheat gluten",
  "whey-powder": "Whey protein",
  "vegan-powder": "Plant protein powder",
  "dairy-food": "Paneer, cheese & yogurt",
  legumes: "Beans & chickpeas",
};

export const ingredientExclusions: Record<string, { label: string; terms: string[] }> = {
  dairy: { label: "Dairy", terms: ["milk", "yogurt", "yoghurt", "cheese", "paneer", "whey", "curd", "butter"] },
  "protein-powder": { label: "Protein powder", terms: ["protein powder", "protein isolate"] },
  soy: { label: "Soy & tofu", terms: ["soy", "soya", "tofu", "tvp", "tempeh"] },
  gluten: { label: "Wheat & gluten", terms: ["wheat", "flour", "bread", "seitan", "bagel", "wrap"] },
  peanut: { label: "Peanuts", terms: ["peanut"] },
  mushroom: { label: "Mushrooms", terms: ["mushroom"] },
};

export interface RecipeFilters {
  query: string;
  dietary: string;
  format: string;
  proteinSource: string;
  indiaFit: string;
  excludedIngredients: string[];
  sort: string;
}

export const defaultRecipeFilters: RecipeFilters = {
  query: "", dietary: "all", format: "all", proteinSource: "all", indiaFit: "all",
  excludedIngredients: [], sort: "curated",
};

function normalize(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function recipeDensity(recipe: Recipe): number | null {
  const { protein, calories } = recipe.nutrition;
  return protein !== null && calories !== null && Number.isFinite(protein) && Number.isFinite(calories) && calories > 0
    ? Math.round(protein / calories * 1000) / 10 : null;
}

export function filterRecipes(items: Recipe[], filters: RecipeFilters): Recipe[] {
  const terms = normalize(filters.query).split(",").map((term) => term.trim()).filter(Boolean);
  const result = items.filter((recipe) => {
    const ingredients = normalize(recipe.ingredients.join(" "));
    const text = normalize([recipe.title, recipe.publisher, ingredients, recipe.indiaFitNote,
      ...recipe.proteinSources.map((source) => proteinSources[source] ?? source)].join(" "));
    if (terms.some((term) => !text.includes(term))) return false;
    if (filters.dietary !== "all" && recipe.dietary !== filters.dietary) return false;
    if (filters.format !== "all" && recipe.format !== filters.format) return false;
    if (filters.proteinSource !== "all" && !recipe.proteinSources.includes(filters.proteinSource)) return false;
    if (filters.indiaFit !== "all" && recipe.indiaFit !== filters.indiaFit) return false;
    return !filters.excludedIngredients.some((key) => ingredientExclusions[key]?.terms.some((term) => ingredients.includes(term)));
  });
  const numberCompare = (left: number | null, right: number | null, ascending = false) => {
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    return ascending ? left - right : right - left;
  };
  return result.sort((left, right) => {
    const order = filters.sort === "protein-density" ? numberCompare(recipeDensity(left), recipeDensity(right))
      : filters.sort === "protein" ? numberCompare(left.nutrition.protein, right.nutrition.protein)
      : filters.sort === "calories" ? numberCompare(left.nutrition.calories, right.nutrition.calories, true)
      : filters.sort === "title" ? left.title.localeCompare(right.title)
      : left.defaultRank - right.defaultRank;
    return order || left.defaultRank - right.defaultRank;
  });
}
