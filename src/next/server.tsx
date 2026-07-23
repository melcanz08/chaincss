// @ts-nocheck
// src/next/server.tsx — Full ChainCSS SSR integration
// Uses real StyleCollector + compileToCSS. No standalone fallback.
// RSC SAFE - No 'use client'

import React from 'react';

// Import real compiler and collector
let compileToCSS: any = null;
let chainFn: any = null;

try {
  const compiler = require('../core/style-compiler.js');
  compileToCSS = compiler.compileToCSS || compiler.default;
} catch {
  try {
    const compiler = require('../../dist/core/style-compiler.cjs');
    compileToCSS = compiler.compileToCSS;
  } catch {
    throw new Error('[ChainCSS] style-compiler not found. Ensure chaincss is properly installed.');
  }
}

try {
  const collector = require('../core/style-collector.js');
  chainFn = collector.chain || collector.default || collector;
} catch {
  try {
    const collector = require('../../dist/core/style-collector.cjs');
    chainFn = collector.chain;
  } catch {
    throw new Error('[ChainCSS] style-collector not found. Ensure chaincss is properly installed.');
  }
}

// ============================================================================
// Server registry — per-request style collection
// ============================================================================
const serverRegistry = new Map<string, string>();
let cssCache = '';

export function getChainCSS(): string {
  // 1. Try build output first
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
// chain() — SSR version using real StyleCollector
// ============================================================================

export function chain(id?: string) {
  const instance = chainFn({ ssr: true, id });

  return new Proxy(instance, {
    get(target, prop: string) {
      // Terminal methods — finalize and capture CSS
      if (prop === '$el') {
        return (...selectors: string[]) => {
          const result = (target as any).$el
            ? (target as any).$el(...selectors)
            : (target as any).build(selectors.length ? selectors : undefined);

          const className =
            result.className ||
            result.selectors?.[0]?.replace(/^\./, '') ||
            (typeof result === 'string' ? result : id || 'chain-el');

          // Generate CSS using the real compiler
          if (compileToCSS && !serverRegistry.has(className)) {
            try {
              const css = compileToCSS(
                typeof result === 'string'
                  ? { selectors: [`.${className}`] }
                  : result,
                { scopeSelector: `.${className}`, minify: true }
              );
              if (css) {
                serverRegistry.set(className, css);
                cssCache += css + '\n';
              }
            } catch (e) {
              console.warn('[ChainCSS RSC] compileToCSS failed:', e);
            }
          }

          // Return result with className for component use
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