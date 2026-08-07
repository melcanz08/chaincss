// @ts-nocheck
// src/frameworks/next/server.tsx — Full ChainCSS SSR integration
// RSC SAFE — No 'use client'

import React from 'react';
import { chain as coreChain } from '../../index.js';

// ============================================================================
// Per-request style registry — cleared on each request
// ============================================================================
let serverRegistry = new Map<string, string>();
let cssCache = '';

/**
 * Call at the start of each SSR request to prevent cross-request leakage.
 */
export function resetServerRegistry() {
  serverRegistry = new Map<string, string>();
  cssCache = '';
}

/**
 * Read the build-time CSS file or return the per-request cache.
 */
export async function getChainCSS(): string {
  // Try reading the static build output first
  try {
    if (typeof window === 'undefined') {
      const fs = await import('fs');
      const path = await import('path');
      const p = path.join(process.cwd(), '.next/static/css/chaincss.css');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        if (content && content.length > 50) {
          return content;
        }
      }
    }
  } catch {}

  // Fall back to per-request registry
  return cssCache || Array.from(serverRegistry.values()).join('\n');
}

/**
 * Get only the per-request dynamic CSS (not the static file).
 */
export function getDynamicChainCSS(): string {
  return cssCache || Array.from(serverRegistry.values()).join('\n');
}

export function clearChainCSS() {
  resetServerRegistry();
}

// ============================================================================
// CSS helper — converts a style object to a CSS string
// ============================================================================

function styleObjectToCSS(className: string, obj: Record<string, any>): string {
  const props: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip internal/metadata keys
    if (key.startsWith('_')) continue;
    if (key === 'selectors' || key === 'className' || key === 'root') continue;
    if (typeof value === 'function') continue;
    
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    props.push(`  ${kebab}: ${value};`);
  }

  if (props.length === 0) return '';

  let css = `.${className} {\n${props.join('\n')}\n}\n`;

  // Handle pseudo-classes (&:hover, &:focus, etc.)
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('&:')) {
      const pseudoProps: string[] = [];
      for (const [p, v] of Object.entries(value as Record<string, any>)) {
        const kebab = p.replace(/([A-Z])/g, '-$1').toLowerCase();
        pseudoProps.push(`    ${kebab}: ${v};`);
      }
      if (pseudoProps.length > 0) {
        css += `\n.${className}${key.slice(1)} {\n${pseudoProps.join('\n')}\n}\n`;
      }
    }
  }

  // Handle nested rules
  if (obj._nestedRules) {
    for (const rule of obj._nestedRules) {
      const nestedCSS = styleObjectToCSS(
        `${className} ${rule.selector}`,
        rule.styles || rule,
      );
      css += nestedCSS;
    }
  }

  // Handle at-rules (media queries)
  if (obj._atRules) {
    for (const rule of obj._atRules) {
      if (rule.type === 'media' && rule.styles) {
        const inner = styleObjectToCSS(className, rule.styles);
        css += `@media ${rule.query} {\n${inner}}\n`;
      }
    }
  }

  return css;
}

// ============================================================================
// chain() — SSR version using real StyleCollector + CSS output
// ============================================================================

export function chain(id?: string) {
  const instance = coreChain();
  let proxy: any;

  proxy = new Proxy(instance, {
    get(target, prop: string) {
      if (prop === '$el') {
        return (...selectors: string[]) => {
          // Call the real $el to get the style object
          const result = typeof (target as any).$el === 'function'
            ? (target as any).$el(...selectors)
            : typeof (target as any).build === 'function'
            ? (target as any).build(selectors.length ? selectors : undefined)
            : {};

          // Extract or generate class name
          const className =
            result?.className ||
            result?.root ||
            (result?.selectors && result.selectors[0]?.replace(/^\./, '')) ||
            (typeof result === 'string' ? result : id || 'chain-container');

          // Generate actual CSS from the style object
          if (!serverRegistry.has(className)) {
            const css = typeof result === 'object' && result !== null
              ? styleObjectToCSS(className, result)
              : `.${className} { /* ChainCSS server styles */ }\n`;
            
            serverRegistry.set(className, css);
            cssCache += css;
          }

          // Return consistent shape
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
          // Only compute once — cache the result
          if (!(target as any).__cachedClassName) {
            const r = (typeof (target as any).$el === 'function'
              ? (target as any).$el()
              : null) ||
              (typeof (target as any).build === 'function'
                ? (target as any).build()
                : null) || {};
            (target as any).__cachedClassName =
              r.root ||
              r.className ||
              (r.selectors && r.selectors[0]?.replace(/^\./, '')) ||
              id ||
              'chain-el';
          }
          return (target as any).__cachedClassName;
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

export function ChainCSSServerStyles({
  nonce,
  includeStatic = true,
}: {
  nonce?: string;
  includeStatic?: boolean;
} = {}) {
  const css = includeStatic ? getChainCSS() : getDynamicChainCSS();

  if (!css) return null;

  return React.createElement('style', {
    dangerouslySetInnerHTML: { __html: css },
    'data-chaincss': 'server',
    'data-rsc': '',
    nonce: nonce || undefined,
  });
}

export function ChainCSSStyleTag({
  css,
  nonce,
}: {
  css?: string;
  nonce?: string;
}) {
  const finalCss = css || getDynamicChainCSS();
  if (!finalCss) return null;

  return React.createElement('style', {
    dangerouslySetInnerHTML: { __html: finalCss },
    'data-chaincss': 'server-tag',
    nonce: nonce || undefined,
  });
}

// ============================================================================
// RSC Helpers
// ============================================================================

/**
 * Wrap a server component to inject ChainCSS styles.
 * Call resetServerRegistry() at the start, render the component,
 * and ChainCSSServerStyles injects the collected CSS.
 */
export function withChainCSSServer<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
): React.ComponentType<T> {
  return function ChainCSSServerWrapper(props: T) {
    resetServerRegistry();
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(ChainCSSServerStyles, { includeStatic: false }),
      React.createElement(Component, props),
    );
  };
}