'use client';

// src/frameworks/next/client.tsx — Full ChainCSS client integration
import React, { useEffect, useLayoutEffect } from 'react';
import { chain as coreChain } from '../../index.js';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// ============================================================================
// Client registry
// ============================================================================
let clientRegistry = new Map<string, string>();
let styleEl: HTMLStyleElement | null = null;

function getStyleEl(): HTMLStyleElement {
  if (typeof document === 'undefined') return null as any;
  if (styleEl && document.contains(styleEl)) return styleEl;
  let el = document.querySelector(
    'style[data-chaincss="client"]',
  ) as HTMLStyleElement;
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
// CSS helper — converts a style object to a CSS string
// ============================================================================

function styleObjectToCSS(
  className: string,
  obj: Record<string, any>,
): string {
  const props: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (key === 'selectors' || key === 'className' || key === 'root') continue;
    if (typeof value === 'function') continue;

    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    props.push(`  ${kebab}: ${value};`);
  }

  if (props.length === 0) return `.${className} { /* ChainCSS */ }\n`;

  let css = `.${className} {\n${props.join('\n')}\n}\n`;

  // Pseudo-classes
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

  // Nested rules
  if (obj._nestedRules) {
    for (const rule of obj._nestedRules) {
      const nestedCSS = styleObjectToCSS(
        `${className} ${rule.selector}`,
        rule.styles || rule,
      );
      css += nestedCSS;
    }
  }

  // At-rules (media queries)
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
// chain() — Client version using real StyleCollector
// ============================================================================

export function chain(id?: string) {
  const instance = coreChain();
  let proxy: any;

  proxy = new Proxy(instance, {
    get(target, prop: string) {
      if (prop === '$el') {
        return (...selectors: string[]) => {
          const result =
            typeof (target as any).$el === 'function'
              ? (target as any).$el(...selectors)
              : typeof (target as any).build === 'function'
                ? (target as any).build(
                    selectors.length ? selectors : undefined,
                  )
                : {};

          const className =
            result?.className ||
            result?.root ||
            (result?.selectors &&
              result.selectors[0]?.replace(/^\./, '')) ||
            (typeof result === 'string' ? result : id || 'chain-el');

          // Inject real CSS, not placeholder
          if (typeof window !== 'undefined' && !clientRegistry.has(className)) {
            const css =
              typeof result === 'object' && result !== null
                ? styleObjectToCSS(className, result)
                : `.${className} { /* ChainCSS */ }\n`;
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
          if (!(target as any).__cachedClassName) {
            const r =
              (typeof (target as any).$el === 'function'
                ? (target as any).$el()
                : null) ||
              (typeof (target as any).build === 'function'
                ? (target as any).build()
                : null) ||
              {};
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
    cn: (...names: string[]) =>
      names
        .map((n) => classes[n])
        .filter(Boolean)
        .join(' '),
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export { useChainStyles, useChainStylesApplied } from '../react/index.js';

export function ChainCSSProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useIsomorphicLayoutEffect(() => {
    getStyleEl();
  }, []);
  return React.createElement(React.Fragment, null, children);
}

export const ChainCSSGlobal = ChainCSSProvider;
export const cx = (...c: (string | boolean | undefined)[]) =>
  c.filter(Boolean).join(' ');
export const enableChainCSSDebug = () => {};
export const disableChainCSSDebug = () => {};
export const isDebugEnabled = () => false;

// ============================================================================
// Client-side ChainCSS wrapper (RSC boundary)
// ============================================================================

export function ChainCSSClient({
  children,
  styles,
  className,
}: {
  children: React.ReactNode;
  styles?: Record<string, any>;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (ref.current && styles) {
      const css = styleObjectToCSS(className || 'chain-client', styles);
      const el = document.createElement('style');
      el.setAttribute('data-chaincss', 'client-dynamic');
      el.textContent = css;
      ref.current.appendChild(el);
    }
  }, [styles, className]);

  return React.createElement(
    'div',
    { ref, className },
    children,
  );
}

export function withChainCSSClient<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
): React.ComponentType<
  P & { chainStyles?: Record<string, any>; chainClass?: string }
> {
  return function ChainCSSClientWrapper({
    chainStyles,
    chainClass,
    ...props
  }: any) {
    if (chainStyles) {
      return React.createElement(
        ChainCSSClient,
        { styles: chainStyles, className: chainClass, children: React.createElement(Component, props) },
      );
    }
    return React.createElement(Component, props);
  };
}