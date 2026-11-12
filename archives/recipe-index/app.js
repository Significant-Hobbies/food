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
  summarizeSnapshot,
} from './src/recipe-model.mjs';

const elements = {
  controls: document.querySelector('#recipe-controls'),
  search: document.querySelector('#search-input'),
  ingredientExclusion: document.querySelector('#ingredient-exclusion-select'),
  ingredientExclusionList: document.querySelector('#ingredient-exclusion-list'),
  dietary: document.querySelector('#dietary-filter'),
  format: document.querySelector('#format-filter'),
  proteinSource: document.querySelector('#protein-source-filter'),
  indiaFit: document.querySelector('#india-fit-filter'),
  sort: document.querySelector('#sort-filter'),
  reset: document.querySelector('#reset-controls'),
  emptyReset: document.querySelector('#empty-reset'),
  retry: document.querySelector('#retry-load'),
  mobileFilterToggle: document.querySelector('#mobile-filter-toggle'),
  secondaryControls: document.querySelector('#secondary-controls'),
  list: document.querySelector('#recipe-list'),
  loading: document.querySelector('#loading-state'),
  empty: document.querySelector('#empty-state'),
  error: document.querySelector('#error-state'),
  resultCount: document.querySelector('#result-count'),
  sortButtons: [...document.querySelectorAll('[data-ledger-sort]')],
};

let recipes = [];
let ingredientOptions = [];
const excludedIngredients = new Set();

const SORT_CYCLES = Object.freeze({
  title: ['title', 'title-desc'],
  protein: ['protein', 'protein-asc'],
  calories: ['calories', 'calories-desc'],
  'protein-density': ['protein-density', 'protein-density-asc'],
});

const FORMAT_ORDER = ['meal', 'component', 'bread', 'breakfast', 'bar', 'dessert', 'drink'];
const INDIA_FIT_ORDER = ['easy', 'adaptable', 'specialty'];

initialize();

async function initialize() {
  bindControls();
  try {
    const response = await fetch('/data/curated-recipes.json');
    if (!response.ok) throw new Error(`Recipe collection returned ${response.status}`);
    const snapshot = await response.json();
    recipes = getVisibleRecipes(snapshot);
    ingredientOptions = getIngredientFilterOptions(recipes);
    populateIngredientOptions(ingredientOptions);
    populateSimpleOptions(elements.dietary, getDietaryTags(recipes).map((value) => ({ value })));
    populateSimpleOptions(elements.format, orderOptions(getFormatOptions(recipes), FORMAT_ORDER), true);
    populateSimpleOptions(elements.proteinSource, getProteinSourceOptions(recipes), true);
    populateSimpleOptions(elements.indiaFit, orderOptions(getIndiaFitOptions(recipes), INDIA_FIT_ORDER), true);
    renderCoverage(snapshot);
    elements.loading.hidden = true;
    renderRecipes();
  } catch {
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.resultCount.textContent = 'Unable to load recipes';
  }
}

function bindControls() {
  elements.controls.addEventListener('input', (event) => {
    if (event.target !== elements.ingredientExclusion) renderRecipes();
  });
  elements.ingredientExclusion.addEventListener('change', addIngredientExclusion);
  for (const button of elements.sortButtons) button.addEventListener('click', sortFromLedgerHeading);
  elements.reset.addEventListener('click', resetControls);
  elements.emptyReset.addEventListener('click', resetControls);
  elements.retry.addEventListener('click', () => window.location.reload());
  elements.mobileFilterToggle.addEventListener('click', toggleMobileFilters);
}

function resetControls() {
  elements.controls.reset();
  excludedIngredients.clear();
  renderIngredientExclusions();
  closeMobileFilters();
  renderRecipes();
  elements.search.focus();
}

function toggleMobileFilters() {
  const willOpen = !elements.secondaryControls.classList.contains('secondary-controls--open');
  elements.secondaryControls.classList.toggle('secondary-controls--open', willOpen);
  elements.mobileFilterToggle.setAttribute('aria-expanded', String(willOpen));
  elements.mobileFilterToggle.lastElementChild.textContent = willOpen ? '−' : '+';
}

function closeMobileFilters() {
  elements.secondaryControls.classList.remove('secondary-controls--open');
  elements.mobileFilterToggle.setAttribute('aria-expanded', 'false');
  elements.mobileFilterToggle.lastElementChild.textContent = '+';
}

function activeFilters() {
  return {
    query: elements.search.value,
    excludedIngredients: [...excludedIngredients],
    dietary: elements.dietary.value,
    format: elements.format.value,
    proteinSource: elements.proteinSource.value,
    indiaFit: elements.indiaFit.value,
    sort: elements.sort.value,
  };
}

function populateIngredientOptions(options) {
  for (const ingredient of options) {
    const option = document.createElement('option');
    option.value = ingredient.value;
    option.textContent = `${ingredient.label} (${ingredient.count})`;
    elements.ingredientExclusion.append(option);
  }
}

