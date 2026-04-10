/**
 * ChainCSS Runtime Module
 *
 * WARNING: Importing from this module adds ~3.2KB to your bundle.
 * For production, use build-time compilation with chaincss/plugin/vite instead.
 */
export { chainRuntime as $, compileRuntime as compile, runRuntime as run, styleInjector } from './injector.js';
export { useChainStyles, useDynamicChainStyles, useThemeChainStyles, ChainCSSGlobal, cx, withChainStyles, enableChainCSSDebug, disableChainCSSDebug, isDebugEnabled, createStyledComponent, useComputedStyles } from './react.js';
export { useAtomicClasses, ChainCSSGlobal as ChainCSSGlobalVue, createStyledComponent as createStyledVueComponent, // This is fine - it renames
createStyledComponents as createStyledVueComponents, useComputedStyles as useComputedStylesVue, // This renames useComputedStyles
provideStyleContext, injectStyleContext } from './vue.js';
export { setupHMR, registerForHMR } from './hmr.js';
export { generateStyleId, hashString, kebabCase, isBrowser, isDevelopment, isProduction, debounce, memoize, cn as cnUtils, devWarn, devLog, logError, createDebugger } from './utils.js';
export type { RuntimeStyleDefinition, UseChainStylesOptions, RuntimeCompiledResult, StyleInjector, UseAtomicClassesReturn, HMRPayload, ChainCSSDebugger } from './types.js';
//# sourceMappingURL=index.d.ts.map