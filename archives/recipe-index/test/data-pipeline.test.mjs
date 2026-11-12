import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { estimateNutrition, extractCreatorTotals, extractIngredients } from '../src/data-pipeline.mjs';

const reference = JSON.parse(await readFile(new URL('../public/data/nutrition-reference.json', import.meta.url), 'utf8'));

test('retains ingredients containing the word protein', () => {
  const description = `
👨‍🍳 Egg-Free Super Fluffy Pancakes
½ cup (140 g) soy yogurt
⅓ cup (80 ml) soy milk
1 cup (160 g) high protein pizza flour (12% protein)
1 Tbsp (8.5 g) baking powder
1 Tbsp (15 ml) maple syrup
.
Protein Content Total: 30.44 g plant-based protein
`;
  const ingredients = extractIngredients(description);
  assert.equal(ingredients.length, 5);
  assert.ok(ingredients.some((ingredient) => ingredient.sourceText.includes('high protein pizza flour')));
});

test('continues across dot-separated ingredient subsections', () => {
  const description = `
👨‍🍳 Protein Tiramisu Breakfast Recipe
¼ cup (50 g) chickpeas cooked or from a can
3 Medjool dates
2 Tbsp (15 g) cocoa powder
¼ cup (60 ml) coffee
1 cup (240 ml) plant-based milk
.
⅔ cup (64 g) rolled oats
.
1 cup (240 ml) plant-based yogurt
.
Protein Content Total: 39.32 g plant-based protein
`;
  const ingredients = extractIngredients(description);
  assert.equal(ingredients.length, 7);
  assert.ok(ingredients.some((ingredient) => ingredient.name.includes('oats')));
  assert.ok(ingredients.some((ingredient) => ingredient.name.includes('yogurt')));
});

test('captures explicit creator calorie totals', () => {
  const totals = extractCreatorTotals('57 g Protein Smoothie', `
Protein Content Total: 57.7 g plant-based protein
Total Calories: 676 kcal (keep in mind: 100% whole foods)
`);
  assert.equal(totals.find((result) => result.kind === 'protein')?.value, 57.7);
  assert.equal(totals.find((result) => result.kind === 'calories')?.value, 676);
});

test('uses creator totals together even when the ingredient estimate is partial', () => {
  const video = {
    ingredients: extractIngredients(`
👨‍🍳 Smoothie Recipe
1 cup (240 g) black beans
1 cup mystery yogurt
.
Protein Content Total: 40 g plant-based protein
Total Calories: 500 kcal
`),
    results: extractCreatorTotals('', 'Protein Content Total: 40 g plant-based protein\nTotal Calories: 500 kcal'),
  };
  const nutrition = estimateNutrition(video, reference);
  assert.equal(nutrition.status, 'partial');
  assert.equal(nutrition.ratios.proteinPer100Calories, 8);
  assert.equal(nutrition.ratios.basis, 'creator-totals');
});

test('withholds density when creator protein is paired with partial estimated calories', () => {
  const video = {
    ingredients: extractIngredients(`
👨‍🍳 Smoothie Recipe
1 cup (240 g) black beans
1 cup mystery yogurt
.
Protein Content Total: 40 g plant-based protein
`),
    results: extractCreatorTotals('', 'Protein Content Total: 40 g plant-based protein'),
  };
  const nutrition = estimateNutrition(video, reference);
  assert.equal(nutrition.status, 'partial');
  assert.equal(nutrition.ratios, null);
});

test('ignores water mentioned inside a material ingredient description', () => {
  const video = {
    ingredients: extractIngredients(`
👨‍🍳 Smoothie Recipe
2 cups (480 ml) plant-based milk (water, soy beans, nothing else)
.
Protein Content Total: 17 g plant-based protein
`),
    results: extractCreatorTotals('', 'Protein Content Total: 17 g plant-based protein'),
  };
  const nutrition = estimateNutrition(video, reference);
  assert.equal(nutrition.matchedLineCount, 1);
  assert.equal(nutrition.status, 'complete');
});
