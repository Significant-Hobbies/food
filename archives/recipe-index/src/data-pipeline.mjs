const FRACTIONS = new Map([
  ['¼', 0.25], ['½', 0.5], ['¾', 0.75], ['⅓', 1 / 3], ['⅔', 2 / 3],
  ['⅛', 0.125], ['⅜', 0.375], ['⅝', 0.625], ['⅞', 0.875],
]);
const FRACTION_SYMBOLS = [...FRACTIONS.keys()].join('');
const QUANTITY_PREFIX = new RegExp(
  `^(?:about\\s+|approximately\\s+|~\\s*)?(?:\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?|\\d+\\s*\\/\\s*\\d+|[${FRACTION_SYMBOLS}]|(?:\\d+\\s+)?[${FRACTION_SYMBOLS}]|one|two|three|four|half|a)\\b|^[${FRACTION_SYMBOLS}]`,
  'i',
);
const UNIT_PREFIX = /^(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|grams?|kilograms?|kg|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|ounces?|oz|pounds?|lbs?|cans?|packages?|packs?|scoops?|pinches?|handfuls?|cloves?|branches?|slices?)\b/i;
const NEGLIGIBLE_PATTERN = /\b(?:water|ice cubes?|salt|pepper|cinnamon|allspice|cardamom|cardamon|cloves?|paprika|chipotle|chili|cayenne|curry powder|turmeric|garlic powder|onion powder|baking powder|baking soda|dry yeast|active dry yeast|rosemary|thyme|oregano|parsley|chives|herbs?|lemon zest|vinegar|hot sauce|sriracha|zero calorie sweetener|vegetable broth|veggie broth|matcha powder)\b/i;
const UNSUPPORTED_DATE_PATTERN = /\bdate (?:syrup|sugar)\b/i;

export function rebuildSnapshot(snapshot, sourceRows, reference) {
  const sources = new Map(sourceRows.map((row) => [row.id, row]));
  const videos = snapshot.videos.map((video) => {
    const source = sources.get(video.id);
    if (!source?.description) return video;
    const ingredients = extractIngredients(source.description);
    const creatorTotals = extractCreatorTotals(video.title, source.description);
    const retainedResults = (video.results ?? []).filter((result) => !['protein', 'calories'].includes(result.kind));
    const results = [...creatorTotals, ...retainedResults];
    const next = {
      ...video,
      ingredients,
      results,
      extractionState: ingredients.length ? 'structured' : video.extractionState === 'structured' ? 'partial' : video.extractionState,
      evidenceSources: ['title', 'description'],
      captionFallback: 'not-needed',
    };
    return { ...next, nutrition: ingredients.length ? estimateNutrition(next, reference) : null };
  });

  return {
    ...snapshot,
    collectedAt: new Date().toISOString(),
    counts: summarizeRecipes(videos),
    nutrition: summarizeNutrition(videos, reference),
    videos,
  };
}

