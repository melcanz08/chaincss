// chaincss/src/browser.ts
export { VERSION } from "./index.js";

// Browser-only entry for ChainCSS hybrid mode
// Zero Node.js dependencies — safe for Vite/webpack browser bundles

// Core chain API from compiler
export { chain } from './core/style-collector.js';

// Runtime chain

// Smart chain (auto-detection hybrid mode)

// Runtime injection
export { injectChainStyles } from './runtime/index.js';

// Shorthands & macros
export { shorthandMap, macros, getAvailableShorthands } from './compiler/utils/shorthands.js';

// Helpers
export { helpers } from './compiler/utils/helpers.js';

// Intent API (v2.3)
export { intentAPI, resolveIntent, getAvailableIntents, getIntentsByCategory, getIntentDescription } from './compiler/legacy/intent-api.js';

// Semantic tokens (v2.3)
export { semanticTokens, resolveSemantic, getSemanticIntents, getSemanticDescription } from './compiler/legacy/semantic-tokens.js';

// Math engine
export { math, add, subtract, multiply, divide, fluidType, convert } from './compiler/math-engine.js';

// Intent engine / self-healing
export { intent, correct, heal } from './compiler/pipeline/normalizers/intent-detector.js';

// Animations
export { animationPresets, createAnimation, getAnimationPreset, getAnimationPresetNames } from './compiler/animations.js';

// Types
