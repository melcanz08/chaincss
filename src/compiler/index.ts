// src/compiler/index.ts

/**
 * ChainCSS Compiler Public API Entrypoint
 * Highly structured and grouped by architectural domain.
 * FIXED v2.14.1 — added ManifestWriter + CompilerEvents exports
 */

// --- 1. Core Compiler & Pipeline Engine (v2.7+) ---
export { ChainCSSCompiler } from "@core/usecases/compiler.js";
export {
  Pipeline,
  type PipelineConfig,
  type PipelineResult,
  type NormalizationPass,
  type ValidationPass,
  type AnalysisPass,
  type OptimizationPass,
} from "./pipeline/index.js";

export {
  createPipeline,
  createDefaultPipeline,
  createFullPipeline,
  type PipelinePreset,
} from "./pipeline/pipeline.js";

// --- 2. Design Tokens & Theme Contracts ---
export {
  tokens,
  DesignTokens,
  createTokens as createDesignTokens,
  type TokensStructure,
  type FlattenedTokens,
} from "./tokens/tokens.js";

export {
  resolveToken,
  setTokenContext,
  getTokenContext,
  clearTokenContext,
  TokenResolver,
} from "./tokens/token-resolver.js";

export {
  createThemeContract,
  validateTheme,
  createTheme,
  Theme,
  type ThemeContract,
  type ThemeTokens,
} from "./tokens/theme-contract.js";

// --- 3. Prefixer & AST Normalization ---
export {
  ChainCSSPrefixer,
  type PrefixerConfig,
  type PrefixerResult,
} from "./prefixer.js";

// --- 4. Cache & Persistence Managers ---
export {
  CacheManager,
  type CacheData,
  type CacheOptions,
} from "./cache/cache-manager.js";

export {
  PersistentCache,
  type PersistentCacheOptions,
  type PersistentCacheEntry,
} from "./cache/content-addressable-cache.js";

export {
  ManifestWriter,
  type ManifestData,
  type ManifestOptions,
} from "./services/manifest-writer.js";

// --- 5. Compiler Events & Diagnostics ---
export {
  CompilerEvents,
  type CompilerEvent,
  type CompilerEventType,
  type CompilerEventMap,
  type CompilerEventHandler,
  createEvent,
} from "./services/compiler-events.js";

// --- 6. Breakpoints & Responsive Layout ---
export {
  setBreakpoints,
  setBreakpoints as setBreakpointsUtil, // Alias preserved for backward compatibility
  getBreakpoint,
  getAllBreakpoints,
  resetBreakpoints,
  addBreakpoint,
  removeBreakpoint,
} from "./breakpoints.js";

// --- 7. Recipes, Shorthands & Utility Macros ---
export { recipe } from "./recipe.js";
export { helpers } from "./utils/helpers.js";
export {
  shorthandMap,
  macros,
  handleShorthand,
  isShorthand,
  expandShorthand,
  getAvailableShorthands,
} from "./utils/shorthands.js";

// --- 8. Timeline & Debug Diagnostics ---
export {
  enableTimeline,
  getStyleHistory,
  getStyleChanges,
  getStyleDiff,
  exportTimeline,
  clearTimeline,
} from "@adapters/cli/utils/timeline.js";

// --- 9. Animation System & Presets ---
export {
  animationPresets,
  createAnimation,
  getAnimationPreset,
  hasAnimationPreset,
  getAnimationPresetNames,
} from "./animations.js";

// --- 10. Intelligence & CLI Suggestion Engine ---
export {
  getSuggestion,
  getSuggestions,
  getPropertySuggestion,
  getShorthandSuggestion,
} from "./utils/suggestions.js";

export { math } from "./math-engine.js";

// Note: component-gen.ts is intentionally not exported as it's deprecated.
// Use the component generation in btt.ts instead.
