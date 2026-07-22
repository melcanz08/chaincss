// @ts-nocheck — optional peer dependency

import { compileRuntime, removeRuntimeModule, setManifest as setGlobalManifest, setTokens as setGlobalTokens } from './injector.js';

let createSignal: any, createMemo: any, createEffect: any, onCleanup: any, createComponent: any;
let useContext: any, createContext: any, useContextProvider: any;
let Dynamic: any;

try {
  const solid = require('solid-js');
  createSignal = solid.createSignal;
  createMemo = solid.createMemo;
  createEffect = solid.createEffect;
  onCleanup = solid.onCleanup;
  createComponent = solid.createComponent;
  useContext = solid.useContext;
  createContext = solid.createContext;
} catch {
  createSignal = (v: any) => [() => v, () => {}];
  createMemo = (fn: any) => fn;
  createEffect = (fn: any) => fn(); // fallback runs immediately
  onCleanup = () => {};
  createComponent = (c: any, p: any) => null;
  useContext = () => ({});
  createContext = () => ({});
}

try {
  const web = require('solid-js/web');
  Dynamic = web.Dynamic;
} catch { Dynamic = null; }

type Accessor<T> = any;
type Component<T> = any;
type JSX = any;

const ChainCSSContext = createContext<ChainCSSContextValue>({});

interface ChainCSSContextValue {
  manifest?: Accessor<Record<string, string>>;
  tokens?: Accessor<Record<string, any>>;
  setTokens?: (tokens: Record<string, any>) => void;
}

export interface UseAtomicClassesOptions { debug?: boolean; moduleId?: string; }
export interface AtomicClassesReturn {
  classes: Accessor<Record<string, string>>;
  cx: (...names: string[]) => string;
  inject: (styles: Record<string, any>) => void;
}

function generateModuleId(): string {
  if (typeof crypto!== 'undefined' && (crypto as any).randomUUID) {
    return `chaincss-solid-${(crypto as any).randomUUID().slice(0,8)}`;
  }
  return `chaincss-solid-${Math.random().toString(36).substring(2, 9)}`;
}

export function useAtomicClasses(styles: any, options: UseAtomicClassesOptions = {}): AtomicClassesReturn {
  const { debug = false, moduleId = generateModuleId() } = options;
  const [classMap, setClassMap] = createSignal<Record<string, string>>({});
  const injectedIds: string[] = [];

  const processStyles = (sourceStyles: Record<string, any>) => {
    const finalClassMap: Record<string, string> = {};
    const injectionBundle: Record<string, any> = {};
    for (const [key, styleDef] of Object.entries(sourceStyles)) {
      const staticClasses = (styleDef as any)?._classes || [];
      const dynamicStyles = {...styleDef };
      delete dynamicStyles._classes; delete dynamicStyles._name;
      if (Object.keys(dynamicStyles).length > 0) {
        injectionBundle[key] = dynamicStyles;
        finalClassMap[key] = staticClasses.join(' ');
      } else {
        finalClassMap[key] = staticClasses.join(' ');
      }
    }
    if (Object.keys(injectionBundle).length > 0) {
      const dynamicMap = compileRuntime(injectionBundle, moduleId);
      for (const [key, dynamicClass] of Object.entries(dynamicMap)) {
        const staticPart = finalClassMap[key] || '';
        finalClassMap[key] = [staticPart, dynamicClass].filter(Boolean).join(' ');
      }
    }
    setClassMap(finalClassMap);
    if (debug) console.log('[ChainCSS Solid] Processed:', finalClassMap);
    return finalClassMap;
  };

  // FIX: use createEffect not createMemo for side-effect
  createEffect(() => {
    const sourceStyles = typeof styles === 'function'? styles() : styles;
    if (sourceStyles) return processStyles(sourceStyles);
    return {};
  });

  onCleanup(() => {
    try { removeRuntimeModule(moduleId); } catch {}
    for (const id of injectedIds) { try { removeRuntimeModule(id); } catch {} }
  });

  return {
    classes: classMap,
    cx: (...names: string[]) => {
      const currentMap = classMap();
      return names.map(name => currentMap[name] || '').filter(Boolean).join(' ');
    },
    inject: (styles: Record<string, any>) => {
      const injectedId = `injected-${generateModuleId()}`;
      injectedIds.push(injectedId);
      compileRuntime(styles, injectedId);
      if (debug) console.log(`[ChainCSS Solid] Injected: ${injectedId}`);
    }
  };
}

