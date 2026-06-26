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
export { tokens } from './tokens/tokens.js';
export { setBreakpoints } from './breakpoints.js';

// Export atomic optimizer
export { AtomicOptimizer } from './legacy/atomic-optimizer.js';
export type { 
  AtomicClass, 
  
  ComponentClassMapEntry,
  OptimizeResult 
} from './legacy/atomic-optimizer.js';

// Export prefixer
export { ChainCSSPrefixer } from './prefixer.js';
export type { PrefixerConfig, PrefixerResult } from './prefixer.js';

// Export tokens (single source - don't duplicate)
export { DesignTokens, createTokens as createDesignTokens } from './tokens/tokens.js';
export type { TokensStructure, FlattenedTokens } from './tokens/tokens.js';

// Export theme contract
export { createThemeContract, validateTheme, createTheme, Theme } from './tokens/theme-contract.js';
export type { ThemeContract, ThemeTokens } from './tokens/theme-contract.js';

// Export cache managers
export { CacheManager } from './cache/cache-manager.js';
export { PersistentCache } from './cache/content-addressable-cache.js';
export type { CacheData, CacheOptions } from './cache/cache-manager.js';
export type { PersistentCacheOptions, PersistentCacheEntry } from './cache/content-addressable-cache.js';

// Export shorthands
export { shorthandMap, macros, handleShorthand, isShorthand, expandShorthand, getAvailableShorthands } from './utils/shorthands.js';

// Export helpers
export { helpers } from './utils/helpers.js';

// Export animations
export { animationPresets, createAnimation, getAnimationPreset, hasAnimationPreset, getAnimationPresetNames } from './animations.js';

// Export breakpoints
export { setBreakpoints as setBreakpointsUtil, getBreakpoint, getAllBreakpoints, resetBreakpoints, addBreakpoint, removeBreakpoint } from './breakpoints.js';

// Export suggestions
export { getSuggestion, getSuggestions, getPropertySuggestion, getShorthandSuggestion } from './utils/suggestions.js';

// Export new Pipeline architecture (v2.7+)
export {
  Pipeline,
  createDefaultPipeline,
} from './pipeline/index.js';
export type {
  PipelineConfig,
  PipelineResult,
  NormalizationPass,
  ValidationPass,
  AnalysisPass,
  OptimizationPass,

} from './pipeline/index.js';

// Export token resolver
export { resolveToken, setTokenContext, getTokenContext, clearTokenContext, TokenResolver } from './tokens/token-resolver.js';



// Note: component-gen.ts is intentionally not exported as it's deprecated
// Use the component generation in btt.ts instead