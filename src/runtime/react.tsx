// src/runtime/react.tsx — Production-grade React runtime
// Uses the same compileToCSS that build-time uses

import { compileToCSS } from '../core/style-compiler.js';
import { styleInjector } from './injector.js';

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
      .catch(() => { _React = {}; return _React; });
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
// Internal: Evaluate dynamic values and compile real CSS
// ============================================================================

interface StyleDefinition {
  selectors?: string[];
  styles?: Record<string, any>;
  dynamic?: Record<string, () => string | number>;
  [key: string]: any;
}

function evaluateDynamicStyles(
  styleObj: StyleDefinition
): Record<string, string | number> {
  const resolved: Record<string, string | number> = {};
  
  if (styleObj.dynamic) {
    for (const [prop, valueFn] of Object.entries(styleObj.dynamic)) {
      try {
        resolved[prop] = valueFn();
      } catch (err) {
        if (typeof window !== 'undefined' && (window as any).__CHAINCSS_DEBUG__) {
          console.warn(`[ChainCSS] Error evaluating dynamic style "${prop}":`, err);
        }
      }
    }
  }

  return resolved;
}

function compileAndInject(
  styleObj: StyleDefinition,
  className: string,
  debug: boolean = false
): string {
  // Merge static styles with resolved dynamic values
  const mergedStyles = {
    ...(styleObj.styles || {}),
    ...evaluateDynamicStyles(styleObj),
  };

  // Use the same compiler that build-time uses
  const css = compileToCSS(
    { [className]: mergedStyles },
    { scopeSelector: `.${className}` }
  );

  if (css) {
    styleInjector.inject(className, css, debug);
  }

  return className;
}

// ============================================================================
// Core Hook: useChainStyles
// ============================================================================

export function useChainStyles(
  styles: Record<string, StyleDefinition>,
  deps: any[] = [],
  options: UseChainStylesOptions = {}
): Record<string, string> {
  const React = _React;
  if (!React || !React.useMemo) {
    getReact();
    return {};
  }

  const { debug = false } = options;

  return React.useMemo(() => {
    const classMap: Record<string, string> = {};

    for (const [key, styleObj] of Object.entries(styles)) {
      if (!styleObj) continue;

      // Get the base class name from selectors (set at build time)
      const baseClass = styleObj.selectors?.[0]?.replace(/^\./, '') || key;
      
      if (styleObj.dynamic && Object.keys(styleObj.dynamic).length > 0) {
        // Generate a unique class for this dynamic instance
        const dynamicClass = `${baseClass}-dyn-${Math.random().toString(36).substr(2, 8)}`;
        
        // Compile and inject real CSS
        compileAndInject(styleObj, dynamicClass, debug);
        
        classMap[key] = dynamicClass;
      } else {
        // Static style — just return the base class
        classMap[key] = baseClass;
      }
    }

    if (debug) {
      console.log('[ChainCSS] useChainStyles compiled:', classMap);
    }

    return classMap;
  }, deps);
}

// ============================================================================
// useDynamicChainStyles
// ============================================================================

export function useDynamicChainStyles(
  styles: Record<string, StyleDefinition>,
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
  styles: Record<string, StyleDefinition>,
  deps: any[] = []
): Record<string, string> {
  const allDeps = [theme, ...deps];
  return useChainStyles(styles, allDeps, { watch: true });
}

// ============================================================================
// ChainCSSGlobal — Inject global styles with cleanup
// ============================================================================

export function ChainCSSGlobal({ styles, tokens, children }: any) {
  const React = _React;
  if (!React) {
    getReact();
    return children || null;
  }

  React.useEffect(() => {
    if (!styles) return;
    
    const injectedIds: string[] = [];

    for (const [key, styleObj] of Object.entries(styles)) {
      if (!styleObj) continue;
      const id = `chaincss-global-${key}`;
      compileAndInject(styleObj as StyleDefinition, id);
      injectedIds.push(id);
    }

    return () => {
      // Cleanup on unmount
      injectedIds.forEach(id => styleInjector.remove(id));
    };
  }, [styles]);

  if (tokens) {
    styleInjector.setTokens(tokens);
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
  styles: Record<string, StyleDefinition>
): any {
  return function WrappedComponent(props: P) {
    const React = _React;
    if (!React) return null;
    const classes = useChainStyles(styles);
    return React.createElement(Component, { ...props, classes });
  };
}

// ============================================================================
// createStyledComponent
// ============================================================================

export function createStyledComponent<T extends string = 'div'>(
  tag: T,
  baseStyle?: StyleDefinition
): any {
  return function StyledComponent(props: any) {
    const React = _React;
    if (!React) return null;
    const className = baseStyle?.selectors?.[0]?.replace(/^\./, '') || '';
    return React.createElement(tag || 'div', {
      ...props,
      className: cx(className, props.className, props.class),
    });
  };
}

// ============================================================================
// createStyledComponents — batch creation
// ============================================================================

export function createStyledComponents(
  components: Record<string, { element?: string; styles: StyleDefinition }>
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [name, config] of Object.entries(components)) {
    result[name] = createStyledComponent(config.element || 'div', config.styles);
  }
  return result;
}

// ============================================================================
// useComputedStyles
// ============================================================================

export function useComputedStyles<T extends Record<string, any>>(
  styles: T,
  deps: any[] = []
): Record<string, string> {
  return useChainStyles(styles as any, deps);
}

// ============================================================================
// Debug helpers
// ============================================================================

let debugEnabled = false;

export function enableChainCSSDebug(): void {
  debugEnabled = true;
  if (typeof window !== 'undefined') {
    (window as any).__CHAINCSS_DEBUG__ = true;
  }
  console.log('🔍 ChainCSS React debug enabled');
}

export function disableChainCSSDebug(): void {
  debugEnabled = false;
  if (typeof window !== 'undefined') {
    (window as any).__CHAINCSS_DEBUG__ = false;
  }
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

// ============================================================================
// Initialize
// ============================================================================

getReact().then(react => {
  _React = react;
});