export function styled(tag: any, styles: any) {
  return (props: any) => {
    const resolvedStyles = typeof styles === 'function'? styles() : styles;
    const { classes } = useAtomicClasses({ root: resolvedStyles });
    const combinedClass = () => {
      const rootClass = classes().root || '';
      return [rootClass, props.class, props.className].filter(Boolean).join(' ');
    };
    const { class: cls, className,...rest } = props;
    return createComponent(Dynamic, {
      get component() { return tag; },
      get class() { return combinedClass(); },
     ...rest,
    });
  };
}

export function createStyledComponents(components: any) {
  const result = {} as any;
  for (const [name, config] of Object.entries(components)) {
    const { element = 'div', styles } = config as any;
    result[name] = styled(element, styles);
  }
  return result;
}

export function useComputedStyles(styleFactory: any, props: Accessor<any>) {
  const computedStyles = createMemo(() => ({ root: styleFactory(typeof props === 'function'? props() : props) }));
  const { classes } = useAtomicClasses(computedStyles);
  return { classes, rootClass: () => classes().root || '' };
}

export function useDynamicStyles(styleFactory: any) {
  const computedStyles = createMemo(() => styleFactory());
  return useAtomicClasses(computedStyles);
}

export const ChainCSSProvider = (props: any) => {
  if (props.manifest) setGlobalManifest(props.manifest);
  if (props.tokens) setGlobalTokens(props.tokens);
  return props.children;
};

export function useChainCSSContext() { return useContext(ChainCSSContext); }
export function setManifest(m: any) { setGlobalManifest(m); }
export function setTokens(t: any) { setGlobalTokens(t); }
export function cx(...classes: any[]) {
  const result: string[] = [];
  for (const cls of classes) {
    if (!cls) continue;
    if (typeof cls === 'string') result.push(cls);
    else if (typeof cls === 'object') { for (const [k, v] of Object.entries(cls)) if (v) result.push(k); }
  }
  return result.join(' ');
}
export function withChainStyles(Component: any, styles: any) {
  return (props: any) => {
    const styleProps = typeof styles === 'function'? styles(props) : styles;
    const { classes } = useAtomicClasses(styleProps);
    return createComponent(Component, {...props, get chainStyles() { return classes(); } });
  };
}
export function createReactiveStyles(initial: any) {
  const [styles, setStyles] = createSignal(initial);
  const update = (ns: any) => setStyles((p: any) => ({...p,...ns }));
  return [styles, update];
}
let debugEnabled = false;
export function enableSolidDebug() { debugEnabled = true; if (typeof window!== 'undefined') (window as any).__CHAINCSS_SOLID_DEBUG__ = true; }
export function disableSolidDebug() { debugEnabled = false; if (typeof window!== 'undefined') (window as any).__CHAINCSS_SOLID_DEBUG__ = false; }
export function isSolidDebugEnabled() { return debugEnabled || (typeof window!== 'undefined' &&!!(window as any).__CHAINCSS_SOLID_DEBUG__); }

// ============================================================================
// useChainStyles — Solid composable for context-aware dynamic styles (NEW)
// ============================================================================

