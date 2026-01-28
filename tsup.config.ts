import { defineConfig } from "tsup";

export default defineConfig([
  // Core library (ESM + CJS)
  {
    entry: ["src/core/index.ts"],
    outDir: "dist/core",
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: false,
    clean: true,
  },
  // CLI (Node.js ESM)
  {
    entry: ["src/cli/index.ts"],
    outDir: "dist/cli",
    format: ["esm"],
    sourcemap: false,
    platform: "node",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Web app (IIFE bundle)
  {
    entry: ["src/web/app.ts"],
    outDir: "public",
    format: ["iife"],
    globalName: "SparkleValidator",
    sourcemap: false,
    noExternal: [/(.*)/],
  },
]);
