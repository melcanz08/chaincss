'use client';
// src/next/client.tsx - FINAL - Uses real ChainCSS compiler

import React, { useEffect, useLayoutEffect } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Try real compiler
let compileToCSS: any = null;
let baseChain: any = null;
let styleInjector: any = null;

try {
  const compiler = require('../core/style-compiler.js');
  compileToCSS = compiler.compileToCSS || compiler.default;
} catch {
  try {
    const c = require('../../dist/core/style-compiler.cjs');
    compileToCSS = c.compileToCSS;
  } catch {}
}

try {
  const collector = require('../core/style-collector.js');
  baseChain = collector.chain;
} catch {
  try {
    const c = require('../../dist/core/style-collector.cjs');
    baseChain = c.chain;
  } catch {}
}

try {
  const inj = require('../runtime/injector.js');
  styleInjector = inj.styleInjector || inj.default;
} catch {}

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
  
  // Use real injector if available (has entanglement, OKLCH handling)
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
// chain() - Client version with real compiler
// ============================================================================

function fallbackCompile(styles: Record<string, any>, className: string): string {
  let css = '';
  for (const [k, v] of Object.entries(styles)) {
    if (v == null || typeof v === 'object') continue;
    const kebab = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
    css += `${kebab}:${v};`;
  }
  return `.${className}{${css}}`;
}

function fallbackHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `c-${Math.abs(h).toString(36).slice(0, 6)}`;
}

export function chain(id?: string) {
  // Use real chain if available
  if (baseChain) {
    try {
      const instance = baseChain({ id });
      const origEl = instance.$el?.bind(instance);
      if (origEl) {
        instance.$el = () => {
          const result = origEl();
          const className = result.root || result.className;
          // Real chain already injected via its own injector, but ensure
          if (className && (instance as any).__css__) {
            inject(className, (instance as any).__css__);
          }
          return result;
        };
      }
      return instance;
    } catch (e) {
      console.warn('[ChainCSS Client] Real chain failed, fallback:', e);
    }
  }

  // Fallback standalone
  const styles: Record<string, any> = {};
  const finalId = id || fallbackHash(Math.random().toString());

  const handler = {
    get(target: any, prop: string) {
      if (prop === '$el') {
        return () => {
          let css: string;
          if (compileToCSS) {
            try { css = compileToCSS(styles, { scopeSelector: `.${finalId}` }); }
            catch { css = fallbackCompile(styles, finalId); }
          } else {
            css = fallbackCompile(styles, finalId);
          }
          if (typeof window !== 'undefined') inject(finalId, css);
          return { root: finalId, className: finalId };
        };
      }
      if (prop === 'toClassName') return () => handler.get(target, '$el')().root;
      if (prop === 'then') return undefined;
      if (prop === '_styles') return styles;
      
      return (...args: any[]) => {
        const value = args[0];
        const map: Record<string, string> = {
          bg: 'background', p: 'padding', m: 'margin',
          w: 'width', h: 'height', rounded: 'borderRadius',
        };
        const cssProp = map[prop] || prop;
        if (value === undefined) {
          if (prop === 'flex') styles.display = 'flex';
        } else {
          styles[cssProp] = value;
        }
        return new Proxy(target, handler);
      };
    }
  };

  return new Proxy({}, handler);
}

// ============================================================================
// useAtomicClasses - Now uses real compiler if available
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
      
      // Object style -> compile
      if (typeof def === 'object') {
        const id = fallbackHash(key + JSON.stringify(def));
        let css: string;
        
        // Use REAL compiler - this gives you entanglement, OKLCH, etc.
        if (compileToCSS) {
          try {
            css = compileToCSS(def, { scopeSelector: `.${id}` });
          } catch {
            css = fallbackCompile(def as any, id);
          }
        } else {
          css = fallbackCompile(def as any, id);
        }
        
        inject(id, css);
        result[key] = id;
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
// Provider
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

