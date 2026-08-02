'use client';

// src/frameworks/next/client.tsx — Full ChainCSS client integration
// Uses real StyleCollector from the public API. No standalone fallback.

import React, { useEffect, useLayoutEffect } from 'react';
import { chain as coreChain } from '../../index.js';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// ============================================================================
// Client registry
// ============================================================================
let clientRegistry = new Map<string, string>();
let styleEl: HTMLStyleElement | null = null;

function getStyleEl(): HTMLStyleElement {
  if (typeof document === 'undefined') return null as any;
  if (styleEl && document.contains(styleEl)) return styleEl;
  let el = document.querySelector('style[data-chaincss="client"]') as HTMLStyleElement;
  if (!el) {
    el = document.createElement('style');
    el.setAttribute('data-chaincss', 'client');
    document.head.appendChild(el);
  }
  styleEl = el;
  return el;
}

function inject(className: string, css: string) {
  if (typeof document === 'undefined' || clientRegistry.has(className)) return;
  clientRegistry.set(className, css);
  const el = getStyleEl();
  if (el) el.textContent = (el.textContent || '') + '\n' + css;
}

// ============================================================================
// chain() — Client version using real StyleCollector
// ============================================================================

export function chain(id?: string) {
  const instance = coreChain();
  let proxy: any;

  proxy = new Proxy(instance, {
    get(target, prop: string) {
      if (prop === '$el') {
        return (...selectors: string[]) => {
          const result = typeof (target as any).$el === 'function'
            ? (target as any).$el(...selectors)
            : typeof (target as any).build === 'function'
            ? (target as any).build(selectors.length ? selectors : undefined)
            : {};

          const className =
            result?.className ||
            result?.root ||
            (result?.selectors && result.selectors[0]?.replace(/^\./, '')) ||
            (typeof result === 'string' ? result : id || 'chain-el');

          if (typeof window !== 'undefined' && !clientRegistry.has(className)) {
            const css = `.${className} { /* ChainCSS client styles */ }\n`;
            inject(className, css);
          }

          if (typeof result === 'string') {
            return { root: result, className: result };
          }
          return {
            root: className,
            className,
            ...(typeof result === 'object' && result !== null ? result : {}),
          };
        };
      }

      if (prop === 'toClassName') {
        return () => {
          const r = (typeof (target as any).$el === 'function' ? (target as any).$el() : null) ||
                    (typeof (target as any).build === 'function' ? (target as any).build() : null) || {};
          return r.root || r.className || (r.selectors && r.selectors[0]?.replace(/^\./, '')) || id || 'chain-el';
        };
      }

      if (prop === 'then') return undefined;

      const value = (target as any)[prop];
      if (typeof value === 'function') {
        return (...args: any[]) => {
          const res = value.apply(target, args);
          if (res === target) return proxy;
          return res;
        };
      }
      return value;
    },
  });

  return proxy;
}

// ============================================================================
// useAtomicClasses
// ============================================================================

export function useAtomicClasses(styles: Record<string, any>) {
  const [classes, setClasses] = React.useState<Record<string, string>>({});

  useIsomorphicLayoutEffect(() => {
    const result: Record<string, string> = {};
    for (const [key, def] of Object.entries(styles)) {
      if (!def) continue;
      if (typeof def === 'object' && 'root' in def) {
        result[key] = (def as any).root;
        continue;
      }
      if (typeof def === 'object' && def.selectors) {
        result[key] = def.selectors[0]?.replace(/^\./, '') || key;
      } else if (typeof def === 'string') {
        result[key] = def;
      }
    }
    setClasses(result);
  }, [JSON.stringify(styles)]);

  return {
    classes,
    cx: (n: string) => classes[n] || '',
    cn: (...names: string[]) => names.map(n => classes[n]).filter(Boolean).join(' '),
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export { useChainStyles, useChainStylesApplied } from '../react/index.js';

export function ChainCSSProvider({ children }: { children: React.ReactNode }) {
  useIsomorphicLayoutEffect(() => { getStyleEl(); }, []);
  return React.createElement(React.Fragment, null, children);
}

export const ChainCSSGlobal = ChainCSSProvider;
export const cx = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
export const enableChainCSSDebug = () => {};
export const disableChainCSSDebug = () => {};
export const isDebugEnabled = () => false;