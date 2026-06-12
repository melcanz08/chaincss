/**
 * ChainCSS Browser Entry
 * Safe for client-side use — no Node.js dependencies.
 */
export { chain, StyleCollector } from './core/style-collector.js';
export { compileToCSS, partitionForBuild } from './core/style-compiler.js';
export { classifyValue, partitionStyles, hasDynamicValues } from './core/value-classifier.js';
export { shorthandMap, macros, getAvailableShorthands } from './compiler/shorthands.js';
export { helpers } from './compiler/helpers.js';
export { animationPresets, createAnimation, getAnimationPreset } from './compiler/animations.js';
export { DesignTokens, createTokens } from './compiler/tokens.js';
export { recipe } from './compiler/recipe.js';
export { styleInjector, setTokens, compileRuntime } from './runtime/injector.js';
export const VERSION = '2.4.0';
