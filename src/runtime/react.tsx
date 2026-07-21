// src/runtime/react.tsx — Zero-leak, concurrent-safe React runtime
// Uses CSS custom properties instead of DOM injection for dynamic styles.
// No textContent mutation, no memory leaks, React concurrent-mode safe.

import React, { useMemo, useEffect } from 'react';
import type { UseChainStylesOptions } from './types.js';

interface StyleDefinition {
  className?: string;
  selectors?: string[];
  dynamic?: Record<string, () => string | number>;
  [key: string]: any;
}

/**
 * Evaluates dynamic functions and returns CSS custom property values.
 * 
 * Instead of injecting new CSS rules into the DOM (which leaks memory),
 * we return CSS variable overrides that apply via inline style.
 */
export function useChainStyles(
  styles: Record<string, StyleDefinition>,
  deps: any[] = [],
  options: UseChainStylesOptions = {}
): { classes: Record<string, string>; styleVars: Record<string, string>; cx: (...names: any[]) => string; cn: (...names: any[]) => string } {
  return useMemo(() => {
    const classes: Record<string, string> = {};
    const styleVars: Record<string, string> = {};

    for (const [key, styleObj] of Object.entries(styles)) {
      if (!styleObj) continue;

      // Get the base class name (from new .class.js format or old selectors format)
      const baseClass = styleObj.className || styleObj.selectors?.[0]?.replace(/^\./, '') || key;
      classes[key] = baseClass;

      // Evaluate dynamic functions into CSS custom properties
      if (styleObj.dynamic) {
        for (const [prop, fn] of Object.entries(styleObj.dynamic)) {
          if (typeof fn === 'function') {
            try {
              const value = fn();
              // Convert camelCase to valid kebab-case property name cleanly without double-dashes
              const cleanProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
              const varName = `--${baseClass}-${cleanProp}`;
              styleVars[varName] = String(value);
            } catch (err) {
              if (options.debug) {
                console.warn(`[ChainCSS] Error evaluating dynamic style "${key}.${prop}":`, err);
              }
            }
          }
        }
      }
    }

    // Fixes Issue 1: Returned keys match public type signatures exactly, providing ergonomic helpers
    return { 
      classes, 
      styleVars,
      cx,
      cn: cx
    };
  }, deps);
}

/**
 * Convenience hook that merges classes and styleVars for direct use.
 * Returns className string and style object ready for JSX.
 */
export function useChainStylesApplied(
  styles: Record<string, StyleDefinition>,
  deps: any[] = [],
  options?: UseChainStylesOptions
): { className: string; style: Record<string, string> } {
  const { classes, styleVars } = useChainStyles(styles, deps, options);
  
  return {
    className: [...new Set(Object.values(classes))].filter(Boolean).join(' '),
    style: styleVars,
  };
}

export function useDynamicChainStyles(s: any, d: any[], o?: any) { 
  return useChainStyles(s, d, { ...o, watch: true }); 
}

export function useThemeChainStyles(t: any, s: any, d: any[]) { 
  return useChainStyles(s, [t, ...d]); 
}

// ============================================================================
// ChainCSSGlobal — inject global styles with cleanup
// ============================================================================

export function ChainCSSGlobal({ styles, children }: any) {
  // Fixes Issue 3: Stably serialize styles configuration object to safely protect effect dependency array
  const serializedStyles = useMemo(() => {
    if (typeof styles === 'string') return styles;
    if (typeof styles === 'object' && styles !== null) {
      try { return JSON.stringify(styles); } catch { return ''; }
    }
    return '';
  }, [styles]);

  useEffect(() => {
    if (!serializedStyles) return;
    const el = document.createElement('style');
    el.setAttribute('data-chaincss', 'global');
    
    if (typeof styles === 'string') {
      el.textContent = styles;
    } else if (typeof styles === 'object') {
      // Build CSS from style definitions
      el.textContent = Object.entries(styles as Record<string, any>)
        .map(([_, def]) => {
          if (!def?.selectors) return '';
          // Fixes Issue 4: Safely exclude nested objects from raw line string mapping
          const props = Object.entries(def)
            .filter(([k, v]) => !k.startsWith('_') && k !== 'selectors' && typeof v !== 'object')
            .map(([k, v]) => `  ${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v};`)
            .join('\n');
          return `${def.selectors.join(', ')} {\n${props}\n}`;
        })
        .filter(Boolean)
        .join('\n');
    }
    
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [serializedStyles]);

  return children || null;
}

// ============================================================================
// cx — ClassName utility
// ============================================================================

export function cx(...classes: any[]): string {
  return classes.flatMap(c => {
    if (!c) return [];
    if (typeof c === 'string') return [c];
    if (typeof c === 'object') {
      if (c.className) return [c.className];
      return Object.entries(c).filter(([_, v]) => v).map(([k]) => k);
    }
    return [];
  }).join(' ');
}

// ============================================================================
// createStyledComponent — stable reference (no inline factory re-creation)
// ============================================================================

const styledComponentCache = new Map<string, any>();

export function createStyledComponent(tag: string = 'div', baseStyle?: any): any {
  const cacheKey = `${tag}:${baseStyle?.className || baseStyle?.selectors?.[0] || 'div'}`;
  
  if (styledComponentCache.has(cacheKey)) {
    return styledComponentCache.get(cacheKey);
  }

  const cn = baseStyle?.className || baseStyle?.selectors?.[0]?.replace(/^\./, '') || '';
  
  const StyledComponent = React.forwardRef((props: any, ref: any) => {
    // Fixes Issue 2: Omit raw 'class' attribute values safely to avoid leaking invalid React elements
    const { class: omitClass, className, ...restProps } = props;
    
    return React.createElement(tag || 'div', {
      ...restProps,
      ref,
      className: cx(cn, className, omitClass),
    });
  });

  StyledComponent.displayName = `ChainCSSStyled(${tag})`;
  styledComponentCache.set(cacheKey, StyledComponent);
  
  return StyledComponent;
}

export function createStyledComponents(comps: any): any {
  const r: any = {};
  for (const [n, c] of Object.entries(comps)) {
    r[n] = createStyledComponent((c as any).element || 'div', (c as any).styles);
  }
  return r;
}

// ============================================================================
// withChainStyles HOC
// ============================================================================

export function withChainStyles<P extends object>(
  Component: React.ComponentType<P>,
  styles: any
): React.FC<P> {
  function WrappedComponent(props: P) {
    const { classes, styleVars } = useChainStyles(styles);
    return React.createElement(Component, { ...props, classes, styleVars } as any);
  }
  WrappedComponent.displayName = `withChainStyles(${Component.displayName || Component.name || 'Component'})`;
  return WrappedComponent as React.FC<P>;
}

// ============================================================================
// useComputedStyles
// ============================================================================

export function useComputedStyles<T extends Record<string, any>>(s: T, d: any[] = []) {
  return useChainStyles(s as any, d);
}

// ============================================================================
// Debug
// ============================================================================

let debugEnabled = false;
export function enableChainCSSDebug() { debugEnabled = true; }
export function disableChainCSSDebug() { debugEnabled = false; }
export function isDebugEnabled() { return debugEnabled; }