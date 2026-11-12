import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  getCalorieDisplay,
  getProteinDensity,
  getProteinDisplay,
  getVisibleRecipes,
  sortRecipes,
  summarizeSnapshot,
} from '../src/recipe-model.mjs';

const root = new URL('../', import.meta.url);
const requiredFiles = [
  'src/pages/index.astro',
  'styles.css',
  'app.js',
  'astro.config.mjs',
  'src/recipe-model.mjs',
  'public/data/curated-recipes.json',
  'PRODUCT.md',
  'DESIGN.md',
];

for (const file of requiredFiles) {
  const content = await readFile(new URL(file, root), 'utf8');
  assert.ok(content.length > 0, `${file} must not be empty`);
}

const snapshot = JSON.parse(await readFile(new URL('public/data/curated-recipes.json', root), 'utf8'));
const recipes = getVisibleRecipes(snapshot);
const summary = summarizeSnapshot(snapshot);
const validProteinSources = new Set([
  'soy-tofu-tvp',
  'tempeh',
  'seitan-gluten',
  'whey-powder',
  'vegan-powder',
  'dairy-food',
  'legumes',
]);

assert.equal(snapshot.schemaVersion, 2, 'curated collection schema changed');
assert.ok(recipes.length >= 50, 'collection must contain at least 50 recipes');
assert.equal(summary.foods, recipes.length - 5, 'all expansion recipes must be food');
assert.equal(summary.drinks, 5, 'collection must contain exactly five drinks');
assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, recipes.length, 'recipe ids must be unique');
assert.equal(new Set(recipes.map((recipe) => recipe.defaultRank)).size, recipes.length, 'curated ranks must be unique');

for (const recipe of recipes) {
  assert.ok(getProteinDisplay(recipe).value >= 10, `${recipe.id} fails total protein gate`);
  assert.ok(getCalorieDisplay(recipe).value > 0, `${recipe.id} lacks published calories`);
  assert.ok(getProteinDensity(recipe) >= 10, `${recipe.id} fails protein-density gate`);
  assert.ok(recipe.publisher, `${recipe.id} lacks publisher credit`);
  assert.ok(recipe.nutrition?.servingBasis, `${recipe.id} lacks a serving basis`);
  assert.ok(recipe.indiaFitNote, `${recipe.id} lacks India-fit guidance`);
  assert.ok(recipe.proteinSources?.length > 0, `${recipe.id} lacks protein-source metadata`);
  assert.ok(recipe.proteinSources.every((source) => validProteinSources.has(source)), `${recipe.id} uses an unknown protein source`);
  const source = new URL(recipe.url);
  assert.ok(['http:', 'https:'].includes(source.protocol), `${recipe.id} must use a direct web source`);
}

const curated = sortRecipes(recipes, 'curated');
const firstDrink = curated.findIndex((recipe) => recipe.format === 'drink');
assert.equal(firstDrink, summary.foods, 'all food must lead curated order');
assert.ok(curated.slice(firstDrink).every((recipe) => recipe.format === 'drink'), 'drinks must remain at the end');

const runtimeFiles = ['src/pages/index.astro', 'styles.css', 'app.js', 'astro.config.mjs', 'src/recipe-model.mjs', 'package.json'];
const prohibited = [
  /fleet console/i,
  /google search/i,
  /ai awareness/i,
  /domains dashboard/i,
  /\/foundry\//i,
];
for (const file of runtimeFiles) {
  const content = await readFile(new URL(file, root), 'utf8');
  for (const pattern of prohibited) assert.doesNotMatch(content, pattern, `${file} contains prohibited product coupling`);
}

const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
assert.deepEqual(Object.keys(manifest.dependencies ?? {}), ['astro'], 'Astro must remain the only direct production dependency');
assert.equal(manifest.devDependencies, undefined, 'development dependencies require explicit approval');

console.log(`Recipe Index check passed: ${recipes.length} qualified recipes, ${summary.foods} foods, 5 drinks, all source-linked.`);