function resolveDynamicStyles(
  styleObj: any,
  context: Record<string, any>
): Record<string, string> {
  const styleVars: Record<string, string> = {};
  if (!styleObj?.dynamic) return styleVars;

  const baseClass =
    styleObj.className ||
    styleObj.selectors?.[0]?.replace(/^\./, '') ||
    'chain-el';

  for (const [prop, fn] of Object.entries(styleObj.dynamic)) {
    if (typeof fn === 'function') {
      try {
        const value = (fn as Function)(context);
        const cleanProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
        const varName = `--${baseClass}-${cleanProp}`;
        if (value !== undefined && value !== null) styleVars[varName] = String(value);
      } catch (err) {
        console.warn(`[ChainCSS Solid] Error evaluating dynamic "${prop}":`, err);
      }
    }
  }
  return styleVars;
}

/**
 * SolidJS composable for ChainCSS dynamic styles.
 * Returns signals that reactively update when context changes.
 *
 * @param styles - Style definitions from .chain.ts files
 * @param contextSource - Object containing signals or plain values
 *
 * @example
 * ```tsx
 * import { createSignal } from 'solid-js'
 * import { useChainStyles } from 'chaincss/runtime'
 * import { themeToggle, counterBadge } from '../styles/playground.chain'
 *
 * function Demo() {
 *   const [isDark, setIsDark] = createSignal(true)
 *   const [count, setCount] = createSignal(0)
 *
 *   const { classes, styleVars } = useChainStyles(
 *     { themeToggle, counterBadge },
 *     { isDark, count }
 *   )
 *
 *   return (
 *     <button class={classes().themeToggle} style={styleVars()} onClick={() => setIsDark(!isDark())}>
 *       {isDark() ? '🌙 Dark' : '☀️ Light'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useChainStyles(
  styles: Record<string, any>,
  contextSource: Record<string, any> = {}
) {
  const moduleId = generateModuleId();
  const injectedIds: string[] = [];

  // Build context: unwrap Solid signals automatically
  const buildContext = () => {
    const ctx: Record<string, any> = {};
    for (const [key, val] of Object.entries(contextSource)) {
      // Solid signals are functions — call them to get the value
      ctx[key] = typeof val === 'function' ? val() : val;
    }
    return ctx;
  };

  // Compile static class names (memoized)
  const classNames = createMemo(() => {
    const names: Record<string, string> = {};
    for (const [key, styleObj] of Object.entries(styles)) {
      if (!styleObj) continue;
      names[key] =
        styleObj.className ||
        styleObj.selectors?.[0]?.replace(/^\./, '') ||
        key;
    }
    return names;
  });

  // Evaluate dynamic styles reactively
  const styleVars = createMemo(() => {
    const context = buildContext();
    const vars: Record<string, string> = {};
    for (const [, styleObj] of Object.entries(styles)) {
      if (!styleObj?.dynamic) continue;
      Object.assign(vars, resolveDynamicStyles(styleObj, context));
    }
    return vars;
  });

  onCleanup(() => {
    try { removeRuntimeModule(moduleId); } catch {}
    for (const id of injectedIds) { try { removeRuntimeModule(id); } catch {} }
  });

  return {
    classes: classNames,
    styleVars,
    cx: (...names: string[]) => {
      const currentMap = classNames();
      return names.map(name => currentMap[name] || '').filter(Boolean).join(' ');
    },
    cn: (...names: string[]) => {
      const currentMap = classNames();
      return names.map(name => currentMap[name] || '').filter(Boolean).join(' ');
    },
    inject: (newStyles: Record<string, any>) => {
      const injectedId = `injected-${generateModuleId()}`;
      injectedIds.push(injectedId);
      compileRuntime(newStyles, injectedId);
    },
  };
}

export default { useAtomicClasses, styled, createStyledComponents, useComputedStyles, useDynamicStyles, ChainCSSProvider, useChainCSSContext, setManifest, setTokens, cx, withChainStyles, createReactiveStyles, enableSolidDebug, disableSolidDebug, isSolidDebugEnabled };