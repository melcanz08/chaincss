// src/core/interfaces/index.ts

// Core compiler

// Types
export type {
  ChainCSSConfig,
  CompileResult,
  StyleDefinition,
  AtomicClass,
  AtRule,
  NestedRule,
  ThemeBlock,
  ChainCSSPlugin,
} from "@shared/types/index.js";

// Constants
export {
  VERSION,
  DEFAULT_CONFIG,
  DEFAULT_BREAKPOINTS,
  NEVER_ATOMIC_PROPERTIES,
  ALWAYS_ATOMIC_PROPERTIES,
  NAMING_SCHEMES,
  ATOMIC_MODES,
  OUTPUT_STRATEGIES,
  PREFIXER_MODES,
  EXIT_CODES,
  LOG_LEVELS,
  PERFORMANCE,
  MEMORY,
  VALIDATION,
} from "@shared/constants/index.js";

// Utilities (all of them)
export {
  // Hashing & naming
  hashString,
  generateClassName,
  generateAtomicClassName,
  generateComponentClassName,

  // String conversion
  kebabCase,
  camelCase,
  pascalCase,
  snakeCase,

  // Formatting
  formatCSS,
  formatJS,
  truncate,
  indent,
  stripIndent,

  // Object manipulation
  deepMerge,
  deepClone,
  deepEqual,
  pick,
  omit,

  // Arrays
  unique,
  chunk,
  groupBy,

  // Performance
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

  // Memory
  getMemoryUsage,
  formatBytes,

  // Validation
  isValidSelector,
  isValidClassName,
  isValidCSSProperty,
} from "@shared/utils/index.js";

// Common utilities (shared with runtime)
export {
  processStyleObject,
  extractCSS,
  extractHoverCSS,
  mergeStyles,
  isValidCSSLength,
  isValidCSSColor,
  escapeSelector,
  cleanClassName,
  sortClassNames,
} from "@shared/utils/common-utils.js";

export { chain, StyleCollector } from "../entities/style-collector.js";
export { compileToCSS, partitionForBuild } from "../usecases/style-compiler.js";
export {
  classifyValue,
  partitionStyles,
  hasDynamicValues,
} from "../usecases/value-classifier.js";
