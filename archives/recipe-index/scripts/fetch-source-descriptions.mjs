import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const snapshotUrl = new URL('../public/data/recipes.json', import.meta.url);
const outputDirectoryUrl = new URL('../data/', import.meta.url);
const outputUrl = new URL('source-descriptions.json', outputDirectoryUrl);
const snapshot = JSON.parse(await readFile(snapshotUrl, 'utf8'));
const urls = snapshot.videos.map((video) => video.url);
const result = spawnSync('yt-dlp', [
  '--skip-download',
  '--no-warnings',
  '--print',
  '{"id":%(id)j,"title":%(title)j,"description":%(description)j,"webpageUrl":%(webpage_url)j}',
  ...urls,
], {
  encoding: 'utf8',
  maxBuffer: 128 * 1024 * 1024,
});

if (result.status !== 0) {
  throw new Error(`yt-dlp failed (${result.status}): ${result.error?.message ?? result.stderr.trim()}`);
}

const fetched = new Map(result.stdout.trim().split('\n').filter(Boolean).map((line) => {
  const row = JSON.parse(line);
  return [row.id, {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    webpageUrl: row.webpageUrl,
    fetchedAt: new Date().toISOString(),
  }];
}));
const missing = snapshot.videos.filter((video) => !fetched.has(video.id));
if (missing.length) throw new Error(`Missing ${missing.length} descriptions: ${missing.map((video) => video.id).join(', ')}`);

const cache = {
  schemaVersion: 1,
  channelId: snapshot.channel.id,
  sourceUrl: snapshot.channel.sourceUrl,
  fetchedAt: new Date().toISOString(),
  videos: snapshot.videos.map((video) => fetched.get(video.id)),
};
await mkdir(outputDirectoryUrl, { recursive: true });
await writeFile(outputUrl, `${JSON.stringify(cache, null, 2)}\n`);
console.log(`Cached ${cache.videos.length} public video descriptions.`);
