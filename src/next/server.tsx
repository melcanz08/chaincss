// @ts-nocheck
// src/next/server.tsx - FINAL - Uses real ChainCSS compiler
// RSC SAFE - No 'use client'

import React from 'react';

// Try to import real compiler, fallback to simple if not found (for sandbox testing)
let compileToCSS: any = null;
let baseChain: any = null;

try {
  const compiler = require('../core/style-compiler.js');
  compileToCSS = compiler.compileToCSS || compiler.default;
} catch {
  try {
    const compiler = require('../../dist/core/style-compiler.cjs');
    compileToCSS = compiler.compileToCSS;
  } catch {}
}

try {
  const collector = require('../core/style-collector.js');
  baseChain = collector.chain || collector.default || collector;
} catch {
  try {
    const collector = require('../../dist/core/style-collector.cjs');
    baseChain = collector.chain;
  } catch {}
}

// ============================================================================
// Fallback simple compiler if real one not found
// ============================================================================
function fallbackCompile(styles: Record<string, any>, className: string): string {
  let css = '';
  for (const [prop, value] of Object.entries(styles)) {
    if (value == null || typeof value === 'object') continue;
    const kebab = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
    css += `${kebab}:${value};`;
  }
  return `.${className}{${css}}`;
}

function fallbackHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `c-${Math.abs(h).toString(36).slice(0, 6)}`;
}

// ============================================================================
// Server registry - per-request in real Next.js, global here
// ============================================================================
const serverRegistry = new Map<string, string>();
let cssCache = '';

export function getChainCSS(): string {
  // 1. Try build output
  try {
    if (typeof window === 'undefined') {
      const fs = require('fs');
      const path = require('path');
      const p = path.join(process.cwd(), '.next/static/css/chaincss.css');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        if (content && content.length > 50) return content;
      }
    }
  } catch {}
  // 2. Fallback to in-memory (RSC dev)
  return cssCache;
}

export function clearChainCSS() {
  serverRegistry.clear();
  cssCache = '';
}

// ============================================================================
// chain() - RSC version using real compiler
// ============================================================================

export function chain(id?: string) {
  // If real chain exists, use it with ssr mode
  if (baseChain) {
    try {
      const instance = baseChain({ ssr: true, id });
      const originalEl = instance.$el?.bind(instance);
      const originalToClass = instance.toClassName?.bind(instance);
      
      // Wrap $el to capture CSS
      if (originalEl) {
        instance.$el = () => {
          const result = originalEl();
          const className = result.root || result.className || result;
          
          // Try to get CSS from instance
          let css = '';
          try {
            if (compileToCSS && instance._styles) {
              css = compileToCSS(instance._styles, { scopeSelector: `.${className}` });
            } else if ((instance as any).__css__) {
              css = (instance as any).__css__;
            }
          } catch {}
          
          if (css && !serverRegistry.has(className)) {
            serverRegistry.set(className, css);
            cssCache += css + '\n';
          }
          
          return result;
        };
      }
      return instance;
    } catch (e) {
      console.warn('[ChainCSS RSC] Failed to use real chain, using fallback:', e);
    }
  }

  // Fallback: standalone implementation
  const styles: Record<string, any> = {};
  const finalId = id || fallbackHash(Math.random().toString());

  const handler = {
    get(target: any, prop: string) {
      if (prop === '$el') {
        return () => {
          let css: string;
          if (compileToCSS) {
            try {
              css = compileToCSS(styles, { scopeSelector: `.${finalId}` });
            } catch {
              css = fallbackCompile(styles, finalId);
            }
          } else {
            css = fallbackCompile(styles, finalId);
          }
          
          if (!serverRegistry.has(finalId)) {
            serverRegistry.set(finalId, css);
            cssCache += css + '\n';
          }
          
          return { root: finalId, className: finalId };
        };
      }
      if (prop === 'toClassName') {
        return () => {
          const r = (handler.get as any)(target, '$el')();
          return r.root;
        };
      }
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

export const chainServer = chain;

// ============================================================================
// Server Components
// ============================================================================

export function ChainCSSServerStyles({ nonce }: { nonce?: string } = {}) {
  const css = getChainCSS();
  if (!css) return null;
  return React.createElement('style', {
    dangerouslySetInnerHTML: { __html: css },
    'data-chaincss': 'server',
    'data-rsc': '',
    nonce,
  });
}

export function ChainCSSStyleTag({ css, nonce }: { css?: string; nonce?: string }) {
  const finalCss = css || getChainCSS();
  if (!finalCss) return null;
  return React.createElement('style', {
    dangerouslySetInnerHTML: { __html: finalCss },
    'data-chaincss': 'server-tag',
    nonce,
  });
}

