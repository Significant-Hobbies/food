import { readFile, writeFile } from 'node:fs/promises';

import { rebuildSnapshot } from '../src/data-pipeline.mjs';

const snapshotUrl = new URL('../public/data/recipes.json', import.meta.url);
const sourcesUrl = new URL('../data/source-descriptions.json', import.meta.url);
const referenceUrl = new URL('../public/data/nutrition-reference.json', import.meta.url);
const [snapshot, sources, reference] = await Promise.all([
  readFile(snapshotUrl, 'utf8').then(JSON.parse),
  readFile(sourcesUrl, 'utf8').then(JSON.parse),
  readFile(referenceUrl, 'utf8').then(JSON.parse),
]);

if (sources.videos.length !== snapshot.videos.length) {
  throw new Error(`Source cache has ${sources.videos.length} rows; expected ${snapshot.videos.length}.`);
}

const rebuilt = rebuildSnapshot(snapshot, sources.videos, reference);
await writeFile(snapshotUrl, `${JSON.stringify(rebuilt, null, 2)}\n`);
console.log(JSON.stringify({ counts: rebuilt.counts, nutrition: rebuilt.nutrition.counts }, null, 2));
