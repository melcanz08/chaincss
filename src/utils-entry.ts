// src/utils-entry.ts

// chaincss/utils - Utility functions
// Usage: import { formatCSS, kebabCase } from 'chaincss/utils'

export {
  // String utilities
  hashString,
  kebabCase,
  camelCase,
  pascalCase,
  snakeCase,
  generateClassName,
  generateAtomicClassName,
  generateComponentClassName,

  // Object utilities
  deepMerge,
  deepClone,
  deepEqual,
  pick,
  omit,

  // Formatting
  formatCSS,
  formatJS,
  truncate,
  indent,
  stripIndent,

  // Array utilities
  unique,
  chunk,
  groupBy,

  // Function utilities
  debounce,
  throttle,

  // Error handling
  ChainCSSError,
  tryOrWarn,
  tryOrThrow,

  // Logging
  setLogLevel,
  logDebug,
  logInfo,
  logWarn,
  logError,

  // Validation
  isValidSelector,
  isValidClassName,
  isValidCSSProperty,

  // Runtime utilities
  generateStyleId,
  isBrowser,
  isDevelopment,
  isProduction,
  memoize,
  cn as cnUtils,
  devWarn,
  devLog,
  createDebugger,
} from "@shared/utils/browser.js";

// Shorthand utilities
export {
  shorthandMap,
  macros,
  handleShorthand,
  isShorthand,
  expandShorthand,
  getAvailableShorthands,
} from "@compiler/utils/shorthands.js";

export { helpers } from "@compiler/utils/helpers.js";

export {
  getSuggestion,
  getSuggestions,
  getPropertySuggestion,
} from "@compiler/utils/suggestions.js";

export {
  animationPresets,
  createAnimation,
  getAnimationPreset,
  hasAnimationPreset,
  getAnimationPresetNames,
} from "@compiler/animations.js";

export { setBreakpoints, currentBreakpoints } from "@compiler/breakpoints.js";

export { ChainCSSPrefixer } from "@compiler/prefixer.js";

export {
  generateComponentCode,
  detectFramework,
} from "@compiler/features/framework-codegen.js";
