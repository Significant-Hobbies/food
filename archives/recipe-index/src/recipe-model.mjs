const DEFAULT_FILTERS = Object.freeze({
  query: '',
  excludedIngredients: [],
  dietary: 'all',
  format: 'all',
  proteinSource: 'all',
  indiaFit: 'all',
  sort: 'curated',
});

const INGREDIENT_FILTERS = Object.freeze([
  { value: 'banana', label: 'Banana', terms: ['banana'] },
  { value: 'berries', label: 'Berries', terms: ['strawberr', 'blueberr', 'berries'] },
  { value: 'chickpea', label: 'Chickpeas', terms: ['chickpea'] },
  { value: 'chocolate', label: 'Chocolate / cocoa', terms: ['chocolate', 'cocoa'] },
  { value: 'dairy', label: 'Dairy', terms: ['milk', 'yogurt', 'cottage cheese', 'mozzarella'] },
  { value: 'edamame', label: 'Edamame', terms: ['edamame'] },
  { value: 'gluten', label: 'Wheat / gluten', terms: ['wheat', 'flour', 'bread', 'seitan', 'bagel', 'wrap'] },
  { value: 'mushroom', label: 'Mushrooms', terms: ['mushroom'] },
  { value: 'oats', label: 'Oats', terms: ['oat'] },
  { value: 'peanut', label: 'Peanuts / peanut butter', terms: ['peanut'] },
  { value: 'protein-powder', label: 'Protein powder', terms: ['protein powder'] },
  { value: 'seitan', label: 'Seitan / vital wheat gluten', terms: ['seitan', 'vital wheat gluten'] },
  { value: 'sesame', label: 'Sesame / tahini', terms: ['sesame', 'tahini'] },
  { value: 'soy-tofu', label: 'Soy / tofu / TVP', terms: ['soy', 'soya', 'tofu', 'tvp'] },
]);

const PROTEIN_SOURCE_LABELS = Object.freeze({
  'soy-tofu-tvp': 'Soy / tofu / TVP',
  tempeh: 'Tempeh',
  'seitan-gluten': 'Seitan / wheat gluten',
  'whey-powder': 'Whey / dairy protein powder',
  'vegan-powder': 'Vegan protein powder',
  'dairy-food': 'Cottage cheese / yogurt',
  legumes: 'Beans / chickpeas',
});

export function getVisibleRecipes(snapshot) {
  const recipes = snapshot?.recipes ?? snapshot?.videos ?? [];
  if (!Array.isArray(recipes)) return [];
  return recipes.filter((recipe) => Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0);
}

export function getProteinDisplay(recipe) {
  const value = recipe?.nutrition?.protein?.value ?? recipe?.nutrition?.protein;
  return {
    value: Number.isFinite(value) ? value : null,
    source: Number.isFinite(value) ? 'publisher-stated' : 'unavailable',
    qualifier: recipe?.nutrition?.proteinQualifier ?? '',
    sourceText: recipe?.nutrition?.sourceNote ?? '',
  };
}

export function getCalorieDisplay(recipe) {
  const value = recipe?.nutrition?.calories?.value ?? recipe?.nutrition?.calories;
  return {
    value: Number.isFinite(value) ? value : null,
    source: Number.isFinite(value) ? 'publisher-stated' : 'unavailable',
    qualifier: recipe?.nutrition?.calorieQualifier ?? '',
    sourceText: recipe?.nutrition?.sourceNote ?? '',
  };
}

export function getProteinDensity(recipe) {
  const protein = getProteinDisplay(recipe).value;
  const calories = getCalorieDisplay(recipe).value;
  return Number.isFinite(protein) && Number.isFinite(calories) && calories > 0
    ? Math.round((protein / calories) * 1000) / 10
    : null;
}

