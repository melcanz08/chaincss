// src/index.ts — v3.8 merged
// Main entry for `chaincss` — supports chain API + defineConfig + entanglement

// ============================================================================
// Core API — what most users use (from your existing file, keep)
// ============================================================================
export { chain, StyleCollector } from './core/style-collector.js';
export type { StyleObject, Explanation } from './core/style-collector.js';

export { compileToCSS, partitionForBuild } from './core/style-compiler.js';
export { classifyValue, partitionStyles, hasDynamicValues } from './core/value-classifier.js';

// ============================================================================
// Design Tokens (keep)
// ============================================================================
export { DesignTokens, createTokens } from './compiler/tokens/tokens.js';
export type { TokensStructure } from './compiler/tokens/tokens.js';

// ============================================================================
// Theme Contracts (keep)
// ============================================================================
export {
  createThemeContract,
  validateTheme,
  createTheme,
  Theme
} from './compiler/tokens/theme-contract.js';
export type { ThemeContract, ThemeTokens } from './compiler/tokens/theme-contract.js';

// ============================================================================
// Recipes (keep)
// ============================================================================
export { recipe } from './compiler/recipe.js';
export type { RecipeOptions, Recipe } from './compiler/recipe.js';

// ============================================================================
// v3.1 Fix: DX for config — enables `import { defineConfig } from 'chaincss'`
// ============================================================================
export { defineConfig } from './core/config.js';
export type { ChainProxy, ChainCSSConfig, ChainCSSUserConfig } from './core/types.js';
export { loadConfig, saveConfigTemplate } from './cli/utils/config-loader.js';

// ============================================================================
// Plugins (from v3.1)
// ============================================================================
export { default as chaincss } from './plugins/vite.js';
export { default as chaincssVite } from './plugins/vite.js';

// ============================================================================
// 🆕 v3.8 Entanglement — additive, does not break anything above
// ============================================================================
//export { TokenEntanglementEngine } from './compiler/tokens/entanglement.js';
/*export type {
  Relationship,
  DerivedRelationship,
  ContrastRelationship,
  EntanglementReport,
  EntanglementChange
} from './compiler/tokens/entanglement.js';*/

// Optional convenience, main usage is via sub-path `chaincss/figma-sync`
//export { default as figmaSync } from './plugins/figma-sync.js';

// ============================================================================
// Version (keep from your existing file)
// ============================================================================
declare const __CHAINCSS_VERSION__: string;
export const VERSION: string = typeof __CHAINCSS_VERSION__ !== 'undefined' ? __CHAINCSS_VERSION__ : '0.0.0';

// Default export (keep)
export { default } from './core/style-collector.js';