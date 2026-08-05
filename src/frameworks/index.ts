// src/frameworks/index.ts — ChainCSS Runtime

import { devWarn } from "@shared/utils/index.js";

// Core runtime
export {
  compileRuntime as compile,
  runRuntime as run,
  styleInjector,
} from "./core/injector.js";
import { compileToCSS } from "@core/usecases/style-compiler.js";
export { chain, chain as $ } from "@core/entities/style-collector.js";
export { setManifest } from "./core/injector.js";

// ==========================================================================
// React — Direct re-export
// ==========================================================================

export {
  useChainStyles,
  useChainStylesApplied,
  useDynamicChainStyles,
  ChainCSSGlobal,
  cx,
  withChainStyles,
  enableChainCSSDebug,
  disableChainCSSDebug,
  isDebugEnabled,
  createStyledComponent,
  createStyledComponents,
  useComputedStyles,
} from "./react/index.js";

// ==========================================================================
// Lazy Framework Loader — shared helper for Vue, Svelte, Solid
// ==========================================================================

function createLazyFrameworkLoader(moduleName: string) {
  let _module: any = null;
  let _loadPromise: Promise<any> | null = null;

  // Static lookup map so esbuild doesn't see a glob pattern
  const moduleLoaders: Record<string, () => Promise<any>> = {
    vue: () => import("./vue/index.js"),
    svelte: () => import("./svelte/index.js"),
    solid: () => import("./solid/index.js"),
  };

  async function loadModule(): Promise<any> {
    if (_module) return _module;
    if (!_loadPromise) {
      const loader = moduleLoaders[moduleName];
      if (!loader) {
        devWarn(
          `ChainCSS: Unknown framework "${moduleName}". Available: vue, svelte, solid.`,
        );
        _module = {};
        return _module;
      }
      _loadPromise = loader()
        .then((mod) => {
          _module = mod;
          return mod;
        })
        .catch((err) => {
          devWarn(
            `ChainCSS: Failed to load ${moduleName} adapter: ${err.message}`,
          );
          _module = {};
          return _module;
        });
    }
    return _loadPromise;
  }

  async function callExport(name: string, ...args: any[]): Promise<any> {
    const mod = await loadModule();
    const fn = mod[name];
    return typeof fn === "function" ? fn(...args) : undefined;
  }

  return { loadModule, callExport };
}

// ==========================================================================
// Vue 
// ==========================================================================

const vueLoader = createLazyFrameworkLoader("vue");

export const useChainStylesVue = (...args: any[]) =>
  vueLoader.callExport("useChainStyles", ...args);
export const useAtomicClassesVue = (...args: any[]) =>
  vueLoader.callExport("useAtomicClasses", ...args);
export const useComputedStylesVue = (...args: any[]) =>
  vueLoader.callExport("useComputedStyles", ...args);
export const provideStyleContext = (...args: any[]) =>
  vueLoader.callExport("provideStyleContext", ...args);
export const injectStyleContext = (...args: any[]) =>
  vueLoader.callExport("injectStyleContext", ...args);

// Sync stubs
export const ChainCSSGlobalVue = (..._args: any[]): null => {
  devWarn(
    "ChainCSSGlobalVue is a placeholder. The Vue adapter loads asynchronously. " +
    "Use the returned value from `await callVueExport('ChainCSSGlobal', ...args)` instead."
  );
  return null;
};
export const createStyledVueComponent = (..._args: any[]) => {
  devWarn(
    "createStyledVueComponent is a placeholder. The Vue adapter loads asynchronously. " +
    "Use `await callVueExport('createStyledComponent', ...args)` instead."
  );
  return () => null;
};
export const createStyledVueComponents = (..._args: any[]) => {
  devWarn(
    "createStyledVueComponents is a placeholder. The Vue adapter loads asynchronously."
  );
  return {};
};

// ==========================================================================
// Svelte
// ==========================================================================

const svelteLoader = createLazyFrameworkLoader("svelte");

export const useChainStylesSvelte = (...args: any[]) =>
  svelteLoader.callExport("useChainStyles", ...args);
