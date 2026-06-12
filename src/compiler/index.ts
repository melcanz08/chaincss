// src/compiler/index.ts

// Export all compiler modules
export {
  enableTimeline,
  getStyleHistory,
  getStyleChanges,
  getStyleDiff,
  exportTimeline,
  clearTimeline,
} from './timeline.js';

// Other utilities
export { recipe } from './recipe.js';
export { tokens } from './tokens.js';
export { setBreakpoints } from './breakpoints.js';

// Export atomic optimizer
export { AtomicOptimizer } from './atomic-optimizer.js';
export type { 
  AtomicClass, 
  AtomicOptimizerOptions, 
  AtomicOptimizerStats,
  ComponentClassMapEntry,
  OptimizeResult 
} from './atomic-optimizer.js';

// Export prefixer
export { ChainCSSPrefixer } from './prefixer.js';
export type { PrefixerConfig, PrefixerResult } from './prefixer.js';

// Export tokens (single source - don't duplicate)
export { DesignTokens, createTokens as createDesignTokens } from './tokens.js';
export type { TokensStructure, FlattenedTokens } from './tokens.js';

// Export theme contract
export { createThemeContract, validateTheme, createTheme, Theme } from './theme-contract.js';
export type { ThemeContract, ThemeTokens } from './theme-contract.js';

// Export cache managers
export { CacheManager } from './cache-manager.js';
export { PersistentCache } from './content-addressable-cache.js';
export type { CacheData, CacheOptions } from './cache-manager.js';
export type { PersistentCacheOptions, PersistentCacheEntry } from './content-addressable-cache.js';

// Export shorthands
export { shorthandMap, macros, handleShorthand, isShorthand, expandShorthand, getAvailableShorthands } from './shorthands.js';

// Export helpers
export { helpers } from './helpers.js';

// Export animations
export { animationPresets, createAnimation, getAnimationPreset, hasAnimationPreset, getAnimationPresetNames } from './animations.js';

// Export breakpoints
export { setBreakpoints as setBreakpointsUtil, getBreakpoint, getAllBreakpoints, resetBreakpoints, addBreakpoint, removeBreakpoint } from './breakpoints.js';

// Export suggestions
export { getSuggestion, getSuggestions, getPropertySuggestion, getShorthandSuggestion } from './suggestions.js';

// Export token resolver
export { resolveToken, setTokenContext, getTokenContext, clearTokenContext, TokenResolver } from './token-resolver.js';

// Note: component-gen.ts is intentionally not exported as it's deprecated
// Use the component generation in btt.ts instead