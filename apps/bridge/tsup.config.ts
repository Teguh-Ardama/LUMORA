import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { main: "src/main/index.ts", preload: "src/main/preload.ts" },
    outDir: "dist",
    format: ["cjs"],
    outExtension: () => ({ js: ".cjs" }),
    platform: "node",
    target: "node20",
    // Bundle workspace TS packages; keep natives/electron external.
    noExternal: [/@lumora\/.*/, "zod"],
    external: ["electron", "sharp", "chokidar"],
    clean: false,
    sourcemap: false,
  },
  {
    entry: { renderer: "src/renderer/renderer.ts" },
    outDir: "dist",
    format: ["iife"],
    outExtension: () => ({ js: ".js" }),
    platform: "browser",
    target: "chrome120",
    clean: false,
  },
]);