export const useAtomicClassesSvelte = (...args: any[]) =>
  svelteLoader.callExport("useAtomicClasses", ...args);
export const cxSvelte = (...args: any[]) =>
  svelteLoader.callExport("cx", ...args);
export const useComputedStylesSvelte = (...args: any[]) =>
  svelteLoader.callExport("useComputedStyles", ...args);
export const provideStyleContextSvelte = (...args: any[]) =>
  svelteLoader.callExport("provideStyleContext", ...args);
export const injectStyleContextSvelte = (...args: any[]) =>
  svelteLoader.callExport("injectStyleContext", ...args);
export const chainStyles = (...args: any[]) =>
  svelteLoader.callExport("chainStyles", ...args);

export const ChainCSSGlobalSvelte = (..._args: any[]): null => {
  devWarn(
    "ChainCSSGlobalSvelte is a placeholder. The Svelte adapter loads asynchronously.",
  );
  return null;
};
export const createStyledSvelteComponent = (..._args: any[]) => {
  devWarn(
    "createStyledSvelteComponent is a placeholder. The Svelte adapter loads asynchronously.",
  );
  return () => null;
};
export const createStyledSvelteComponents = (..._args: any[]) => {
  devWarn(
    "createStyledSvelteComponents is a placeholder. The Svelte adapter loads asynchronously.",
  );
  return {};
};

// ==========================================================================
// SolidJS
// ==========================================================================

const solidLoader = createLazyFrameworkLoader("solid");

export const useChainStylesSolid = (...args: any[]) =>
  solidLoader.callExport("useChainStyles", ...args);
export const useComputedStylesSolid = (...args: any[]) =>
  solidLoader.callExport("useComputedStyles", ...args);
export const createStyledComponentSolid = (...args: any[]) =>
  solidLoader.callExport("createStyledComponent", ...args);
export const cxSolid = (...args: any[]) =>
  solidLoader.callExport("cx", ...args);
export const createStyleContext = (...args: any[]) =>
  solidLoader.callExport("createStyleContext", ...args);

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
  createDebugger,
} from "@shared/utils/index.js";

// Types
export type {
  RuntimeStyleDefinition,
  UseChainStylesOptions,
  UseChainStylesReturn,
  RuntimeCompiledResult,
  StyleInjector,
  UseAtomicClassesReturn,
  UseChainStylesReturnVue,
  UseChainStylesReturnSvelte,
  UseChainStylesReturnSolid,
  HMRPayload,
  ChainCSSDebugger,
} from "@shared/types/index.js";

// ==========================================================================
// Auto-inject styles into DOM
// ==========================================================================

export function injectChainStyles(styles: Record<string, any>) {
  let css = "";

  for (const [key, obj] of Object.entries(styles)) {
    if (!obj || !obj.selectors) continue;
    css += compileToCSS(obj, { scopeSelector: "." + obj.selectors[0] }) + "\n";
  }

  if (!css.trim()) return null;

  const el = document.createElement("style");
  el.setAttribute("data-chaincss", "runtime");
  el.textContent = css;
  document.head.appendChild(el);

  console.log(
    "⛓️ ChainCSS — " +
      Object.keys(styles).length +
      " styles injected | CSS: " +
      css.length +
      " bytes | smartChain auto-detect active",
  );

  return el;
}
// Runtime adapter
export {
  createRuntimeAdapter,
  getRuntimeAdapter,
  setRuntimeAdapter,
  resetRuntimeAdapter,
} from "./core/adapter/factory.js";

export type { RuntimeAdapter } from "./core/adapter/types.js";
export { BrowserAdapter } from "./core/adapter/browser-adapter.js";
export { SSRAdapter } from "./core/adapter/ssr-adapter.js";

/**
 * compileToCSS is re-exported from here AND from compiler-entry.ts.
 * If the source path changes, update BOTH files.
 * Source: @core/usecases/style-compiler.js
 */
export { compileToCSS } from "@core/usecases/style-compiler.js";
