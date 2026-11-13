import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("dist/client");
const manifest = JSON.parse(readFileSync(resolve(root, ".vite/manifest.json"), "utf8"));
const visited = new Set();
const files = new Set();
function include(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const entry = manifest[key];
  if (!entry) throw new Error(`Missing build entry ${key}`);
  files.add(entry.file);
  for (const css of entry.css ?? []) files.add(css);
  for (const dependency of entry.imports ?? []) include(dependency);
}
const main = Object.keys(manifest).find((key) => manifest[key].isEntry);
if (!main) throw new Error("Missing HTML entry");
for (const key of [main, "src/FoodApp.tsx", "src/food.css"]) include(key);
const assets = [...files].map((file) => ({ file, bytes: statSync(resolve(root, file)).size }));
const jsBytes = assets.filter(({ file }) => file.endsWith(".js")).reduce((sum, asset) => sum + asset.bytes, 0);
const cssBytes = assets.filter(({ file }) => file.endsWith(".css")).reduce((sum, asset) => sum + asset.bytes, 0);
if (visited.has("src/App.tsx") || visited.has("src/Recipes.tsx")) throw new Error("Inactive operator or recipe route is eagerly loaded");
if (jsBytes > 300_000 || cssBytes > 100_000) throw new Error(`Initial route budget exceeded: JS ${jsBytes}, CSS ${cssBytes}`);
console.log(JSON.stringify({ route: "/", jsBytes, cssBytes, assets, deferred: ["src/App.tsx", "src/Recipes.tsx"] }, null, 2));
