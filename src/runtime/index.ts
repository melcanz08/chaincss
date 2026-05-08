// chaincss/src/runtime/index.ts

/**
 * ChainCSS Runtime Module
 * 
 * WARNING: Importing from this module adds ~3.2KB to your bundle.
 * For production, use build-time compilation with chaincss/plugin/vite instead.
 */

// Core runtime
export { compileRuntime as compile, runRuntime as run, styleInjector } from './injector.js';
export { $, $t, chain, setManifest } from './Chain.js';

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

// Vue composables — lazy stubs (only load vue.js when called)
const _lazyVue = () => import('./vue.js');
export const useAtomicClassesVue = (...args: any[]) => _lazyVue().then((m: any) => m.useAtomicClasses(...args as any[]));
export const ChainCSSGlobalVue = (props: any) => { _lazyVue(); return null; };
export const createStyledVueComponent = (...args: any[]) => (...a: any[]) => { _lazyVue(); return null; };
export const createStyledVueComponents = (...args: any[]) => { _lazyVue(); return {}; };
export const useComputedStylesVue = (...args: any[]) => { _lazyVue(); return {}; };
export const provideStyleContext = (...args: any[]) => { _lazyVue(); };
export const injectStyleContext = (...args: any[]) => { _lazyVue(); return {}; };

// Svelte — loaded lazily
let _svelteExports: any = null;
function getSvelteExports() {
  if (!_svelteExports) {
    try {
      _svelteExports = require('./svelte.js');
    } catch(e) {
      _svelteExports = {};
    }
  }
  return _svelteExports;
}
export const useAtomicClassesSvelte = (...args: any[]) => getSvelteExports().useAtomicClasses?.(...args);
export const cxSvelte = (...args: any[]) => getSvelteExports().cx?.(...args);
export const ChainCSSGlobalSvelte = (props: any) => getSvelteExports().ChainCSSGlobal?.(props);
export const createStyledSvelteComponent = (...args: any[]) => getSvelteExports().createStyledComponent?.(...args);
export const createStyledSvelteComponents = (...args: any[]) => getSvelteExports().createStyledComponents?.(...args);
export const useComputedStylesSvelte = (...args: any[]) => getSvelteExports().useComputedStyles?.(...args);
export const provideStyleContextSvelte = (...args: any[]) => getSvelteExports().provideStyleContext?.(...args);
export const injectStyleContextSvelte = (...args: any[]) => getSvelteExports().injectStyleContext?.(...args);
export const chainStyles = (...args: any[]) => getSvelteExports().chainStyles?.(...args);

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
// Auto-inject styles into DOM
export function injectChainStyles(styles: Record<string, any>) {
  let css = '';

  for (const [key, obj] of Object.entries(styles)) {
    if (!obj || !obj.selectors) continue;
    
    const sel = '.' + obj.selectors[0];
    css += sel + '{';
    for (const [k, v] of Object.entries(obj)) {
      if (['selectors','hover','atRules','nestedRules','_name','_classes'].includes(k)) continue;
      css += k.replace(/([A-Z])/g,'-$1').toLowerCase() + ':' + v + ';';
    }
    css += '}';
    if (obj.hover) {
      css += sel + ':hover{';
      for (const [k, v] of Object.entries(obj.hover)) css += k.replace(/([A-Z])/g,'-$1').toLowerCase() + ':' + v + ';';
      css += '}';
    }
    if (obj.nestedRules) {
      for (const rule of obj.nestedRules) {
        css += rule.selector.replace('&', sel) + '{';
        for (const [k, v] of Object.entries(rule.styles || {})) css += k.replace(/([A-Z])/g,'-$1').toLowerCase() + ':' + v + ';';
        css += '}';
      }
    }
  }
  const el = document.createElement('style');
  el.setAttribute('data-chaincss', 'runtime');
  el.textContent = css;
  document.head.appendChild(el);
  
  // Show split stats in console
  console.log('⛓️ ChainCSS — ' + Object.keys(styles).length + ' styles injected | CSS: ' + css.length + ' bytes | smartChain auto-detect active');
  
  return el;
}
