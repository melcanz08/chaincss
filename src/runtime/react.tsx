// src/runtime/react.tsx (fixed)

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { compileRuntime, setTokens as setGlobalTokens, removeRuntimeModule } from './injector.js';

export interface UseChainStylesOptions {
  cache?: boolean;
  namespace?: string;
  watch?: boolean;
  debug?: boolean;
  ssr?: boolean;
}

/**
 * Deterministic hash for style objects.
 * Sorts keys before serialization to guarantee same output
 * regardless of object key insertion order (critical for SSR hydration).
 */
function hashStyleObject(obj: Record<string, any>): string {
  // Sort keys for deterministic serialization across server/client
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key];
    // Serialize nested objects deterministically too
    sorted[key] = val && typeof val === 'object' && !Array.isArray(val)
      ? hashStyleObject(val)
      : val;
  }
  const str = JSON.stringify(sorted);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * React hook for ChainCSS runtime styles.
 * 
 * Class name computation happens in useMemo (pure).
 * Style injection happens in useEffect (side effect safe, SSR-safe).
 */
export function useChainStyles(
  styles: Record<string, any>,
  deps: any[] = [],
  options: UseChainStylesOptions = {}
): Record<string, string> {
  const { namespace = 'c', debug = false, ssr = false } = options;
  const instanceId = useRef(Math.random().toString(36).substring(2, 7));
  const moduleId = useRef(`chaincss-module-${instanceId.current}`);
  const [, setRenderCount] = useState(0);

  // Step 1: Compute class names (pure — safe in useMemo)
  const { finalClassMap, injectionBundle } = useMemo(() => {
    const classMap: Record<string, string> = {};
    const bundle: Record<string, any> = {};

    for (const [key, styleDef] of Object.entries(styles)) {
      let styleObject: Record<string, any> = {};

      if (styleDef && typeof (styleDef as any).$el === 'function') {
        styleObject = (styleDef as any).$el();
        if (debug) {
          console.log(`[ChainCSS] Processing style: ${key}`, styleObject);
        }
      } else if (styleDef && typeof styleDef === 'object') {
        styleObject = { ...styleDef };
      }

      const staticClasses = Array.isArray(styleObject._classes) ? styleObject._classes : [];
      const internalKeys = ['catcher', 'proxy', 'useTokens', 'componentName', '_isChain', '_classes', '_name'];
      internalKeys.forEach(k => delete styleObject[k]);

      const hash = hashStyleObject(styleObject);
      const dynamicClassName = `${namespace}-${key}-${hash}`;
      const hasStyles = Object.keys(styleObject).length > 0;

      if (!ssr && hasStyles) {
        bundle[dynamicClassName] = styleObject;
      }

      const classParts = [...staticClasses];
      if (hasStyles) {
        classParts.push(dynamicClassName);
      }
      classMap[key] = classParts.join(' ').trim();
    }

    return { finalClassMap: classMap, injectionBundle: bundle };
  }, [styles, namespace, ssr, debug, ...deps]);

  // Step 2: Inject styles as a side effect (safe in useEffect, skipped during SSR)
  useEffect(() => {
    if (!ssr && Object.keys(injectionBundle).length > 0) {
      compileRuntime(injectionBundle, moduleId.current);
      if (debug) {
        console.log(
          `[ChainCSS] Injected ${Object.keys(injectionBundle).length} styles for module ${moduleId.current}`
        );
      }
    }
  }, [injectionBundle, ssr, debug]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!ssr && moduleId.current) {
        removeRuntimeModule(moduleId.current);
        if (debug) {
          console.log(`[ChainCSS] Cleaned up module: ${moduleId.current}`);
        }
      }
    };
  }, [ssr, debug]);

  return finalClassMap;
}

/**
 * Dynamic styles hook — re-runs when deps change
 */
export function useDynamicChainStyles(
  styleFactory: () => Record<string, any>,
  deps: any[] = [],
  options?: UseChainStylesOptions
): Record<string, string> {
  const styles = useMemo(() => styleFactory(), deps);
  return useChainStyles(styles, deps, options);
}

/**
 * Theme-aware styles hook
 */