export function extractIngredients(description) {
  const lines = String(description ?? '').split(/\r?\n/).map(cleanText);
  const headingIndex = lines.findIndex(isRecipeHeading);
  if (headingIndex < 0) return [];
  const candidates = [];

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].replace(/^[•·-]\s*/, '');
    if (!line || line === '.') continue;
    if (isExplicitResultLine(line) || isInstructionHeading(line)) break;
    if (/^#|^https?:\/\//i.test(line)) {
      if (candidates.length) break;
      continue;
    }
    if (isRecipeHeading(line) || isIngredientSubheading(line)) continue;
    if (isLikelyIngredient(line, true)) {
      candidates.push(line);
      continue;
    }
    if (candidates.length && /[.!?]$/.test(line)) break;
  }

  const seen = new Set();
  return candidates
    .map((sourceText) => ingredientFromLine(sourceText))
    .filter((ingredient) => {
      const key = `${ingredient.name}|${ingredient.sourceText}`;
      if (!ingredient.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60);
}

export function extractCreatorTotals(title, description) {
  const lines = String(description ?? '').split(/\r?\n/).map(cleanText).filter(Boolean);
  const results = [];
  const proteinLine = lines.find((line) => /\b(?:protein content total|total protein|protein total)\b/i.test(line));
  const protein = proteinLine ? numberNearTerm(proteinLine, 'protein', 'g') : numberNearTerm(title, 'protein', 'g');
  if (protein > 0) results.push(result('protein', protein, 'g', proteinLine || title, proteinLine ? 'description' : 'title'));

  const calorieLine = lines.find((line) => /\b(?:total calories|calories total)\b/i.test(line));
  const calories = calorieLine ? numberNearTerm(calorieLine, '(?:calories|kcal)', '(?:kcal|calories)') : null;
  if (calories > 0) results.push(result('calories', calories, 'kcal', calorieLine, 'description'));
  return results;
}

export function estimateNutrition(video, reference) {
  const aliases = flattenedAliases(reference.entries);
  const matchedLines = [];
  const unmatchedLines = [];
  const ignoredLines = [];

  for (const ingredient of video.ingredients) {
    if (isNegligible(ingredient)) {
      ignoredLines.push({ sourceText: ingredient.sourceText, reason: 'negligible-or-zero-impact' });
      continue;
    }
    const entry = resolveReference(ingredient, aliases);
    if (!entry) {
      unmatchedLines.push({ sourceText: ingredient.sourceText, ingredient: ingredient.name, reason: 'reference-unmatched' });
      continue;
    }
    const quantity = quantityInGrams(ingredient.sourceText, entry);
    if (!quantity) {
      unmatchedLines.push({ sourceText: ingredient.sourceText, ingredient: ingredient.name, reason: 'quantity-unmatched', referenceKey: entry.key, fdcId: entry.fdcId });
      continue;
    }
    const factor = quantity.grams / 100;
    matchedLines.push({
      sourceText: ingredient.sourceText,
      ingredient: ingredient.name,
      referenceKey: entry.key,
      fdcId: entry.fdcId,
      referenceDescription: entry.description,
      grams: round(quantity.grams, 1),
      quantitySource: quantity.source,
      nutrients: {
        calories: round(entry.nutrientsPer100g.calories * factor, 1),
        protein: round(entry.nutrientsPer100g.protein * factor, 2),
        fiber: entry.nutrientsPer100g.fiber === null ? null : round(entry.nutrientsPer100g.fiber * factor, 2),
      },
    });
  }

  const materialLineCount = matchedLines.length + unmatchedLines.length;
  const lineCoverage = materialLineCount ? matchedLines.length / materialLineCount : 0;
  const fiberMatched = matchedLines.filter((line) => line.nutrients.fiber !== null).length;
  const fiberCoverage = materialLineCount ? fiberMatched / materialLineCount : 0;
  const raw = matchedLines.reduce((totals, line) => ({
    calories: totals.calories + line.nutrients.calories,
    protein: totals.protein + line.nutrients.protein,
    fiber: totals.fiber + (line.nutrients.fiber ?? 0),
  }), { calories: 0, protein: 0, fiber: 0 });
  const creatorProtein = video.results.find((row) => row.kind === 'protein' && Number.isFinite(row.value));
  const creatorCalories = video.results.find((row) => row.kind === 'calories' && Number.isFinite(row.value));
  const protein = creatorProtein
    ? { value: round(creatorProtein.value, 1), source: 'creator-stated', sourceText: creatorProtein.sourceText }
    : raw.protein > 0
      ? { value: round(raw.protein, 1), source: 'estimated', sourceText: null }
      : null;
  const completeEstimate = materialLineCount > 0 && lineCoverage === 1;
  const calories = creatorCalories
    ? { value: roundTo(creatorCalories.value, 1), source: 'creator-stated', sourceText: creatorCalories.sourceText }
    : raw.calories > 0
      ? { value: roundTo(raw.calories, 10), source: 'estimated', sourceText: null, complete: completeEstimate }
      : null;
  const proteinEnergyFloor = protein ? protein.value * 4 : 0;
  const plausibility = !creatorCalories && proteinEnergyFloor > 0 && raw.calories < proteinEnergyFloor * 0.95
    ? 'protein-calorie-conflict'
    : 'plausible';

  let proteinPer100Calories = null;
  let ratioBasis = null;
  if (creatorProtein && creatorCalories && creatorCalories.value > 0) {
    proteinPer100Calories = round((creatorProtein.value / creatorCalories.value) * 100, 1);
    ratioBasis = 'creator-totals';
  } else if (completeEstimate && raw.calories > 0 && plausibility === 'plausible') {
    proteinPer100Calories = round(((creatorProtein?.value ?? raw.protein) / raw.calories) * 100, 1);
    ratioBasis = creatorProtein ? 'creator-protein-complete-estimate' : 'complete-estimate';
  }
  const fiberPer100Calories = completeEstimate && fiberCoverage === 1 && raw.calories > 0
    ? round((raw.fiber / raw.calories) * 100, 1)
    : null;
  const ratios = proteinPer100Calories !== null || fiberPer100Calories !== null
    ? { proteinPer100Calories, fiberPer100Calories, basis: ratioBasis }
    : null;

  const status = completeEstimate ? 'complete' : matchedLines.length ? 'partial' : 'unavailable';
  return {
    status,
    confidence: completeEstimate ? 'high' : lineCoverage >= reference.coverageThreshold ? 'medium' : 'low',
    lineCoverage: round(lineCoverage, 3),
    fiberCoverage: round(fiberCoverage, 3),
    plausibility,
    materialLineCount,
    matchedLineCount: matchedLines.length,
    estimates: matchedLines.length ? {
      calories: roundTo(raw.calories, 10),
      protein: round(raw.protein, 1),
      fiber: fiberMatched ? round(raw.fiber, 1) : null,
    } : null,
    calories,
    protein,
    ratios,
    matchedLines,
    unmatchedLines,
    ignoredLines,
  };
}

export function quantityInGrams(sourceText, entry) {
  const text = normalizedQuantityText(sourceText);
  const grams = numericMatches(text, /([\d.]+)\s*g\b/gi).at(-1);
  if (grams > 0) return { grams, source: 'explicit-grams' };
  const leading = leadingQuantity(text);
  if (leading) {
    const unit = normalizedUnit(leading.unit);
    if (unit && portionGrams(entry, unit) > 0) return { grams: leading.amount * portionGrams(entry, unit), source: `usda-portion:${unit}` };
    const item = portionGrams(entry, 'item');
    if (!unit && item > 0) return { grams: leading.amount * item, source: 'usda-portion:item' };
  }
  const ounces = numericMatches(text, /([\d.]+)\s*(?:oz|ounces?)\b/gi).at(-1);
  if (ounces > 0) return { grams: ounces * 28.3495, source: 'explicit-ounces' };
  const milliliters = numericMatches(text, /([\d.]+)\s*ml\b/gi).at(-1);
  if (milliliters > 0) {
    const density = portionGrams(entry, 'ml') || 1;
    return { grams: milliliters * density, source: density === 1 ? 'assumed-density' : 'usda-density' };
  }
  const embeddedItems = text.match(/\b(?:juice|zest)\s+of\s+([\d.]+)/i);
  if (embeddedItems && portionGrams(entry, 'item') > 0) return { grams: Number(embeddedItems[1]) * portionGrams(entry, 'item'), source: 'usda-portion:item' };
  return null;
}

function summarizeRecipes(videos) {
  return {
    inventory: videos.length,
    structured: videos.filter((row) => row.extractionState === 'structured').length,
    partial: videos.filter((row) => row.extractionState === 'partial').length,
    nonRecipe: videos.filter((row) => row.extractionState === 'non-recipe').length,
    unavailable: videos.filter((row) => row.extractionState === 'unavailable').length,
    withIngredients: videos.filter((row) => row.ingredients.length > 0).length,
    withResults: videos.filter((row) => row.results.length > 0).length,
    captionFallbacks: videos.filter((row) => row.captionFallback === 'used').length,
  };
}

function summarizeNutrition(videos, reference) {
  const rows = videos.filter((video) => video.ingredients.length).map((video) => video.nutrition).filter(Boolean);
  return {
    schemaVersion: 2,
    reference: { ...reference.source, coverageThreshold: reference.coverageThreshold },
    counts: {
      eligible: rows.length,
      complete: rows.filter((row) => row.status === 'complete').length,
      partial: rows.filter((row) => row.status === 'partial').length,
      unavailable: rows.filter((row) => row.status === 'unavailable').length,
      creatorProtein: rows.filter((row) => row.protein?.source === 'creator-stated').length,
      estimatedProtein: rows.filter((row) => row.protein?.source === 'estimated').length,
      creatorCalories: rows.filter((row) => row.calories?.source === 'creator-stated').length,
      estimatedCalories: rows.filter((row) => row.calories?.source === 'estimated').length,
      ratioReady: rows.filter((row) => Number.isFinite(row.ratios?.proteinPer100Calories)).length,
      fiberRatioReady: rows.filter((row) => Number.isFinite(row.ratios?.fiberPer100Calories)).length,
    },
  };
}

function isRecipeHeading(line) {
  return /👨‍🍳/.test(line) || (/\b(?:recipes?|ingredients?)(?:\s+for\b[^:]{0,50})?\s*:?[.!]?$/i.test(line) && line.length < 140);
}

function isIngredientSubheading(line) {
  return /^(?:for\s+the\s+)?(?:base|filling|topping|frosting|sauce|batter|dough|oats?|yogurt|layer|garnish|soup|burger patty|optional ingredients?|hot chocolate[^:]*|golden milk|vanilla matcha latte)\s*:?[.!]?$/i.test(line)
    || (/^[^.!?]{2,70}:$/.test(line) && !/^ingredient:/i.test(line));
}

function isInstructionHeading(line) {
  return /^(?:method|instructions?|directions?|preparation|how to|scientific proof|nutrition(?:al)? information)\b/i.test(line);
}

function isExplicitResultLine(line) {
  return /\b(?:protein content total|total protein|protein total|total calories|calories total)\b/i.test(line);
}

function isLikelyIngredient(line, insideRecipeSection = false) {
  if (line.length > 180) return false;
  if (QUANTITY_PREFIX.test(line)) return true;
  if (/^ingredient:\s*\S+/i.test(line)) return true;
  if (/^(?:juice|zest)\s+of\s+\d+|^(?:salt|pepper|water|ice|vanilla|cinnamon|optional|a pinch|pinch)\b/i.test(line)) return true;
  return insideRecipeSection
    && line.length <= 70
    && line.split(/\s+/).length <= 9
    && !/[.!?]$|https?:|^#|^(?:season|serve|mix|blend|bake|cook|add)\b/i.test(line);
}

function ingredientFromLine(sourceText) {
  let remainder = sourceText
    .replace(/^[•·-]\s*/, '')
    .replace(/^ingredient:\s*/i, '')
    .replace(new RegExp(`^(?:about\\s+|approximately\\s+|~\\s*)?(?:\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?|\\d+\\s*\\/\\s*\\d+|[${FRACTION_SYMBOLS}]|(?:\\d+\\s+)?[${FRACTION_SYMBOLS}]|one|two|three|four|half|a)\\s*`, 'i'), '')
    .trim();
  remainder = remainder.replace(/^\([^)]*\)\s*/, '').replace(UNIT_PREFIX, '').trim();
  remainder = remainder.replace(/^\([^)]*\)\s*/, '').replace(/^of\s+/i, '').trim();
  const name = remainder
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:soft|pitted|drained|rinsed|cooked|fresh|organic|cold|whole|rolled|pure|optional)\b/gi, ' ')
    .replace(/[,;*].*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim()
    .toLowerCase();
  return { name: name || sourceText.toLowerCase(), sourceText, source: 'description' };
}

