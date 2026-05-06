// chaincss/src/index.ts --- Main exports for ChainCSS

/**
 * ChainCSS - Zero-runtime CSS-in-JS with Atomic CSS optimization
 * @packageDocumentation
 */

// ============================================================================
// 🆕 NEW: Smart Chain API (Auto-detection mixed mode)
// ============================================================================
export { smartChain, smartChain as chainV3, buildChain, runtimeChain } from './core/smart-chain.js';
export { autoDetector, AutoDetector, type ValueType, type Mode } from './core/auto-detector.js';

// ============================================================================
// 🆕 NEW: React Hooks with Auto-Detection
// ============================================================================
export { useSmartStyles, createSmartComponent, withSmartStyles } from './runtime/auto-hooks.js';

// ============================================================================
// Core Compiler (unchanged - keep for backward compatibility)
// ============================================================================
export { ChainCSSCompiler, compileChainCSS } from './core/compiler.js';

// ============================================================================
// Chain API - Main entry point for style definitions (unchanged)
// ============================================================================
export { 
  chain, 
  chain as $,           // Alias for convenience
  recipe,               // Variant system
  createTokens,         // Design token creation
  configureAtomic,      // Atomic CSS configuration
  tokens,               // Default token instance
  enableDebug,          // Debug mode
  setBreakpoints,       // Responsive breakpoints
  enableTimeline,       // Style timeline tracking
  getStyleHistory,      // Timeline history
  getStyleChanges,      // Timeline changes
  getStyleDiff,         // Timeline diff
  exportTimeline,       // Export timeline
  clearTimeline         // Clear timeline
} from './compiler/btt.js';

// ============================================================================
// Atomic Optimizer (unchanged)
// ============================================================================
export { AtomicOptimizer } from './compiler/atomic-optimizer.js';

// ============================================================================
// CSS Prefixer (Autoprefixer alternative) (unchanged)
// ============================================================================
export { ChainCSSPrefixer } from './compiler/prefixer.js';

// ============================================================================
// Design Tokens System (unchanged)
// ============================================================================
export { DesignTokens, createTokens as createDesignTokens } from './compiler/tokens.js';

// ============================================================================
// Theme Contract System (unchanged)
// ============================================================================
export { 
  createThemeContract, 
  validateTheme, 
  createTheme, 
  Theme 
} from './compiler/theme-contract.js';

// ============================================================================
// Cache Management (unchanged)
// ============================================================================
export { CacheManager } from './compiler/cache-manager.js';
export { PersistentCache } from './compiler/content-addressable-cache.js';

// ============================================================================
// Shorthands & Macros (unchanged)
// ============================================================================
export { shorthandMap, macros, handleShorthand, isShorthand, expandShorthand, getAvailableShorthands } from './compiler/shorthands.js';

// ============================================================================
// Helpers & Utilities (unchanged)
// ============================================================================
export { helpers } from './compiler/helpers.js';
export { animationPresets, createAnimation, getAnimationPreset, hasAnimationPreset, getAnimationPresetNames } from './compiler/animations.js';
export { getSuggestion, getSuggestions, getPropertySuggestion, getShorthandSuggestion } from './compiler/suggestions.js';

// ============================================================================
// Types - Core Types (unchanged)
// ============================================================================
export type {
  StyleDefinition,
  AtRule,
  NestedRule,
  ThemeBlock,
  Recipe,
  RecipeOptions,
  ChainObject
} from './compiler/btt.js';

// ============================================================================
// Types - Atomic Optimizer (unchanged)
// ============================================================================
export type {
  AtomicClass,
  AtomicOptimizerOptions,
  AtomicOptimizerStats,
  ComponentClassMapEntry,
  OptimizeResult
} from './compiler/atomic-optimizer.js';

// ============================================================================
// Types - Prefixer (unchanged)
// ============================================================================
export type {
  PrefixerConfig,
  PrefixerResult
} from './compiler/prefixer.js';

// ============================================================================
// Types - Theme Contract (unchanged)
// ============================================================================
export type {
  ThemeContract,
  ThemeTokens
} from './compiler/theme-contract.js';

export type { TokensStructure } from './compiler/tokens.js';

// ============================================================================
// Types - Configuration (unchanged)
// ============================================================================
export type {
  ChainCSSConfig,
  CompileResult,
  ChainCSSPlugin
} from './core/types.js';

// ============================================================================
// Types - Chain API (unchanged)
// ============================================================================
export type { Chain } from './compiler/Chain.js';

// ============================================================================
// Types - Animations (unchanged)
// ============================================================================
export type { AnimationConfig, KeyframeDefinition } from './compiler/animations.js';

// ============================================================================
// Types - Breakpoints (unchanged)
// ============================================================================
export type { BreakpointsMap, ResponsiveStyle } from './compiler/breakpoints.js';

// ============================================================================
// Runtime Exports (for runtime mode) - unchanged
// ============================================================================
export * from './runtime/index.js';

// ============================================================================
// Version - UPDATE to 3.0.0
// ============================================================================
export const VERSION = '3.0.0';

// ============================================================================
// Default Export - Keep original chain for backward compatibility
// ============================================================================
import { chain } from './compiler/Chain.js';
export default chain;

// ============================================================================
// 🆕 NEW: Smart Chain as alternative default (optional)
// ============================================================================
import { smartChain } from './core/smart-chain.js';

// ============================================================================
// Initialize global defaults (non-blocking) - unchanged
// ============================================================================
import { chains } from './compiler/btt.js';

if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
  chains.initializeProperties().catch((err: Error) => {
    if (process.env?.DEBUG) {
      console.warn('[ChainCSS] Failed to load CSS properties:', err.message);
    }
  });
}

// ============================================================================
// Re-export commonly used types for convenience (unchanged)
// ============================================================================
export type {
  Properties as CSSProperties
} from 'csstype';

export type TokenValue<T = string> = T | `$${string}`;

export type ResponsiveValue<T> = T | {
  base?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
  [key: string]: T | undefined;
};

export type StyleWithTokens<T = any> = T | ((tokens: DesignTokens) => T);

import { DesignTokens } from './compiler/tokens.js';