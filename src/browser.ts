// Lightweight browser-only entry for vanilla JS
// No React, Vue, Svelte, HMR, or Node.js deps
export { chain, createChain, enableDebug, setTokenContext, getTokenContext } from './compiler/Chain.js';
export { $, $t, chain as runtimeChain, setManifest, setTokens } from './runtime/Chain.js';
export { smartChain, buildChain, runtimeChain as smartRuntimeChain } from './core/smart-chain.js';
export { shorthandMap, macros, getAvailableShorthands } from './compiler/shorthands.js';
export { animationPresets, createAnimation, getAnimationPreset, getAnimationPresetNames } from './compiler/animations.js';
export { helpers } from './compiler/helpers.js';
export { injectChainStyles, inspectSplit } from './runtime/index.js';