function numberNearTerm(line, termPattern, unitPattern) {
  const text = cleanText(line);
  const before = text.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unitPattern}\\s*(?:of\\s+)?(?:plant[- ]based\\s+)?${termPattern}`, 'i'));
  const after = text.match(new RegExp(`${termPattern}[^\\d]{0,40}(\\d+(?:[.,]\\d+)?)\\s*${unitPattern}`, 'i'));
  const match = before ?? after;
  return match ? Number(match[1].replace(',', '.')) : null;
}

function result(kind, value, unit, sourceText, source) {
  return { kind, label: kind === 'calories' ? 'Total Calories' : 'Protein Content Total', value, unit, sourceText: cleanText(sourceText), source, attribution: 'creator-stated' };
}

function flattenedAliases(entries) {
  return entries.flatMap((entry) => entry.aliases.map((alias) => ({ alias: alias.toLowerCase(), entry }))).sort((left, right) => right.alias.length - left.alias.length);
}

function resolveReference(ingredient, aliases) {
  const text = `${ingredient.name} ${ingredient.sourceText}`.toLowerCase();
  if (UNSUPPORTED_DATE_PATTERN.test(text)) return null;
  return aliases.find(({ alias }) => text.includes(alias))?.entry ?? null;
}

function isNegligible(ingredient) {
  return /^\s*optional\b/i.test(ingredient.sourceText) || NEGLIGIBLE_PATTERN.test(ingredient.name);
}

function normalizedQuantityText(value) {
  let text = String(value).toLowerCase().replace(/,/g, '.');
  for (const [symbol, amount] of FRACTIONS) text = text.replaceAll(symbol, ` ${amount} `);
  text = text.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, (_, whole, numerator, denominator) => String(Number(whole) + Number(numerator) / Number(denominator)));
  text = text.replace(/(^|\s)(\d+)\s*\/\s*(\d+)(?=\s|$)/g, (_, prefix, numerator, denominator) => `${prefix}${Number(numerator) / Number(denominator)}`);
  text = text.replace(/(^|\s)(\d+)\s+(0\.\d+)(?=\s|$)/g, (_, prefix, whole, fraction) => `${prefix}${Number(whole) + Number(fraction)}`);
  return text.replace(/\s+/g, ' ').trim();
}

function leadingQuantity(text) {
  const range = text.match(/^\s*([\d.]+)\s*(?:-|to)\s*([\d.]+)\s*([a-z]+)?/i);
  if (range) return { amount: (Number(range[1]) + Number(range[2])) / 2, unit: range[3] ?? '' };
  const match = text.match(/^\s*([\d.]+)\s*([a-z]+)?/i);
  return match ? { amount: Number(match[1]), unit: match[2] ?? '' } : null;
}

function numericMatches(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => Number(match[1])).filter(Number.isFinite);
}

function normalizedUnit(value) {
  const unit = String(value).toLowerCase();
  if (/^cups?$/.test(unit)) return 'cup';
  if (/^(?:tbsp|tablespoons?)$/.test(unit)) return 'tbsp';
  if (/^(?:tsp|teaspoons?)$/.test(unit)) return 'tsp';
  if (/^(?:oz|ounces?)$/.test(unit)) return 'oz';
  if (/^(?:g|grams?)$/.test(unit)) return 'g';
  if (/^(?:ml|milliliters?)$/.test(unit)) return 'ml';
  if (/^(?:cans?|jars?|packages?|bars?|heads?|bunch(?:es)?|leaves?|leaf|inches?|small|medium|large)$/.test(unit)) return unit.replace(/s$/, '');
  return '';
}

function portionGrams(entry, unit) {
  if (unit === 'oz') return 28.3495;
  if (unit === 'g') return 1;
  const portions = entry.portions ?? {};
  if (portions[unit] > 0) return portions[unit];
  if (unit === 'cup' && portions.tbsp > 0) return portions.tbsp * 16;
  if (unit === 'tbsp' && portions.tsp > 0) return portions.tsp * 3;
  if (unit === 'tbsp' && portions.cup > 0) return portions.cup / 16;
  if (unit === 'tsp' && portions.tbsp > 0) return portions.tbsp / 3;
  if (unit === 'tsp' && portions.cup > 0) return portions.cup / 48;
  return 0;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundTo(value, increment) {
  return Math.round(value / increment) * increment;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
