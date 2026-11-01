// ts-loadconfig.ts — Phase 4 TS oracle for config-loading parity.
//
// Reads a chaincss.config.json, applies getDefaultConfig + deepMergeConfig
// from the TS loader, dumps the fully-resolved ChainCSSConfig as JSON.
//
// Usage: npx -y tsx --tsconfig ./tsconfig.json ts-loadconfig.ts <config.json>

import { getDefaultConfig, deepMergeConfig } from "../src/shared/config/loader.js";
import fs from "fs";
import { resolve } from "node:path";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: ts-loadconfig.ts <chaincss.config.json>");
    process.exit(2);
  }
  const userConfig = JSON.parse(fs.readFileSync(resolve(file), "utf8"));
  const merged = deepMergeConfig(getDefaultConfig(), userConfig);
  process.stdout.write(JSON.stringify(merged, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
