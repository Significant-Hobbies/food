import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyRecipeFilters,
  getCalorieDisplay,
  getDietaryTags,
  getFormatOptions,
  getIndiaFitOptions,
  getIngredientFilterOptions,
  getProteinDensity,
  getProteinDisplay,
  getProteinSourceLabel,
  getProteinSourceOptions,
  getVisibleRecipes,
  sortRecipes,
  summarizeSnapshot,
} from '../src/recipe-model.mjs';

const snapshot = JSON.parse(await readFile(new URL('../public/data/curated-recipes.json', import.meta.url), 'utf8'));
const recipes = getVisibleRecipes(snapshot);

test('contains the intended 50-item food-first collection', () => {
  assert.equal(recipes.length, 50);
  assert.deepEqual(summarizeSnapshot(snapshot), {
    inventory: 50,
    recipes: 50,
    foods: 45,
    drinks: 5,
    vegan: 27,
    easyIndia: 13,
    publishers: 14,
    formats: {
      component: 13,
      breakfast: 2,
      meal: 11,
      bread: 3,
      bar: 2,
      dessert: 14,
      drink: 5,
    },
  });
});

test('enforces both protein admission gates on every recipe', () => {
  for (const recipe of recipes) {
    assert.ok(getProteinDisplay(recipe).value >= 10, recipe.id);
    assert.ok(getCalorieDisplay(recipe).value > 0, recipe.id);
    assert.ok(getProteinDensity(recipe) >= 10, recipe.id);
    assert.ok(['vegan', 'vegetarian'].includes(recipe.dietary), recipe.id);
    assert.ok(recipe.proteinSources.length > 0, recipe.id);
    assert.doesNotMatch(recipe.ingredients.join(' ').toLowerCase(), /\begg(s)?\b/, recipe.id);
  }
});

test('keeps publisher credit and a direct source on every recipe', () => {
  for (const recipe of recipes) {
    assert.ok(recipe.publisher.length > 2, recipe.id);
    const source = new URL(recipe.url);
    assert.ok(['http:', 'https:'].includes(source.protocol), recipe.id);
    assert.ok(['blog', 'youtube'].includes(recipe.sourceType), recipe.id);
    assert.ok(recipe.nutrition.servingBasis, recipe.id);
    assert.ok(recipe.nutrition.sourceNote, recipe.id);
  }
});

test('puts every food before all drinks in curated order', () => {
  const sorted = sortRecipes(recipes, 'curated');
  const firstDrink = sorted.findIndex((recipe) => recipe.format === 'drink');
  assert.equal(firstDrink, 45);
  assert.ok(sorted.slice(0, firstDrink).every((recipe) => recipe.format !== 'drink'));
  assert.ok(sorted.slice(firstDrink).every((recipe) => recipe.format === 'drink'));
});

test('searches recipe, publisher, ingredient, and practicality text', () => {
  assert.ok(applyRecipeFilters(recipes, { query: 'tofu' }).length >= 8);
  assert.ok(applyRecipeFilters(recipes, { query: 'protein chef' }).length >= 10);
  assert.ok(applyRecipeFilters(recipes, { query: 'curry, seitan' }).every((recipe) => recipe.id === 'seitan-curry'));
});

test('provides dataset-backed ingredient exclusions', () => {
  const options = getIngredientFilterOptions(recipes);
  const soy = options.find((option) => option.value === 'soy-tofu');
  const powder = options.find((option) => option.value === 'protein-powder');
  assert.ok(soy?.count >= 10);
  assert.ok(powder?.count >= 10);
  assert.ok(options.every((option) => option.count > 0));
});

test('removes recipes matching any selected ingredient family', () => {
  const filtered = applyRecipeFilters(recipes, { excludedIngredients: ['protein-powder', 'soy-tofu'] });
  assert.ok(filtered.length < recipes.length / 2);
  assert.ok(filtered.every((recipe) => {
    const ingredients = recipe.ingredients.join(' ').toLowerCase();
    return !ingredients.includes('protein powder')
      && !ingredients.includes('soy')
      && !ingredients.includes('soya')
      && !ingredients.includes('tofu')
      && !ingredients.includes('tvp');
  }));
});

test('combines format, India-fit, and dietary filters', () => {
  const filtered = applyRecipeFilters(recipes, {
    format: 'meal',
    indiaFit: 'easy',
    dietary: 'vegetarian',
    proteinSource: 'dairy-food',
  });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((recipe) => recipe.format === 'meal'));
  assert.ok(filtered.every((recipe) => recipe.indiaFit === 'easy'));
  assert.ok(filtered.every((recipe) => recipe.dietary === 'vegetarian'));
  assert.ok(filtered.every((recipe) => recipe.proteinSources.includes('dairy-food')));
});

test('exposes and applies every dataset-backed protein source', () => {
  const options = getProteinSourceOptions(recipes);
  assert.deepEqual(options.map((option) => option.value), [
    'soy-tofu-tvp',
    'tempeh',
    'seitan-gluten',
    'whey-powder',
    'vegan-powder',
    'dairy-food',
    'legumes',
  ]);
  assert.equal(getProteinSourceLabel('soy-tofu-tvp'), 'Soy / tofu / TVP');
  for (const option of options) {
    const filtered = applyRecipeFilters(recipes, { proteinSource: option.value });
    assert.equal(filtered.length, option.count);
    assert.ok(filtered.every((recipe) => recipe.proteinSources.includes(option.value)));
  }
});

test('exposes format, India fit, and dietary choices from the data', () => {
  assert.deepEqual(getDietaryTags(recipes), ['vegan', 'vegetarian']);
  assert.deepEqual(new Set(getFormatOptions(recipes).map((option) => option.value)), new Set(['meal', 'component', 'bread', 'breakfast', 'bar', 'dessert', 'drink']));
  assert.deepEqual(new Set(getIndiaFitOptions(recipes).map((option) => option.value)), new Set(['easy', 'adaptable', 'specialty']));
});

test('sorts all ledger metrics in both directions', () => {
  assert.ok(getProteinDisplay(sortRecipes(recipes, 'protein')[0]).value
    > getProteinDisplay(sortRecipes(recipes, 'protein-asc')[0]).value);
  assert.ok(getCalorieDisplay(sortRecipes(recipes, 'calories')[0]).value
    < getCalorieDisplay(sortRecipes(recipes, 'calories-desc')[0]).value);
  assert.ok(getProteinDensity(sortRecipes(recipes, 'protein-density')[0])
    > getProteinDensity(sortRecipes(recipes, 'protein-density-asc')[0]));
  assert.ok(sortRecipes(recipes, 'title')[0].title.localeCompare(sortRecipes(recipes, 'title-desc')[0].title) < 0);
});
