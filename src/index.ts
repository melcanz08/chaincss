// src/index.ts

/**
 * ChainCSS — Zero-runtime CSS-in-JS with chainable API.
 * 
 * This is the main entry point for everyday usage.
 * 
 * For advanced pipeline control and compiler internals:
 *   import { ... } from 'chaincss/advanced'
 * 
 * For runtime framework integration:
 *   import { ... } from 'chaincss/runtime'
 * 
 * For compiler-only usage:
 *   import { ... } from 'chaincss/compiler'
 */

// ============================================================================
// Core API — The only exports most users need
// ============================================================================

export { chain, StyleCollector } from './core/style-collector.js';
export type { StyleObject, Explanation } from './core/style-collector.js';

export { compileToCSS, partitionForBuild } from './core/style-compiler.js';
export type { CompileOptions, CompileResult } from './core/style-compiler.js';

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
// Version
// ============================================================================

export const VERSION = "2.8.13";

// Default export
export { default } from './core/style-collector.js';