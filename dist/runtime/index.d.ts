/**
 * ChainCSS Runtime Module
 *
 * WARNING: Importing from this module adds ~3.2KB to your bundle.
 * For production, use build-time compilation with chaincss/plugin/vite instead.
 */
export { compileRuntime as compile, runRuntime as run, styleInjector } from './injector.js';
export { $, $t, chain, setManifest } from './Chain.js';
export { useChainStyles, useDynamicChainStyles, useThemeChainStyles, ChainCSSGlobal, cx, withChainStyles, enableChainCSSDebug, disableChainCSSDebug, isDebugEnabled, createStyledComponent, useComputedStyles } from './react.js';
export declare const useAtomicClassesVue: (...args: any[]) => Promise<any>;
export declare const ChainCSSGlobalVue: (props: any) => null;
export declare const createStyledVueComponent: (...args: any[]) => (...a: any[]) => null;
export declare const createStyledVueComponents: (...args: any[]) => {};
export declare const useComputedStylesVue: (...args: any[]) => {};
export declare const provideStyleContext: (...args: any[]) => void;
export declare const injectStyleContext: (...args: any[]) => {};
export declare const useAtomicClassesSvelte: (...args: any[]) => any;
export declare const cxSvelte: (...args: any[]) => any;
export declare const ChainCSSGlobalSvelte: (props: any) => any;
export declare const createStyledSvelteComponent: (...args: any[]) => any;
export declare const createStyledSvelteComponents: (...args: any[]) => any;
export declare const useComputedStylesSvelte: (...args: any[]) => any;
export declare const provideStyleContextSvelte: (...args: any[]) => any;
export declare const injectStyleContextSvelte: (...args: any[]) => any;
export declare const chainStyles: (...args: any[]) => any;
export { setupHMR, registerForHMR } from './hmr.js';
export { generateStyleId, hashString, kebabCase, isBrowser, isDevelopment, isProduction, debounce, memoize, cn as cnUtils, devWarn, devLog, logError, createDebugger } from './utils.js';
export type { RuntimeStyleDefinition, UseChainStylesOptions, RuntimeCompiledResult, StyleInjector, UseAtomicClassesReturn, HMRPayload, ChainCSSDebugger } from './types.js';
export declare function injectChainStyles(styles: Record<string, any>): HTMLStyleElement;
