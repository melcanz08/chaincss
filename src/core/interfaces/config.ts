// src/core/interfaces/config.ts

// This file exists for DX only: `import { defineConfig } from 'chaincss'`
// Re-exports the pure defineConfig function. Node-dependent loadConfig/saveConfigTemplate
// are available from 'chaincss/config' subpath only.

import type { ChainCSSUserConfig } from "@shared/config/index.js";

export type { ChainCSSUserConfig, MacroHandler } from "@shared/config/index.js";

/**
 * Pure identity function providing autocompletion and type-safety for ChainCSS configuration files.
 * Safe for browser execution environments.
 */
export function defineConfig<T extends ChainCSSUserConfig>(config: T): T {
  return config;
}

// For users who import from 'chaincss/config' or prefer default imports
export default defineConfig;
