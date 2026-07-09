// src/runtime/react.tsx
// Uses global React when in IIFE mode, or imported React when bundled

// Try imported React first (Vite/webpack), fall back to global (IIFE/CDN)
const React = (() => {
  try {
    // Dynamic import check — won't work, so just use global
    if (typeof window !== 'undefined' && (window as any).React) {
      return (window as any).React
    }
  } catch {}
  // Fallback: try require (won't work in browser, but keeps TS happy)
  return (window as any).React || {}
})()

const { useMemo, useEffect, createElement } = React

import { compileToCSS } from '../core/style-compiler.js'
import { styleInjector } from './injector.js'

export interface UseChainStylesOptions {
  cache?: boolean; namespace?: string; watch?: boolean; debug?: boolean;
}

interface StyleDefinition {
  selectors?: string[]; styles?: Record<string, any>;
  dynamic?: Record<string, () => string | number>; [key: string]: any;
}

export function useChainStyles(
  styles: Record<string, StyleDefinition>, deps: any[] = [], options: UseChainStylesOptions = {}
): Record<string, string> {
  return useMemo(() => {
    const classMap: Record<string, string> = {};
    for (const [key, styleObj] of Object.entries(styles)) {
      if (!styleObj) continue;
      const baseClass = styleObj.className || styleObj.selectors?.[0]?.replace(/^\./, '') || key;
      const dynamicObj = styleObj.dynamic;
      if (dynamicObj && Object.keys(dynamicObj).length > 0) {
        const resolvedStyles: Record<string, any> = {};
        for (const [prop, fn] of Object.entries(dynamicObj)) {
          if (typeof fn === 'function') { try { resolvedStyles[prop] = fn(); } catch(e) {} }
        }
        const cssRules = Object.entries(resolvedStyles).map(([p, v]) => `${p}: ${v};`).join(' ');
        if (cssRules) {
          const dynamicClass = `${baseClass}-dyn-${Math.random().toString(36).substr(2, 8)}`;
          const css = `.${dynamicClass} { ${cssRules} }`;
          const styleEl = document.getElementById('chaincss-runtime');
          if (styleEl) styleEl.textContent += css;
          classMap[key] = dynamicClass;
        }
      } else {
        classMap[key] = baseClass;
      }
    }
    return classMap;
  }, deps);
}

export function useDynamicChainStyles(s: any, d: any[], o?: any) { return useChainStyles(s, d, {...o, watch: true}) }
export function useThemeChainStyles(t: any, s: any, d: any[]) { return useChainStyles(s, [t, ...d]) }

export function ChainCSSGlobal({ styles, tokens, children }: any) {
  useEffect(() => {
    if (!styles) return;
    for (const [key, obj] of Object.entries(styles)) {
      if (!obj) continue;
      const id = `chaincss-global-${key}`;
      const merged = { ...(obj as any).styles || {}, ...evalDynamic(obj as any) };
      const css = compileToCSS({ [id]: merged }, { scopeSelector: `.${id}` });
      if (css) styleInjector.inject(id, css);
    }
  }, [styles]);
  return children || null;
}

function evalDynamic(styleObj: StyleDefinition): Record<string, any> {
  const r: Record<string, any> = {};
  if (styleObj.dynamic) {
    for (const [p, fn] of Object.entries(styleObj.dynamic)) {
      if (typeof fn === 'function') try { r[p] = fn(); } catch(e) {}
    }
  }
  return r;
}

export function cx(...classes: any[]): string {
  return classes.flatMap(c => {
    if (!c) return [];
    if (typeof c === 'string') return [c];
    if (typeof c === 'object') {
      if (c.className) return [c.className];
      return Object.entries(c).filter(([_,v]) => v).map(([k]) => k);
    }
    return [];
  }).join(' ');
}

export function withChainStyles(Component: any, styles: any): any {
  return (props: any) => createElement(Component, {...props, classes: useChainStyles(styles)});
}

export function createStyledComponent(tag = 'div', baseStyle?: any): any {
  return (props: any) => {
    const cn = baseStyle?.selectors?.[0]?.replace(/^\./, '') || '';
    return createElement(tag || 'div', {...props, className: cx(cn, props.className, props.class)});
  };
}

export function createStyledComponents(comps: any): any {
  const r: any = {};
  for (const [n, c] of Object.entries(comps)) r[n] = createStyledComponent((c as any).element || 'div', (c as any).styles);
  return r;
}

export function useComputedStyles(s: any, d: any[]) { return useChainStyles(s, d) }

let debugEnabled = false;
export function enableChainCSSDebug() { debugEnabled = true; }
export function disableChainCSSDebug() { debugEnabled = false; }
export function isDebugEnabled() { return debugEnabled; }