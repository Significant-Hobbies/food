import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare({ configPath: "wrangler.food.jsonc" })],
  css: {
    transformer: "lightningcss",
  },
  build: {
    manifest: true,
    cssMinify: "lightningcss",
  },
});
