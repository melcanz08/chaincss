// src/runtime/index.ts

// Core runtime
export { compileRuntime as compile, runRuntime as run, styleInjector } from './injector.js';
export { chain, chain as $ } from '../core/style-collector.js';
export { setManifest } from './injector.js';

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

// ==========================================================================
// Vue — Lazy-loaded via dynamic import (ESM-safe)
// ==========================================================================

let _vueModule: any = null;
let _vueLoadPromise: Promise<any> | null = null;

function getVueModule(): Promise<any> {
  if (_vueModule) return Promise.resolve(_vueModule);
  if (!_vueLoadPromise) {
    _vueLoadPromise = (async () => {
      try {
        const hasVue = typeof window !== 'undefined' && !!(window as any).__VUE__;
        if (!hasVue) {
          _vueModule = {};
          return _vueModule;
        }
        _vueModule = await import('./vue.js');
        return _vueModule;
      } catch {
        _vueModule = {};
        return _vueModule;
      }
    })();
  }
  return _vueLoadPromise;
}

async function callVueExport(name: string, ...args: any[]): Promise<any> {
  const mod = await getVueModule();
  const fn = mod[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
}

export const useAtomicClassesVue = (...args: any[]) => callVueExport('useAtomicClasses', ...args);
export const useComputedStylesVue = (...args: any[]) => callVueExport('useComputedStyles', ...args);
export const provideStyleContext = (...args: any[]) => callVueExport('provideStyleContext', ...args);
export const injectStyleContext = (...args: any[]) => callVueExport('injectStyleContext', ...args);

// Sync stubs for components (React-style JSX usage)
export const ChainCSSGlobalVue = (..._args: any[]) => null;
export const createStyledVueComponent = (..._args: any[]) => () => null;
export const createStyledVueComponents = (..._args: any[]) => ({});

// ==========================================================================
// Svelte — Lazy-loaded via dynamic import (ESM-safe)
// ==========================================================================

let _svelteModule: any = null;
let _svelteLoadPromise: Promise<any> | null = null;

function getSvelteModule(): Promise<any> {
  if (_svelteModule) return Promise.resolve(_svelteModule);
  if (!_svelteLoadPromise) {
    _svelteLoadPromise = import('./svelte.js')
      .then(mod => { _svelteModule = mod; return mod; })
      .catch(() => { _svelteModule = {}; return _svelteModule; });
  }
  return _svelteLoadPromise;
}

async function callSvelteExport(name: string, ...args: any[]): Promise<any> {
  const mod = await getSvelteModule();
  const fn = mod[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
}

export const useAtomicClassesSvelte = (...args: any[]) => callSvelteExport('useAtomicClasses', ...args);
export const cxSvelte = (...args: any[]) => callSvelteExport('cx', ...args);
export const useComputedStylesSvelte = (...args: any[]) => callSvelteExport('useComputedStyles', ...args);
export const provideStyleContextSvelte = (...args: any[]) => callSvelteExport('provideStyleContext', ...args);
export const injectStyleContextSvelte = (...args: any[]) => callSvelteExport('injectStyleContext', ...args);
export const chainStyles = (...args: any[]) => callSvelteExport('chainStyles', ...args);

// Sync stubs for components (React-style JSX usage)
export const ChainCSSGlobalSvelte = (..._args: any[]) => null;
export const createStyledSvelteComponent = (..._args: any[]) => () => null;
export const createStyledSvelteComponents = (..._args: any[]) => ({});

// ==========================================================================
// Utilities
// ==========================================================================

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

// ==========================================================================
// Auto-inject styles into DOM
// ==========================================================================

/**
 * Inject styles into the DOM using the unified compileToCSS compiler.
 * This replaces the old hand-rolled CSS builder that didn't understand
 * media queries, at-rules, or nested selectors properly.
 */
export function injectChainStyles(styles: Record<string, any>) {
  const { compileToCSS } = require('../core/style-compiler.js');
  let css = '';

  for (const [key, obj] of Object.entries(styles)) {
    if (!obj || !obj.selectors) continue;
    css += compileToCSS(obj, { scopeSelector: '.' + obj.selectors[0] }) + '\n';
  }

  if (!css.trim()) return null;

  const el = document.createElement('style');
  el.setAttribute('data-chaincss', 'runtime');
  el.textContent = css;
  document.head.appendChild(el);

  console.log('⛓️ ChainCSS — ' + Object.keys(styles).length + ' styles injected | CSS: ' + css.length + ' bytes | smartChain auto-detect active');

  return el;
}