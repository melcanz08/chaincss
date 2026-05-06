/**
 * ChainCSS - Zero-runtime CSS-in-JS with Atomic CSS optimization
 * @packageDocumentation
 */
export { smartChain, smartChain as chainV3, buildChain, runtimeChain } from './core/smart-chain.js';
export { autoDetector, AutoDetector, type ValueType, type Mode } from './core/auto-detector.js';
export { useSmartStyles, createSmartComponent, withSmartStyles } from './runtime/auto-hooks.js';
export { ChainCSSCompiler, compileChainCSS } from './core/compiler.js';
export { chain, chain as $, // Alias for convenience
recipe, // Variant system
createTokens, // Design token creation
configureAtomic, // Atomic CSS configuration
tokens, // Default token instance
enableDebug, // Debug mode
setBreakpoints, // Responsive breakpoints
enableTimeline, // Style timeline tracking
getStyleHistory, // Timeline history
getStyleChanges, // Timeline changes
getStyleDiff, // Timeline diff
exportTimeline, // Export timeline
clearTimeline } from './compiler/btt.js';
export { AtomicOptimizer } from './compiler/atomic-optimizer.js';
export { ChainCSSPrefixer } from './compiler/prefixer.js';
export { DesignTokens, createTokens as createDesignTokens } from './compiler/tokens.js';
export { createThemeContract, validateTheme, createTheme, Theme } from './compiler/theme-contract.js';
export { CacheManager } from './compiler/cache-manager.js';
export { PersistentCache } from './compiler/content-addressable-cache.js';
export { shorthandMap, macros, handleShorthand, isShorthand, expandShorthand, getAvailableShorthands } from './compiler/shorthands.js';
export { helpers } from './compiler/helpers.js';
export { animationPresets, createAnimation, getAnimationPreset, hasAnimationPreset, getAnimationPresetNames } from './compiler/animations.js';
export { getSuggestion, getSuggestions, getPropertySuggestion, getShorthandSuggestion } from './compiler/suggestions.js';
export type { StyleDefinition, AtRule, NestedRule, ThemeBlock, Recipe, RecipeOptions, ChainObject } from './compiler/btt.js';
export type { AtomicClass, AtomicOptimizerOptions, AtomicOptimizerStats, ComponentClassMapEntry, OptimizeResult } from './compiler/atomic-optimizer.js';
export type { PrefixerConfig, PrefixerResult } from './compiler/prefixer.js';
export type { ThemeContract, ThemeTokens } from './compiler/theme-contract.js';
export type { TokensStructure } from './compiler/tokens.js';
export type { ChainCSSConfig, CompileResult, ChainCSSPlugin } from './core/types.js';
export type { Chain } from './compiler/Chain.js';
export type { AnimationConfig, KeyframeDefinition } from './compiler/animations.js';
export type { BreakpointsMap, ResponsiveStyle } from './compiler/breakpoints.js';
export * from './runtime/index.js';
export declare const VERSION = "3.0.0";
import { chain } from './compiler/Chain.js';
export default chain;
export type { Properties as CSSProperties } from 'csstype';
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
