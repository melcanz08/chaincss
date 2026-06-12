// src/index.ts

/**
 * ChainCSS - Zero-runtime CSS-in-JS with Atomic CSS optimization
 */

// ============================================================================
// Core API — The one chain to rule them all
// ============================================================================

export { chain, StyleCollector } from './core/style-collector.js';
export type { StyleObject, AtRule, NestedRule, Explanation } from './core/style-collector.js';

export { compileToCSS, partitionForBuild } from './core/style-compiler.js';
export type { CompileOptions, CompileResult } from './core/style-compiler.js';

export { classifyValue, partitionStyles, hasDynamicValues } from './core/value-classifier.js';
export type { ValueClass } from './core/value-classifier.js';

// Default export
export { default } from './core/style-collector.js';

// ============================================================================
// Compiler (Build-time CSS generation)
// ============================================================================

export { ChainCSSCompiler, compileChainCSS } from './core/compiler.js';

// ============================================================================
// Runtime Injection (Browser)
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
// Shorthands & Macros
// ============================================================================

export {
  shorthandMap,
  macros,
  handleShorthand,
  isShorthand,
  expandShorthand,
  getAvailableShorthands
} from './compiler/shorthands.js';

// ============================================================================
// Design Tokens
// ============================================================================

export { DesignTokens, createTokens } from './compiler/tokens.js';
export type { TokensStructure } from './compiler/tokens.js';

// ============================================================================
// Theme Contracts
// ============================================================================

export {
  createThemeContract,
  validateTheme,
  createTheme,
  Theme
} from './compiler/theme-contract.js';
export type { ThemeContract, ThemeTokens } from './compiler/theme-contract.js';

// ============================================================================
// Atomic Optimizer
// ============================================================================

export { AtomicOptimizer } from './compiler/atomic-optimizer.js';
export type {
  AtomicClass,
  AtomicOptimizerOptions,
  AtomicOptimizerStats
} from './compiler/atomic-optimizer.js';

// ============================================================================
// CSS Prefixer
// ============================================================================

export { ChainCSSPrefixer } from './compiler/prefixer.js';
export type { PrefixerConfig, PrefixerResult } from './compiler/prefixer.js';

// ============================================================================
// Animations
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
// Multi-Pass Optimization Pipeline
// ============================================================================

export {
  PassManager,
  runDefaultPipeline,
  DEFAULT_PIPELINE,
  intentRecoveryPass,
  unitResolutionPass,
  validationPass,
  specificitySortPass,
  deadEliminationPass,
  atomicExtractionPass,
  mediaQueryPackingPass,
  cssIfTranspilePass,
  cssCompressionPass,
  diagnosticsExportPass,
} from './compiler/pass-manager.js';
export type { PassName, PassPriority, PassDefinition, PassResult, PipelineResult } from './compiler/pass-manager.js';

// ============================================================================
// Style IR System
// ============================================================================

export {
  styleIR,
  createIR,
  parseIR,
  generateCSS,
  createRule,
  createDeclaration,
  applyPass,
  applyPasses,
  compileViaIR,
  countNodes,
  debugIR,
  resetIdCounter,
} from './compiler/style-ir.js';
export type {
  StyleIR,
  IRRule,
  IRDeclaration,
  IRPseudoClass,
  IRAtRule,
  IRCondition,
  IRTransformRecord,
  IRDiagnostic,
  IRNodeId,
  SourceLocation,
  IRPass,
} from './compiler/style-ir.js';

// ============================================================================
// Style Graph Compiler
// ============================================================================

export {
  StyleGraphCompiler,
  compileGraph
} from './compiler/style-graph.js';
export type {
  StyleGraph,
  StyleGraphNode,
  StyleGraphEdge,
  GraphCompileOptions,
  GraphCompileResult
} from './compiler/style-graph.js';

// ============================================================================
// Cache Management
// ============================================================================

export { CacheManager } from './compiler/cache-manager.js';
export { PersistentCache } from './compiler/content-addressable-cache.js';

// ============================================================================
// Design Orchestrator
// ============================================================================

export {
  orchestrator,
  contrastRatio,
  checkContrast,
  auditContrast,
  createContextualToken,
  resolveContextual,
  generateContextualCSS,
  validateTokenRelationships,
} from './compiler/design-orchestrator.js';
export type { ContrastResult, ContrastReport, ContextualToken, TokenContext } from './compiler/design-orchestrator.js';

// ============================================================================
// Math Engine
// ============================================================================

export {
  math,
  add,
  subtract,
  multiply,
  divide,
  fluidType,
  convert,
  toPx,
  scale
} from './compiler/math-engine.js';
export type {
  CSSUnit,
  CSSMathValue,
  MathContext,
  MathResult,
  FluidTypeConfig
} from './compiler/math-engine.js';

// ============================================================================
// Intent Engine
// ============================================================================

export {
  intent,
  correct,
  heal,
  validate as validateValue,
  getIntent
} from './compiler/intent-engine.js';
export type {
  CorrectionResult,
  HealMode,
  HealResult,
  IntentContext
} from './compiler/intent-engine.js';

// ============================================================================
// Helpers & Utilities
// ============================================================================

export { helpers } from './compiler/helpers.js';
export { getSuggestion, getSuggestions, getPropertySuggestion } from './compiler/suggestions.js';

// ============================================================================
// Recipe System
// ============================================================================

export { recipe } from './compiler/recipe.js';
export type { RecipeOptions, Recipe } from './compiler/recipe.js';

// ============================================================================
// Component Generator
// ============================================================================

export { generateComponentCode, detectFramework } from './compiler/component-generator.js';
export type { ComponentInfo } from './compiler/component-generator.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '2.4.0';