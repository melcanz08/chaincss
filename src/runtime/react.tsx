// src/runtime/react.tsx — Lazy-load safe React runtime

import { compileRuntime, setTokens as setGlobalTokens, removeRuntimeModule } from './injector.js';

// ============================================================================
// Lazy React loader
// ============================================================================

let _React: any = null;
let _ReactLoadPromise: Promise<any> | null = null;

async function getReact(): Promise<any> {
  if (_React) return _React;
  if (!_ReactLoadPromise) {
    _ReactLoadPromise = import('react')
      .then(mod => { _React = mod.default || mod; return _React; })
      .catch(err => { console.warn('[ChainCSS] React not available:', err.message); return null; });
  }
  return _ReactLoadPromise;
}

// ============================================================================
// Types
// ============================================================================

export interface UseChainStylesOptions {
  cache?: boolean;
  namespace?: string;
  watch?: boolean;
  debug?: boolean;
}

// ============================================================================
// Core Hook: useChainStyles
// ============================================================================

export function useChainStyles(
  styles: Record<string, any>,
  deps: any[] = [],
  options: UseChainStylesOptions = {}
): Record<string, string> {
  const React = _React;
  if (!React) {
    getReact();
    return {};
  }

  const { useMemo } = React;

  return useMemo(() => {
    const classMap: Record<string, string> = {};
    for (const [key, obj] of Object.entries(styles)) {
      if (obj?.dynamic) {
        const uniqueClass = `chaincss-dyn-${key}-${Math.random().toString(36).substr(2, 8)}`;
        classMap[key] = uniqueClass;
      }
    }
    return classMap;
  }, deps);
}

// ============================================================================
// useDynamicChainStyles
// ============================================================================

export function useDynamicChainStyles(
  styles: Record<string, any>,
  deps: any[] = [],
  options: UseChainStylesOptions = {}
): Record<string, string> {
  return useChainStyles(styles, deps, { ...options, watch: true });
}

// ============================================================================
// useThemeChainStyles
// ============================================================================

export function useThemeChainStyles(
  theme: any,
  styles: Record<string, any>,
  deps: any[] = []
): Record<string, string> {
  const React = _React;
  if (!React) return {};
  const { useMemo } = React;
  
  return useMemo(() => {
    const classMap: Record<string, string> = {};
    for (const [key, obj] of Object.entries(styles)) {
      if (obj?.dynamic) {
        const uniqueClass = `chaincss-theme-${key}-${Math.random().toString(36).substr(2, 8)}`;
        classMap[key] = uniqueClass;
      }
    }
    return classMap;
  }, [theme, ...deps]);
}

// ============================================================================
// ChainCSSGlobal
// ============================================================================

export function ChainCSSGlobal({ styles, tokens, children }: any) {
  const React = _React;
  if (!React) {
    getReact();
    return children || null;
  }

  const { useEffect } = React;

  useEffect(() => {
    if (styles) {
      const css = compileRuntime(styles);
      if (css) {
        const el = document.createElement('style');
        el.setAttribute('data-chaincss', 'global');
        el.textContent = typeof css === "string" ? css : JSON.stringify(css);
        document.head.appendChild(el);
        return () => el.remove();
      }
    }
  }, [styles]);

  if (tokens) {
    setGlobalTokens(tokens);
  }

  return children || null;
}

// ============================================================================
// cx — ClassName utility
// ============================================================================

export function cx(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string {
  return classes
    .flatMap(c => {
      if (!c) return [];
      if (typeof c === 'string') return [c];
      if (typeof c === 'object') {
        return Object.entries(c)
          .filter(([_, v]) => v)
          .map(([k]) => k);
      }
      return [];
    })
    .join(' ');
}

// ============================================================================
// withChainStyles HOC
// ============================================================================

export function withChainStyles<P extends object>(
  Component: any,
  styles: Record<string, any>
): any {
  return function WrappedComponent(props: P) {
    const classes = useChainStyles(styles);
    const React = _React;
    if (!React) return null;
    return React.createElement(Component, { ...props, classes });
  };
}

// ============================================================================
// createStyledComponent
// ============================================================================

export function createStyledComponent<T extends string = 'div'>(
  tag: T,
  baseStyle?: any
): any {
  return function StyledComponent(props: any) {
    const React = _React;
    if (!React) return null;
    return React.createElement(tag || 'div', {
      ...props,
      className: cx(baseStyle?.selectors?.[0], props.className, props.class),
    });
  };
}

// ============================================================================
// useComputedStyles
// ============================================================================

export function useComputedStyles<T extends Record<string, any>>(
  styles: T,
  deps: any[] = []
): Record<string, string> {
  return useChainStyles(styles, deps);
}

// ============================================================================
// Token helpers
// ============================================================================

let globalTokens: any = null;

export function setTokens(tokens: any): void {
  globalTokens = tokens;
  setGlobalTokens(tokens);
}

// ============================================================================
// Debug helpers
// ============================================================================

let debugEnabled = false;

export function enableChainCSSDebug(): void {
  debugEnabled = true;
  console.log('🔍 ChainCSS React debug enabled');
}

export function disableChainCSSDebug(): void {
  debugEnabled = false;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

// ============================================================================
// Initialize React on first import
// ============================================================================

getReact().then(react => {
  _React = react;
});