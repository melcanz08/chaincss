// src/utils.ts

/**
 * ChainCSS Utilities
 * 
 * Convenience entry point for shorthands, macros, helpers,
 * suggestions, animations, breakpoints, and framework codegen.
 * 
 * import { helpers, macros, getSuggestion } from 'chaincss/utils'
 */

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
// Math & Color Helpers
// ============================================================================

export { helpers } from './compiler/utils/helpers.js';

// ============================================================================
// Property Suggestions
// ============================================================================

export {
  getSuggestion,
  getSuggestions,
  getPropertySuggestion
} from './compiler/utils/suggestions.js';

// ============================================================================
// Animation Presets
// ============================================================================

export {
  animationPresets,
  createAnimation,
  getAnimationPreset,
  hasAnimationPreset,
  getAnimationPresetNames
} from './compiler/animations.js';
export type { AnimationConfig, KeyframeDefinition } from './compiler/animations.js';

// ============================================================================
// Breakpoints
// ============================================================================

export { setBreakpoints, currentBreakpoints } from './compiler/breakpoints.js';
export type { BreakpointsMap, ResponsiveStyle } from './compiler/breakpoints.js';

// ============================================================================
// Vendor Prefixing
// ============================================================================

export { ChainCSSPrefixer } from './compiler/prefixer.js';
export type { PrefixerConfig, PrefixerResult } from './compiler/prefixer.js';

// ============================================================================
// Framework Codegen
// ============================================================================

export { generateComponentCode, detectFramework } from './compiler/features/framework-codegen.js';
export type { ComponentInfo } from './compiler/features/framework-codegen.js';
