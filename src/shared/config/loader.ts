// src/shared/config/loader.ts
// Configuration utilities shared across the compiler.
// CLI-specific file loading lives in adapters/cli/utils/config-loader.ts

import type { ChainCSSConfig } from './index.js';

/**
 * Deep merge two objects. Source values override target values.
 * Arrays are replaced, not merged. Used for merging user config with defaults.
 */
export function deepMergeConfig<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result: Record<string, any> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMergeConfig(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Default configuration applied before user config.
 * Only includes values that the compiler actually uses.
 */
export function getDefaultConfig(): ChainCSSConfig {
  return {
    inputs: ['src/**/*.chain.{ts,tsx}'],
    output: {
      cssFile: 'dist/styles.css',
      minify: false,
      generateGlobalCSS: true,
      targets: ['css'],
    },
    atomic: {
      enabled: false,
      threshold: 3,
      naming: 'readable',
      mode: 'hybrid',
      minify: false,
      verbose: false,
    },
    tokens: {
      tokens: {},
      relationships: [],
    },
    breakpoints: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    prefixer: {
      enabled: true,
      mode: 'lightweight',
      browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
      sourceMap: false,
      sourceMapInline: false,
      remove: true,
      add: true,
    },
    cache: {
      enabled: true,
      maxAgeDays: 30,
      maxSizeMB: 500,
      path: '.chaincss-cache',
    },
    dev: {
      port: 3000,
      publicDir: 'public',
    },
    framework: 'auto',
    namespace: 'chain-',
    verbose: false,
    silent: false,
    debug: false,
    timeline: false,
    sourceComments: false,
    watch: false,
    hmr: false,
    shorthands: {},
    macros: {},
    intents: {},
    allowOverride: false,
    plugins: [],
  };
}