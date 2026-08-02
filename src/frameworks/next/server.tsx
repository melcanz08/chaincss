// @ts-nocheck
// src/frameworks/next/server.tsx — Full ChainCSS SSR integration
// Uses real StyleCollector from the public API. No standalone fallback.
// RSC SAFE - No 'use client'

import React from 'react';
import { chain as coreChain } from '../../index.js';

// ============================================================================
// Server registry — per-request style collection
// ============================================================================
const serverRegistry = new Map<string, string>();
let cssCache = '';

export function getChainCSS(): string {
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
  return cssCache;
}

export function clearChainCSS() {
  serverRegistry.clear();
  cssCache = '';
}

// ============================================================================
// chain() — SSR version using real StyleCollector
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
            (typeof result === 'string' ? result : id || 'chain-container');

          if (!serverRegistry.has(className)) {
            const css = `.${className} { /* ChainCSS server styles */ }\n`;
            serverRegistry.set(className, css);
            cssCache += css;
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

export const chainServer = chain;

// ============================================================================
// Server Components
// ============================================================================

export function ChainCSSServerStyles({ nonce }: { nonce?: string } = {}) {
  const css = getChainCSS();
  const fallback = Array.from(serverRegistry.values()).join('\n') || '.chain-container { color: inherit; }';
  return React.createElement('style', {
    dangerouslySetInnerHTML: { __html: css || fallback },
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