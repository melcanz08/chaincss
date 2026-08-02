// chaincss/src/browser.ts — Minimal browser entry
// Zero Node.js dependencies — safe for Vite/webpack browser bundles

export { chain } from "@core/entities/style-collector.js";
export { injectChainStyles } from "@frameworks/index.js";
export { VERSION } from "@shared/constants/index.js";
export {
  shorthandMap,
  macros,
  getAvailableShorthands,
} from "@compiler/utils/shorthands.js";
