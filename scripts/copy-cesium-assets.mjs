/**
 * scripts/copy-cesium-assets.mjs
 *
 * Copies CesiumJS static assets (Workers, ThirdParty, Assets, Widgets) from
 * the npm package into public/cesium/ so they are served at runtime under /cesium/*.
 *
 * This script is run by the `prebuild` npm hook (before `next build`) and can
 * also be run manually with:
 *   node scripts/copy-cesium-assets.mjs
 *
 * Using a Node.js script instead of copy-webpack-plugin is required because
 * Next.js 16 uses Turbopack by default, which does not support webpack plugins.
 */

import { cpSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const cesiumSrc = resolve(root, "node_modules/cesium/Build/Cesium");
const publicDest = resolve(root, "public/cesium");

const dirs = ["Workers", "ThirdParty", "Assets", "Widgets"];

console.log("📦 Copying Cesium static assets → public/cesium/");

for (const dir of dirs) {
  const src = resolve(cesiumSrc, dir);
  const dest = resolve(publicDest, dir);
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`  ✓ ${dir}`);
}

console.log("✅ Cesium assets copied successfully.\n");
