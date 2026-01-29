import { defineConfig } from "tsup";
import { readFileSync, copyFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

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
    define: {
      __VERSION__: JSON.stringify(pkg.version),
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
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
    onSuccess: async () => {
      // Copy HTML and CSS from src/web to public (src/web is source of truth)
      copyFileSync("src/web/index.html", "public/index.html");
      copyFileSync("src/web/style.css", "public/style.css");
      console.log("Copied index.html and style.css to public/");
    },
  },
]);
