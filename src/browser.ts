// ============================================================================
// FILE: src/browser.ts — Minimal browser entry
// Zero Node.js dependencies — safe for Vite/webpack browser bundles
// ============================================================================

export { chain } from "@frameworks/core/browser-style-collector.js";
export { 
  compileToCSSBrowser as compileToCSS,
  runBrowser as run,
  transpileBrowser as transpile,
  injectCSS as injectToDOM,
} from "@frameworks/core/browser-safe-compiler.js";
export { VERSION } from "@shared/constants/index.js";
export {
  macros,
  getAvailableShorthands,
} from "@compiler/utils/shorthands.js";