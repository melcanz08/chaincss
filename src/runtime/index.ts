// src/runtime/index.ts

// Core runtime
export { compileRuntime as compile, runRuntime as run, styleInjector } from './injector.js';
export { chain, chain as $ } from '../core/style-collector.js';
export { setManifest } from './injector.js';

// ==========================================================================
// React — Direct re-export (synchronous for React hooks)
// ==========================================================================

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
    _vueLoadPromise = import('./vue.js')
      .then(mod => { _vueModule = mod; return mod; })
      .catch(() => { _vueModule = {}; return _vueModule; });
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

// Sync stubs
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

// Sync stubs
export const ChainCSSGlobalSvelte = (..._args: any[]) => null;
export const createStyledSvelteComponent = (..._args: any[]) => () => null;
export const createStyledSvelteComponents = (..._args: any[]) => ({});

// ==========================================================================
// SolidJS — Lazy-loaded via dynamic import (ESM-safe)
// ==========================================================================

let _solidModule: any = null;
let _solidLoadPromise: Promise<any> | null = null;

function getSolidModule(): Promise<any> {
  if (_solidModule) return Promise.resolve(_solidModule);
  if (!_solidLoadPromise) {
    _solidLoadPromise = import('./solid.js')
      .then(mod => { _solidModule = mod; return mod; })
      .catch(() => { _solidModule = {}; return _solidModule; });
  }
  return _solidLoadPromise;
}

async function callSolidExport(name: string, ...args: any[]): Promise<any> {
  const mod = await getSolidModule();
  const fn = mod[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
}

export const useChainStylesSolid = (...args: any[]) => callSolidExport('useChainStyles', ...args);
export const useComputedStylesSolid = (...args: any[]) => callSolidExport('useComputedStyles', ...args);
export const createStyledComponentSolid = (...args: any[]) => callSolidExport('createStyledComponent', ...args);
export const cxSolid = (...args: any[]) => callSolidExport('cxSolid', ...args);
export const createStyleContext = (...args: any[]) => callSolidExport('createStyleContext', ...args);

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