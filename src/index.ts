// chaincss - Main entry point (minimal)
// Usage: import { chain, defineConfig } from 'chaincss'

// Core exports
export { VERSION } from "./shared/constants/index.js";
export { StyleCollector, chain } from "@core/entities/style-collector.js";
export type {
  StyleObject,
  AtRule,
  NestedRule,
} from "@core/entities/style-collector.js";

// Config
export { defineConfig } from "@shared/config/index.js";
export type { ChainCSSUserConfig, MacroHandler } from "@shared/config/index.js";

// Types
export type {
  StyleDefinition,
  ChainShorthandMethods,
  CompileResult,
  GraphCompileResult,
  CorrectionResult,
  MathResult,
  ChainCSSPlugin,
  ChainCSSPluginOptions,
} from "@shared/types/index.js";

// Shorthand types (from shorthand-types.ts)
export type {
  GridOptions,
  FlexOptions,
  AnimationOptions,
  BackgroundOptions,
  TypographyOptions,
  BoxOptions,
  PositionOptions,
  TransitionOptions,
  TransformOptions,
  FilterOptions,
  ShadowOptions,
  ContainerOptions,
  OutlineOptions,
  ScrollOptions,
  ListOptions,
} from "@shared/types/shorthand-types.js";

// Value Classifier (runtime-safe)
export {
  classifyValue,
  partitionStyles,
  hasDynamicValues,
} from "@core/usecases/value-classifier.js";
export type { ValueClass } from "@core/usecases/value-classifier.js";

// Utilities (browser-safe only)
export {
  hashString,
  kebabCase,
  camelCase,
  pascalCase,
  snakeCase,
  generateClassName,
  generateAtomicClassName,
  generateComponentClassName,
  deepMerge,
  deepClone,
  deepEqual,
  pick,
  omit,
  formatCSS,
  formatJS,
  truncate,
  indent,
  stripIndent,
  unique,
  chunk,
  groupBy,
  debounce,
  throttle,
  ChainCSSError,
  tryOrWarn,
  tryOrThrow,
  setLogLevel,
  logDebug,
  logInfo,
  logWarn,
  logError,
  isValidSelector,
  isValidClassName,
  isValidCSSProperty,
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
