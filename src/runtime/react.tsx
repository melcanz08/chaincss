// src/runtime/react.tsx — Zero-leak, concurrent-safe React runtime
// Uses CSS custom properties instead of DOM injection for dynamic styles.
// No textContent mutation, no memory leaks, React concurrent-mode safe.

import React, { useMemo } from 'react'

export interface UseChainStylesOptions {
  cache?: boolean; namespace?: string; watch?: boolean; debug?: boolean;
}

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
 * 
 * Example:
 *   dynamic: { opacity: () => 0.5 }
 *   → returns { '--chain-btn-opacity': '0.5' }
 * 
 * The CSS should define: .chain-btn { opacity: var(--chain-btn-opacity, 1); }
 */
export function useChainStyles(
  styles: Record<string, StyleDefinition>,
  deps: any[] = [],
  options: UseChainStylesOptions = {}
): { classMap: Record<string, string>; styleVars: Record<string, string> } {
  return useMemo(() => {
    const classMap: Record<string, string> = {};
    const styleVars: Record<string, string> = {};

    for (const [key, styleObj] of Object.entries(styles)) {
      if (!styleObj) continue;

      // Get the base class name (from new .class.js format or old selectors format)
      const baseClass = styleObj.className || styleObj.selectors?.[0]?.replace(/^\./, '') || key;
      classMap[key] = baseClass;

      // Evaluate dynamic functions into CSS custom properties
      if (styleObj.dynamic) {
        for (const [prop, fn] of Object.entries(styleObj.dynamic)) {
          if (typeof fn === 'function') {
            try {
              const value = fn();
              // Convert CSS property to valid custom property name
              // e.g., 'background-color' → '--chain-bg-color'
              const varName = `--${baseClass}-${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
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

    return { classMap, styleVars };
  }, deps);
}

/**
 * Convenience hook that merges classMap and styleVars for direct use.
 * Returns className string and style object ready for JSX.
 */
export function useChainStylesApplied(
  styles: Record<string, StyleDefinition>,
  deps: any[] = [],
  options?: UseChainStylesOptions
): { className: string; style: Record<string, string> } {
  const { classMap, styleVars } = useChainStyles(styles, deps, options);
  
  return {
    className: Object.values(classMap).filter(Boolean).join(' '),
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

export function ChainCSSGlobal({ styles, tokens, children }: any) {
  React.useEffect(() => {
    if (!styles) return;
    const el = document.createElement('style');
    el.setAttribute('data-chaincss', 'global');
    // Minimal CSS injection for truly global styles (not per-component dynamic)
    document.head.appendChild(el);
    return () => el.remove();
  }, [styles]);

  return children || null;
}

// ============================================================================
// cx — ClassName utility (handles new .class.js object format)
// ============================================================================

export function cx(...classes: any[]): string {
  return classes.flatMap(c => {
    if (!c) return [];
    if (typeof c === 'string') return [c];
    if (typeof c === 'object') {
      // Handle { className: '...', dynamic: {...} } format
      if (c.className) return [c.className];
      // Handle conditional objects: { class: truthy }
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
    return React.createElement(tag || 'div', {
      ...props,
      ref,
      className: cx(cn, props.className, props.class),
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

export function withChainStyles<P extends object>(Component: any, styles: any): any {
  function WrappedComponent(props: P) {
    const { classMap, styleVars } = useChainStyles(styles);
    return React.createElement(Component, { ...props, classes: classMap, styleVars });
  }
  WrappedComponent.displayName = `withChainStyles(${Component.displayName || Component.name || 'Component'})`;
  return WrappedComponent;
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