export function useThemeChainStyles(
  styles: Record<string, any> | ((theme: any) => Record<string, any>),
  theme: any,
  options?: UseChainStylesOptions
): Record<string, string> {
  const themedStyles = useMemo(() => {
    if (typeof styles === 'function') return styles(theme);
    return styles;
  }, [styles, theme]);
  return useChainStyles(themedStyles, [theme], options);
}

/**
 * Global style injection component
 */
export function ChainCSSGlobal({ styles, tokens, children }: {
  styles?: Record<string, any>;
  tokens?: any;
  children?: React.ReactNode;
}) {
  if (tokens) {
    setGlobalTokens(tokens);
  }

  if (styles) {
    useChainStyles(styles, [], { watch: true });
  }

  return <>{children}</>;
}

/**
 * Class name utility (like clsx)
 */
export function cx(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string {
  const result: string[] = [];

  for (const cls of classes) {
    if (!cls) continue;
    if (typeof cls === 'string') {
      result.push(cls);
    } else if (typeof cls === 'object') {
      for (const [key, value] of Object.entries(cls)) {
        if (value) result.push(key);
      }
    }
  }

  return result.join(' ');
}

/**
 * HOC for class components — fixed: component is a proper parameter, not a magic prop
 */
export function withChainStyles<P extends object>(
  Component: React.ComponentType<P & { chainStyles?: Record<string, string> }>,
  styles: Record<string, any> | ((props: P) => Record<string, any>),
  options?: UseChainStylesOptions
) {
  const WrappedComponent: React.FC<P> = (props) => {
    const styleProps = typeof styles === 'function' ? styles(props) : styles;
    const classNames = useChainStyles(styleProps, [], options);
    return <Component {...props} chainStyles={classNames} />;
  };
  WrappedComponent.displayName = `withChainStyles(${Component.displayName || Component.name || 'Component'})`;
  return WrappedComponent;
}

/**
 * Create a styled component (React)
 */
export function createStyledComponent<T extends keyof React.JSX.IntrinsicElements = "div">(
  elementType: T,
  styles: Record<string, any> | (() => Record<string, any>),
  options?: UseChainStylesOptions
): React.FC<React.ComponentProps<T> & { className?: string }> {
  const StyledComponent: React.FC<any> = (props) => {
    const { className: additionalClassName, ...rest } = props;
    const styleDef = typeof styles === 'function' ? styles() : styles;
    const classNames = useChainStyles({ root: styleDef }, [], options);

    const combinedClassName = cx(classNames.root, additionalClassName);

    return React.createElement(elementType, {
      ...rest,
      className: combinedClassName
    });
  };

  const displayName = typeof elementType === 'string'
    ? elementType
    : (elementType as any).displayName || 'Component';
  StyledComponent.displayName = `ChainCSS.${displayName}`;

  return StyledComponent;
}

/**
 * Create multiple styled components at once
 */
export function createStyledComponents(components: Record<string, any>): Record<string, React.FC> {
  const result: Record<string, React.FC> = {};

  for (const [name, config] of Object.entries(components)) {
    const { element = 'div', styles, options } = config as any;
    result[name] = createStyledComponent(element, styles, options);
  }

  return result;
}

/**
 * CSS-in-JS hook with computed styles
 */
export function useComputedStyles<T extends Record<string, any>>(
  styles: (props: T) => Record<string, any>,
  props: T,
  deps: any[] = [],
  options?: UseChainStylesOptions
): Record<string, string> {
  const computedStyles = useMemo(() => styles(props), [props, ...deps]);
  return useChainStyles(computedStyles, deps, options);
}

/**
 * Set global tokens from React
 */
export function setTokens(tokens: any): void {
  setGlobalTokens(tokens);
}

/**
 * Debug utilities
 */
let debugEnabled = false;

export function enableChainCSSDebug(): void {
  debugEnabled = true;
  if (typeof window !== 'undefined') {
    (window as any).__CHAINCSS_DEBUG__ = true;
    console.log('🔍 ChainCSS Debug Mode Enabled');
  }
}

export function disableChainCSSDebug(): void {
  debugEnabled = false;
  if (typeof window !== 'undefined') {
    (window as any).__CHAINCSS_DEBUG__ = false;
    console.log('🔍 ChainCSS Debug Mode Disabled');
  }
}

export function isDebugEnabled(): boolean {
  return debugEnabled || (typeof window !== 'undefined' && (window as any).__CHAINCSS_DEBUG__);
}