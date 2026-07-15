// src/index.ts — Main entry for `chaincss`
// Zero runtime dependencies. No CLI, no Vite, no Node APIs.

// ============================================================================
// Core API
// ============================================================================
export { chain, StyleCollector } from './core/style-collector.js';
export type { StyleObject, Explanation } from './core/style-collector.js';

export { compileToCSS, partitionForBuild } from './core/style-compiler.js';
export { classifyValue, partitionStyles, hasDynamicValues } from './core/value-classifier.js';

// ============================================================================
// Design Tokens
// ============================================================================
export { DesignTokens, createTokens } from './compiler/tokens/tokens.js';
export type { TokensStructure } from './compiler/tokens/tokens.js';

// ============================================================================
// Theme Contracts
// ============================================================================
export {
  createThemeContract,
  validateTheme,
  createTheme,
  Theme
} from './compiler/tokens/theme-contract.js';
export type { ThemeContract, ThemeTokens } from './compiler/tokens/theme-contract.js';

// ============================================================================
// Recipes
// ============================================================================
export { recipe } from './compiler/recipe.js';
export type { RecipeOptions, Recipe } from './compiler/recipe.js';

// ============================================================================
// Config & Types
// ============================================================================
export { defineConfig } from './core/config.js';
export type { ChainProxy, ChainCSSConfig, ChainCSSUserConfig } from './core/types.js';

// ============================================================================
// Version
// ============================================================================
declare const __CHAINCSS_VERSION__: string;
export const VERSION: string = typeof __CHAINCSS_VERSION__ !== 'undefined' ? __CHAINCSS_VERSION__ : '0.0.0';

// Default export
export { default } from './core/style-collector.js';
