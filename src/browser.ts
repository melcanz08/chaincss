// chaincss/src/browser.ts — Minimal browser entry
// Zero Node.js dependencies — safe for Vite/webpack browser bundles

export { chain } from './core/style-collector.js';
export { injectChainStyles } from './runtime/index.js';
export { VERSION } from './core/constants.js';
export { shorthandMap, macros, getAvailableShorthands } from './compiler/utils/shorthands.js';