function populateSimpleOptions(select, options, showCount = false) {
  for (const item of options) {
    const option = document.createElement('option');
    option.value = item.value;
    const label = item.label ?? humanize(item.value);
    option.textContent = showCount && Number.isFinite(item.count)
      ? `${label} (${item.count})`
      : label;
    select.append(option);
  }
}

function orderOptions(options, order) {
  return [...options].sort((left, right) => order.indexOf(left.value) - order.indexOf(right.value));
}

function addIngredientExclusion() {
  const value = elements.ingredientExclusion.value;
  if (!value) return;
  excludedIngredients.add(value);
  elements.ingredientExclusion.value = '';
  renderIngredientExclusions();
  renderRecipes();
}

function renderIngredientExclusions() {
  elements.ingredientExclusionList.replaceChildren();
  for (const option of ingredientOptions) {
    const selectOption = elements.ingredientExclusion.querySelector(`option[value="${option.value}"]`);
    if (selectOption) selectOption.disabled = excludedIngredients.has(option.value);
    if (!excludedIngredients.has(option.value)) continue;
    const remove = element('button', 'ingredient-exclusion', `${option.label} ×`);
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${option.label} exclusion`);
    remove.addEventListener('click', () => {
      excludedIngredients.delete(option.value);
      renderIngredientExclusions();
      renderRecipes();
    });
    elements.ingredientExclusionList.append(remove);
  }
  elements.ingredientExclusionList.hidden = excludedIngredients.size === 0;
}

function sortFromLedgerHeading(event) {
  const base = event.currentTarget.dataset.ledgerSort;
  const cycle = SORT_CYCLES[base];
  if (!cycle) return;
  elements.sort.value = elements.sort.value === cycle[0] ? cycle[1] : cycle[0];
  renderRecipes();
}

function renderCoverage(snapshot) {
  const summary = summarizeSnapshot(snapshot);
  setText('#hero-count', summary.recipes);
  setText('#coverage-recipes', summary.recipes);
  setText('#coverage-foods', summary.foods);
  setText('#coverage-drinks', summary.drinks);
  setText('#coverage-publishers', summary.publishers);
  setText('#coverage-india', summary.easyIndia);
  const collected = new Date(snapshot.collectedAt);
  setText('#snapshot-date', Number.isNaN(collected.valueOf())
    ? 'Local snapshot'
    : new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(collected));
}

function renderRecipes() {
  if (!recipes.length) return;
  const filtered = applyRecipeFilters(recipes, activeFilters());
  elements.list.replaceChildren(...filtered.map(createRecipeRow));
  elements.empty.hidden = filtered.length !== 0;
  const drinkCount = filtered.filter((recipe) => recipe.format === 'drink').length;
  const foodCount = filtered.length - drinkCount;
  elements.resultCount.textContent = filtered.length
    ? `${filtered.length} shown · ${foodCount} food · ${drinkCount} drink${drinkCount === 1 ? '' : 's'}`
    : '0 recipes shown';
  updateSortHeadings();
}

function updateSortHeadings() {
  for (const button of elements.sortButtons) {
    const cycle = SORT_CYCLES[button.dataset.ledgerSort];
    const activeIndex = cycle.indexOf(elements.sort.value);
    const active = activeIndex !== -1;
    button.dataset.active = String(active);
    button.setAttribute('aria-pressed', String(active));
    button.querySelector('[data-sort-indicator]').textContent = active
      ? sortArrow(button.dataset.ledgerSort, activeIndex)
      : '↕';
  }
}

function sortArrow(base, activeIndex) {
  const primaryAscending = base === 'title' || base === 'calories';
  const ascending = activeIndex === 0 ? primaryAscending : !primaryAscending;
  return ascending ? '↑' : '↓';
}

function createRecipeRow(recipe) {
  const article = element('article', `recipe-row${recipe.format === 'drink' ? ' recipe-row--drink' : ''}`);
  const row = element('div', 'recipe-row__summary');
  const protein = getProteinDisplay(recipe);
  const calories = getCalorieDisplay(recipe);
  const density = getProteinDensity(recipe);

  row.append(
    createIdentity(recipe),
    createMetric('Protein', protein.value, 'g', 'Published / serving', protein.qualifier),
    createMetric('Calories', calories.value, '', 'Published / serving', calories.qualifier),
    createMetric('P / 100', density, 'g', recipe.nutrition?.densityQualifier === '>=' ? 'At least' : 'Derived', recipe.nutrition?.densityQualifier === '>=' ? '≥' : ''),
    createIndiaFit(recipe),
  );

  const actions = element('div', 'recipe-actions');
  const detailId = `evidence-${recipe.id}`;
  const detailButton = element('button', 'detail-button', 'Details');
  detailButton.type = 'button';
  detailButton.setAttribute('aria-expanded', 'false');
  detailButton.setAttribute('aria-controls', detailId);
  const source = element('a', 'watch-link', recipe.sourceType === 'youtube' ? 'Video ↗' : 'Recipe ↗');
  source.href = recipe.url;
  source.target = '_blank';
  source.rel = 'noreferrer';
  source.setAttribute('aria-label', `Open ${recipe.title} from ${recipe.publisher}`);
  actions.append(detailButton, source);
  row.append(actions);

  const evidence = element('div', 'evidence-sheet');
  evidence.id = detailId;
  evidence.hidden = true;
  detailButton.addEventListener('click', () => {
    const willOpen = evidence.hidden;
    if (willOpen && !evidence.hasChildNodes()) evidence.append(createEvidence(recipe, protein, calories, density));
    evidence.hidden = !willOpen;
    article.classList.toggle('recipe-row--open', willOpen);
    detailButton.textContent = willOpen ? 'Close' : 'Details';
    detailButton.setAttribute('aria-expanded', String(willOpen));
  });

  article.append(row, evidence);
  return article;
}

function createIdentity(recipe) {
  const identity = element('div', 'recipe-identity');
  const sourceLine = element('p', 'recipe-date', `${recipe.publisher} · ${humanize(recipe.sourceType)}`);
  const heading = element('h3', 'recipe-title', recipe.title);
  const tagList = element('div', 'tag-list');
  tagList.append(element('span', 'recipe-tag recipe-tag--protein', getProteinSourceLabel(recipe.proteinSources?.[0])));
  for (const label of [recipe.format, recipe.dietary, recipe.format === 'drink' ? 'drink' : 'food']) {
    tagList.append(element('span', 'recipe-tag', humanize(label)));
  }
  identity.append(sourceLine, heading, tagList);
  return identity;
}

function createMetric(label, value, unit, note, qualifier = '') {
  const metric = element('div', 'metric');
  metric.append(
    element('span', 'metric__label', label),
    element('strong', 'metric__value', Number.isFinite(value) ? `${qualifier}${formatNumber(value)}${unit}` : '—'),
    element('small', 'metric__note', note),
  );
  return metric;
}

function createIndiaFit(recipe) {
  const fit = element('div', `coverage coverage--${recipe.indiaFit}`);
  fit.append(
    element('span', 'metric__label', 'India fit'),
    element('strong', 'coverage__value', humanize(recipe.indiaFit)),
    element('small', 'coverage__status', recipe.indiaFit === 'easy' ? 'Common ingredients' : recipe.indiaFit === 'adaptable' ? 'Some substitutions' : 'Specialist items'),
  );
  return fit;
}

function createEvidence(recipe, protein, calories, density) {
  const wrap = element('div', 'evidence-grid');
  wrap.append(
    evidenceIngredients(recipe),
    evidenceNutrition(recipe, protein, calories, density),
    evidenceSource(recipe),
  );
  return wrap;
}

function evidenceIngredients(recipe) {
  const section = evidenceSection('Key ingredients', `${recipe.ingredients.length} source ingredients indexed`);
  const list = element('ul', 'ingredient-list');
  for (const ingredient of recipe.ingredients) list.append(element('li', '', ingredient));
  section.append(list);
  return section;
}

function evidenceNutrition(recipe, protein, calories, density) {
  const section = evidenceSection('Published macros', recipe.nutrition.servingBasis);
  const facts = element('dl', 'evidence-facts');
  addFact(facts, 'Protein', `${protein.qualifier}${formatNumber(protein.value)} g`);
  addFact(facts, 'Calories', `${calories.qualifier}${formatNumber(calories.value)} kcal`);
  addFact(facts, 'Protein / 100 kcal', `${recipe.nutrition.densityQualifier === '>=' ? '≥' : ''}${formatNumber(density)} g`);
  addFact(facts, 'Protein strategy', recipe.proteinSources.map(getProteinSourceLabel).join(' + '));
  addFact(facts, 'Admission bar', '≥10 g total and ≥10 g / 100 kcal');
  section.append(facts, element('p', 'match-note', recipe.nutrition.sourceNote));
  return section;
}

function evidenceSource(recipe) {
  const section = evidenceSection('Practicality', `India fit: ${humanize(recipe.indiaFit)}`);
  section.append(element('p', 'match-note', recipe.indiaFitNote));
  const provenance = element('p', 'provenance');
  provenance.append('Credit: ', externalLink(recipe.publisher, recipe.url), `. Macros are the publisher's serving values; substitutions can change them.`);
  section.append(provenance);
  return section;
}

function evidenceSection(title, subtitle) {
  const section = element('section', 'evidence-section');
  section.append(element('h4', '', title), element('p', 'evidence-subtitle', subtitle));
  return section;
}

function addFact(list, term, description) {
  list.append(element('dt', '', term), element('dd', '', description));
}

function externalLink(label, href) {
  const link = element('a', '', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer';
  return link;
}

function element(tagName, className = '', text = '') {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function setText(selector, value) {
  const target = document.querySelector(selector);
  if (target) target.textContent = String(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}

function humanize(value) {
  return String(value ?? '').replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
