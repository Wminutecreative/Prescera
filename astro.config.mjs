// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://presceralabs.ai",
  output: "static",
  integrations: [sitemap()],
  build: { inlineStylesheets: "auto" },
  /* three.js is ~670 kB but lives in its own lazily imported chunk, loaded after first paint */
  vite: { build: { chunkSizeWarningLimit: 800 } },
});
