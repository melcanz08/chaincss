'use client';
// src/next/client.tsx — Full ChainCSS client integration
// Uses real StyleCollector + injector. No standalone fallback.

import React, { useEffect, useLayoutEffect } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Import real compiler and collector
let compileToCSS: any = null;
let chainFn: any = null;
let styleInjector: any = null;

try {
  const compiler = require('../core/style-compiler.js');
  compileToCSS = compiler.compileToCSS || compiler.default;
} catch {
  try {
    const c = require('../../dist/core/style-compiler.cjs');
    compileToCSS = c.compileToCSS;
  } catch {
    console.warn('[ChainCSS Client] style-compiler not found. Using fallback.');
  }
}

try {
  const collector = require('../core/style-collector.js');
  chainFn = collector.chain;
} catch {
  try {
    const c = require('../../dist/core/style-collector.cjs');
    chainFn = c.chain;
  } catch {
    console.warn('[ChainCSS Client] style-collector not found. Using fallback.');
  }
}

try {
  const inj = require('../runtime/injector.js');
  styleInjector = inj.styleInjector || inj.default;
} catch {
  try {
    const inj = require('../../dist/runtime/injector.cjs');
    styleInjector = inj.styleInjector;
  } catch {}
}

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

  // Use real injector if available (has deduplication, content hash, etc.)
  if (styleInjector) {
    try {
      styleInjector.inject(className, css);
      return;
    } catch {}
  }

  // Fallback
  const el = getStyleEl();
  if (el) el.textContent = (el.textContent || '') + '\n' + css;
}

// ============================================================================
// chain() — Client version using real StyleCollector
// ============================================================================

export function chain(id?: string) {
  if (!chainFn) {
    console.warn('[ChainCSS Client] StyleCollector not available. Styles will not be applied.');
    return new Proxy({}, {
      get: () => () => new Proxy({}, { get: () => () => ({ root: '', className: '' }) }),
    });
  }

  const instance = chainFn({ id });

  return new Proxy(instance, {
    get(target, prop: string) {
      // Terminal methods — finalize and inject CSS
      if (prop === '$el') {
        return (...selectors: string[]) => {
          const result = (target as any).$el
            ? (target as any).$el(...selectors)
            : (target as any).build(selectors.length ? selectors : undefined);

          const className =
            result.className ||
            result.selectors?.[0]?.replace(/^\./, '') ||
            (typeof result === 'string' ? result : id || 'chain-el');

          // Inject CSS using real compiler + injector
          if (compileToCSS && typeof window !== 'undefined' && !clientRegistry.has(className)) {
            try {
              const css = compileToCSS(
                typeof result === 'string'
                  ? { selectors: [`.${className}`] }
                  : result,
                { scopeSelector: `.${className}`, minify: true }
              );
              if (css) inject(className, css);
            } catch (e) {
              console.warn('[ChainCSS Client] compileToCSS failed:', e);
            }
          }

          if (typeof result === 'string') {
            return { root: result, className: result };
          }
          return {
            root: className,
            className,
            ...result,
          };
        };
      }

      if (prop === 'toClassName') {
        return () => {
          const r = (target as any).$el?.() || (target as any).build?.() || {};
          return r.root || r.className || r.selectors?.[0]?.replace(/^\./, '') || id || 'chain-el';
        };
      }

      if (prop === 'then') return undefined;

      // Pass through all other methods to the real chain
      const value = (target as any)[prop];
      if (typeof value === 'function') {
        return (...args: any[]) => {
          value.apply(target, args);
          return instance; // Return the proxy for chaining
        };
      }
      return value;
    },
  });
}

// ============================================================================
// useAtomicClasses — Compiles style objects at runtime
// ============================================================================

export function useAtomicClasses(styles: Record<string, any>) {
  const [classes, setClasses] = React.useState<Record<string, string>>({});

  useIsomorphicLayoutEffect(() => {
    const result: Record<string, string> = {};

    for (const [key, def] of Object.entries(styles)) {
      if (!def) continue;

      // Already a chain result
      if (typeof def === 'object' && 'root' in def) {
        result[key] = (def as any).root;
        continue;
      }

      // Object with selectors — use real compiler
      if (typeof def === 'object' && def.selectors) {
        const className = def.selectors[0]?.replace(/^\./, '') || key;

        if (compileToCSS) {
          try {
            const css = compileToCSS(def, { scopeSelector: `.${className}`, minify: true });
            inject(className, css);
          } catch {
            // Silently fall through
          }
        }
        result[key] = className;
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
// Re-export useChainStyles from React runtime
// ============================================================================

export { useChainStyles, useChainStylesApplied } from '../runtime/react';

// ============================================================================
// Provider & Utilities
// ============================================================================

export function ChainCSSProvider({ children }: { children: React.ReactNode }) {
  useIsomorphicLayoutEffect(() => {
    getStyleEl();
  }, []);
  return React.createElement(React.Fragment, null, children);
}

export const ChainCSSGlobal = ChainCSSProvider;

export const cx = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
export const enableChainCSSDebug = () => {};
export const disableChainCSSDebug = () => {};
export const isDebugEnabled = () => false;