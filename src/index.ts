// src/index.ts

/**
 * ChainCSS — Zero-runtime CSS-in-JS with chainable API.
 * 
 * This is the main entry point for everyday usage.
 * For advanced pipeline control, IR manipulation, and compiler internals,
 * import from 'chaincss/advanced'.
 */

// ============================================================================
// Core API — The only exports most users need
// ============================================================================

export { chain, $, StyleCollector } from './core/style-collector.js';
export type { StyleObject, Explanation } from './core/style-collector.js';

export { compileToCSS, partitionForBuild } from './core/style-compiler.js';
export type { CompileOptions, CompileResult } from './core/style-compiler.js';

export { classifyValue, partitionStyles, hasDynamicValues } from './core/value-classifier.js';
export type { ValueClass } from './core/value-classifier.js';

// ============================================================================
// Compiler
// ============================================================================

export { ChainCSSCompiler, compileChainCSS } from './core/compiler.js';

// ============================================================================
// Runtime Injection
// ============================================================================

export {
  styleInjector,
  setTokens,
  compileRuntime,
  removeRuntimeModule,
  clearRuntimeStyles,
  enableRuntimeDebug,
  runRuntime
} from './runtime/injector.js';

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
// Shorthands & Macros
// ============================================================================

export {
  shorthandMap,
  macros,
  handleShorthand,
  isShorthand,
  expandShorthand,
  getAvailableShorthands
} from './compiler/utils/shorthands.js';

// ============================================================================
// Animations & Breakpoints
// ============================================================================

export {
  animationPresets,
  createAnimation,
  getAnimationPreset,
  hasAnimationPreset,
  getAnimationPresetNames
} from './compiler/animations.js';
export type { AnimationConfig, KeyframeDefinition } from './compiler/animations.js';

export { setBreakpoints, currentBreakpoints } from './compiler/breakpoints.js';
export type { BreakpointsMap, ResponsiveStyle } from './compiler/breakpoints.js';

// ============================================================================
// Recipes & Framework Codegen
// ============================================================================

export { recipe } from './compiler/recipe.js';
export type { RecipeOptions, Recipe } from './compiler/recipe.js';

export { generateComponentCode, detectFramework } from './compiler/features/framework-codegen.js';
export type { ComponentInfo } from './compiler/features/framework-codegen.js';

// ============================================================================
// Utilities
// ============================================================================

export { helpers } from './compiler/utils/helpers.js';
export { getSuggestion, getSuggestions, getPropertySuggestion } from './compiler/utils/suggestions.js';
export { ChainCSSPrefixer } from './compiler/prefixer.js';
export type { PrefixerConfig, PrefixerResult } from './compiler/prefixer.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = "2.9.0";

// Default export
export { default } from './core/style-collector.js';