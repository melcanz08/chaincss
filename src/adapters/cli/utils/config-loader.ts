// ============================================================================
// FILE: src/adapters/cli/utils/config-loader.ts
// ============================================================================

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createLogger } from "@shared/logger/index.js";
import type {
  ChainCSSConfig,
  ChainCSSUserConfig,
} from "@shared/config/index.js";
import { DEFAULT_CONFIG as CORE_DEFAULTS } from "@shared/constants/index.js";

// ------------------------------------------------------------------
// Extensibility types
// ------------------------------------------------------------------

export function defineConfig(config: ChainCSSUserConfig): ChainCSSUserConfig {
  return config;
}

function isObject(v: any): boolean {
  return v && typeof v === "object" && !Array.isArray(v);
}

function normalize(mod: any): ChainCSSUserConfig {
  return (
    ((mod?.default ?? mod) as ChainCSSUserConfig) || ({} as ChainCSSUserConfig)
  );
}

/**
 * Robustly deep merges user configuration options onto core system defaults.
 * Prevents sub-objects from being completely overwritten when only partial keys are provided.
 */
function deepMerge(target: any, source: any): any {
  if (!source) return target;
  if (!target) return source;

  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function mergeConfig(defaults: any, user: any): ChainCSSConfig {
  if (!user) return defaults;
  return deepMerge(defaults, user) as ChainCSSConfig;
}

/**
 * Safely runs preset factory hooks asynchronously, resolving promise chains
 * before compilation layers mix configuration outputs.
 */
async function mergePresets(
  base: ChainCSSUserConfig,
): Promise<ChainCSSUserConfig> {
  if (!base.presets?.length) return base;

  let acc: ChainCSSUserConfig = { shorthands: {}, macros: {}, intents: {} };

  for (const p of base.presets) {
    let preset: ChainCSSUserConfig | undefined;

    if (typeof p === "function") {
      try {
        preset = await p(base);
      } catch (err) {
        const logger = createLogger(false);
        logger.warn(`Failed parsing configuration preset function hook:`, err);
      }
    } else if (isObject(p)) {
      preset = p;
    }

    if (preset) {
      acc = mergeConfig(acc, preset) as unknown as ChainCSSUserConfig;
    }
  }

  return mergeConfig(acc, base) as unknown as ChainCSSUserConfig;
}

async function tryLoadWithJiti(
  filePath: string,
  root: string,
): Promise<any | null> {
  try {
    const jitiMod: any = await import("jiti").catch(() => null);
    const createJiti =
      jitiMod?.createJiti || jitiMod?.default?.createJiti || jitiMod?.default;
    if (!createJiti) return null;

    const jiti = createJiti(root, {
      interopDefault: true,
      fsCache: false,
      moduleCache: false,
    });
    return await jiti.import(filePath, { default: true });
  } catch {
    return null;
  }
}

async function tryLoadWithVite(
  filePath: string,
  root: string,
): Promise<any | null> {
  try {
    const { loadConfigFromFile } = await import("vite");
    const res = await loadConfigFromFile(
      { command: "serve", mode: "development" } as any,
      filePath,
      root,
    );
    return res?.config ?? null;
  } catch {
    return null;
  }
}

export async function loadConfig(configPath?: string): Promise<ChainCSSConfig> {
  const logger = createLogger(false);
  const root = process.cwd();

  const possiblePaths = configPath
    ? [path.isAbsolute(configPath) ? configPath : path.join(root, configPath)]
    : [
        path.join(root, "chaincss.config.ts"),
        path.join(root, "chaincss.config.js"),
        path.join(root, "chaincss.config.mjs"),
        path.join(root, "chaincss.config.cjs"),
        path.join(root, "chaincss.config.json"),
        path.join(root, ".chaincssrc.js"),
        path.join(root, "chaincss.json"),
      ];

  for (const configFile of possiblePaths) {
    if (!fs.existsSync(configFile)) continue;

    try {
      logger.debug(`Loading configuration from target asset: ${configFile}`);
      let loaded: any = null;

      if (configFile.endsWith(".json")) {
        loaded = JSON.parse(fs.readFileSync(configFile, "utf8"));
      } else {
        // 1. Prioritize Jiti loading (supports TS natively, handles live reloads cleanly without memory leaks)
        loaded = await tryLoadWithJiti(configFile, root);

        // 2. Fall back to Vite config pipeline loading
        if (!loaded) loaded = await tryLoadWithVite(configFile, root);

        // 3. Fall back to direct ESM dynamic imports
        if (!loaded) {
          // Keep query param cache buster strictly here as a last-resort fallback
          const url = pathToFileURL(configFile).href + `?t=${Date.now()}`;
          const mod = await import(url);
          loaded = mod;
        }
      }

      const normalizedConfig = normalize(loaded);
      const userConfig = await mergePresets(normalizedConfig);

      if (userConfig.intents) {
        const { registerIntents } =
          await import("@compiler/pipeline/lowering/intent-resolver.js");
        registerIntents(userConfig.intents as any, !!userConfig.allowOverride);
      }

      return mergeConfig(CORE_DEFAULTS, userConfig);
    } catch (error) {
      logger.warn(
        `Failed to parse config element boundary at ${configFile}:`,
        error,
      );
    }
  }

  return CORE_DEFAULTS as ChainCSSConfig;
}

export function saveConfigTemplate(
  outputPath: string = "chaincss.config.js",
  full: boolean = false,
): void {
  const root = process.cwd();

  // Detect if target environment requires CommonJS or ESM imports
  let isESM = false;
  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      isESM = pkg.type === "module";
    } catch {
      // Standard safe fallback
    }
  }

  // Set imports/exports based on local ESM module capabilities
  const importStatement = isESM
    ? "import { defineConfig } from 'chaincss'"
    : "const { defineConfig } = require('chaincss')";

  const exportStatement = isESM
    ? "export default defineConfig({"
    : "module.exports = defineConfig({";

  let configBody = "";
  if (full) {
    configBody = `  shorthands: {},
  macros: {},
  intents: {},
  allowOverride: false,
  inputs: ['src/**/*.chain.js', 'src/**/*.chain.ts'],
  output: { cssFile: 'dist/styles.css' },
  tokens: { enabled: true, prefix: 'chain' },
  atomic: { enabled: true, naming: 'readable', minify: true },
  prefixer: { enabled: true },
  breakpoints: {
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)'
  },
  debug: false,
  verbose: false`;
  } else {
    configBody = `  shorthands: {},
  macros: {},
  intents: {},
  inputs: ['src/**/*.chain.js', 'src/**/*.chain.ts'],
  output: { cssFile: 'dist/styles.css' },
  atomic: { enabled: true, naming: 'readable', minify: true },
  prefixer: { enabled: true },
  breakpoints: {
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)'
  }`;
  }

  const template = `/**
 * ChainCSS Configuration ${full ? "v3.2" : ""}
 * @type {import('chaincss').ChainCSSUserConfig}
 */
${importStatement}

${exportStatement}
${configBody}
});\n`;

  fs.writeFileSync(outputPath, template, "utf8");
}
