// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://presceralabs.ai",
  output: "static",
  integrations: [sitemap()],
  /* the stylesheet (~13 kB gzipped) is inlined into the page, so first paint needs no extra request */
  build: { inlineStylesheets: "always" },
  /* three.js is ~670 kB but lives in its own lazily imported chunk, loaded after first paint */
  vite: {
    build: { chunkSizeWarningLimit: 800 },
    /* dev only: pre-bundle three.js and the addons the hero loads, so the dev server never has to re-optimise them
       mid-session (that made the lazy import fail and the hero fall back to the 2D drawing) */
    optimizeDeps: {
      include: [
        "three",
        "three/examples/jsm/postprocessing/EffectComposer.js",
        "three/examples/jsm/postprocessing/RenderPass.js",
        "three/examples/jsm/postprocessing/UnrealBloomPass.js",
        "three/examples/jsm/postprocessing/SMAAPass.js",
        "three/examples/jsm/postprocessing/OutputPass.js",
        "three/examples/jsm/postprocessing/ShaderPass.js",
        "three/examples/jsm/environments/RoomEnvironment.js",
        "three/examples/jsm/geometries/RoundedBoxGeometry.js",
        "three/examples/jsm/utils/BufferGeometryUtils.js",
        "three/examples/jsm/shaders/FXAAShader.js",
      ],
    },
  },
});
