import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { scopeCaptureCss } from "./scripts/scope-capture-css.mjs";

const captureStyles: Plugin = {
  name: "food-capture-styles",
  enforce: "pre",
  load(id) {
    if (!id.endsWith("/@saas-maker/ui/footer.css?raw")) return;
    return `export default ${JSON.stringify(scopeCaptureCss(readFileSync(id.slice(0, -4), "utf8")))}`;
  },
};

export default defineConfig({
  plugins: [captureStyles, react(), tailwindcss(), cloudflare({ configPath: "wrangler.food.jsonc" })],
  css: {
    transformer: "lightningcss",
  },
  build: {
    manifest: true,
    cssMinify: "lightningcss",
  },
});
