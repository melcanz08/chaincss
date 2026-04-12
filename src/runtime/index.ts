// chaincss/src/runtime/index.ts

/**
 * ChainCSS Runtime Module
 * 
 * WARNING: Importing from this module adds ~3.2KB to your bundle.
 * For production, use build-time compilation with chaincss/plugin/vite instead.
 */

// Core runtime
export { $, compileRuntime as compile, runRuntime as run, styleInjector } from './injector.js';

// React hooks
export {
  useChainStyles,
  useDynamicChainStyles,
  useThemeChainStyles,
  ChainCSSGlobal,
  cx,
  withChainStyles,
  enableChainCSSDebug,
  disableChainCSSDebug,
  isDebugEnabled,
  createStyledComponent,
  useComputedStyles
} from './react.js';

// Vue composables
export {
  useAtomicClasses,
  ChainCSSGlobal as ChainCSSGlobalVue,
  createStyledComponent as createStyledVueComponent,  // This is fine - it renames
  createStyledComponents as createStyledVueComponents,
  useComputedStyles as useComputedStylesVue,  // This renames useComputedStyles
  provideStyleContext,
  injectStyleContext
} from './vue.js';

// HMR
export { setupHMR, registerForHMR } from './hmr.js';

// Utilities
export {
  generateStyleId,
  hashString,
  kebabCase,
  isBrowser,
  isDevelopment,
  isProduction,
  debounce,
  memoize,
  cn as cnUtils,
  devWarn,
  devLog,
  logError,
  createDebugger
} from './utils.js';

// Types
export type {
  RuntimeStyleDefinition,
  UseChainStylesOptions,
  RuntimeCompiledResult,
  StyleInjector,
  UseAtomicClassesReturn,
  HMRPayload,
  ChainCSSDebugger
} from './types.js';