export function getDietaryTags(recipes) {
  return [...new Set(recipes.map((recipe) => recipe.dietary).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function getFormatOptions(recipes) {
  return countOptions(recipes, 'format');
}

export function getIndiaFitOptions(recipes) {
  return countOptions(recipes, 'indiaFit');
}

export function getProteinSourceOptions(recipes) {
  return Object.entries(PROTEIN_SOURCE_LABELS).map(([value, label]) => ({
    value,
    label,
    count: recipes.filter((recipe) => recipe.proteinSources?.includes(value)).length,
  })).filter((option) => option.count > 0);
}

export function getProteinSourceLabel(value) {
  return PROTEIN_SOURCE_LABELS[value] ?? humanizeValue(value);
}

export function getIngredientFilterOptions(recipes) {
  return INGREDIENT_FILTERS.map((filter) => ({
    value: filter.value,
    label: filter.label,
    count: recipes.filter((recipe) => recipeMatchesIngredientFilter(recipe, filter)).length,
  })).filter((filter) => filter.count > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function normalizeFilters(filters = {}) {
  return { ...DEFAULT_FILTERS, ...filters };
}

export function applyRecipeFilters(recipes, inputFilters = {}) {
  const filters = normalizeFilters(inputFilters);
  const terms = queryTerms(filters.query);
  const exclusions = ingredientFiltersFor(filters.excludedIngredients);
  const filtered = recipes.filter((recipe) => {
    if (terms.length && terms.some((term) => !recipeSearchText(recipe).includes(term))) return false;
    if (exclusions.some((filter) => recipeMatchesIngredientFilter(recipe, filter))) return false;
    if (filters.dietary !== 'all' && recipe.dietary !== filters.dietary) return false;
    if (filters.format !== 'all' && recipe.format !== filters.format) return false;
    if (filters.proteinSource !== 'all' && !recipe.proteinSources?.includes(filters.proteinSource)) return false;
    if (filters.indiaFit !== 'all' && recipe.indiaFit !== filters.indiaFit) return false;
    return true;
  });
  return sortRecipes(filtered, filters.sort);
}

export function sortRecipes(recipes, sort = 'curated') {
  const indexed = recipes.map((recipe, index) => ({ recipe, index }));
  indexed.sort((left, right) => compareRecipe(left.recipe, right.recipe, sort) || left.index - right.index);
  return indexed.map(({ recipe }) => recipe);
}

export function summarizeSnapshot(snapshot) {
  const recipes = getVisibleRecipes(snapshot);
  const formats = countOptions(recipes, 'format');
  return {
    inventory: snapshot?.counts?.inventory ?? recipes.length,
    recipes: recipes.length,
    foods: recipes.filter((recipe) => recipe.format !== 'drink').length,
    drinks: recipes.filter((recipe) => recipe.format === 'drink').length,
    vegan: recipes.filter((recipe) => recipe.dietary === 'vegan').length,
    easyIndia: recipes.filter((recipe) => recipe.indiaFit === 'easy').length,
    publishers: new Set(recipes.map((recipe) => recipe.publisher)).size,
    formats: Object.fromEntries(formats.map((option) => [option.value, option.count])),
  };
}

export function recipeSearchText(recipe) {
  return normalizeText([
    recipe.title,
    recipe.publisher,
    recipe.format,
    recipe.indiaFit,
    recipe.indiaFitNote,
    ...(recipe.proteinSources ?? []).map(getProteinSourceLabel),
    recipeIngredientText(recipe),
  ].filter(Boolean).join(' '));
}

export function recipeIngredientText(recipe) {
  return normalizeText((recipe.ingredients ?? []).map((ingredient) => (
    typeof ingredient === 'string' ? ingredient : [ingredient.name, ingredient.sourceText].filter(Boolean).join(' ')
  )).join(' '));
}

function countOptions(recipes, key) {
  const counts = new Map();
  for (const recipe of recipes) {
    const value = recipe[key];
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

function queryTerms(value) {
  return [...new Set(String(value ?? '').split(',').map(normalizeText).filter(Boolean))];
}

function ingredientFiltersFor(values) {
  const selected = new Set(Array.isArray(values) ? values : [values].filter(Boolean));
  return INGREDIENT_FILTERS.filter((filter) => selected.has(filter.value));
}

function recipeMatchesIngredientFilter(recipe, filter) {
  const ingredients = recipeIngredientText(recipe);
  return filter.terms.some((term) => ingredients.includes(term));
}

function compareRecipe(left, right, sort) {
  if (sort === 'title') return titleFor(left).localeCompare(titleFor(right));
  if (sort === 'title-desc') return titleFor(right).localeCompare(titleFor(left));
  if (sort === 'protein') return compareNumberDesc(getProteinDisplay(left).value, getProteinDisplay(right).value);
  if (sort === 'protein-asc') return compareNumberAsc(getProteinDisplay(left).value, getProteinDisplay(right).value);
  if (sort === 'calories') return compareNumberAsc(getCalorieDisplay(left).value, getCalorieDisplay(right).value);
  if (sort === 'calories-desc') return compareNumberDesc(getCalorieDisplay(left).value, getCalorieDisplay(right).value);
  if (sort === 'protein-density') return compareNumberDesc(getProteinDensity(left), getProteinDensity(right));
  if (sort === 'protein-density-asc') return compareNumberAsc(getProteinDensity(left), getProteinDensity(right));
  return compareNumberAsc(left.defaultRank, right.defaultRank);
}

function compareNumberAsc(left, right) {
  const leftMissing = !Number.isFinite(left);
  const rightMissing = !Number.isFinite(right);
  if (leftMissing || rightMissing) return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1;
  return left - right;
}

function compareNumberDesc(left, right) {
  return compareNumberAsc(right, left);
}

function titleFor(recipe) {
  return String(recipe.title || 'Untitled recipe');
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFKD').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function humanizeValue(value) {
  return String(value ?? '').replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
