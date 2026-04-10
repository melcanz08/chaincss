// chaincss/src/runtime/react.ts

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { chainRuntime as $, compileRuntime, styleInjector } from './injector.js';

export interface UseChainStylesOptions {
  cache?: boolean;
  namespace?: string;
  watch?: boolean;
}

const styleCache = new Map<string, Record<string, string>>();

/**
 * React hook for ChainCSS runtime styles
 * WARNING: This adds ~3.2KB to your bundle. For production, use build-time compilation.
 */
export function useChainStyles(
  styles: Record<string, any> | (() => Record<string, any>),
  deps: any[] = [],
  options: UseChainStylesOptions = {}
): Record<string, string> {
  const { cache = true, namespace = 'chain', watch = false } = options;
  const id = useRef(`chain-${Math.random().toString(36).substr(2, 9)}`);
  const [classNames, setClassNames] = useState<Record<string, string>>({});

  const processed = useMemo(() => {
    const resolvedStyles = typeof styles === 'function' ? styles() : styles;
    
    if (!resolvedStyles || Object.keys(resolvedStyles).length === 0) {
      return { classNames: {}, css: '' };
    }

    const cacheKey = JSON.stringify(resolvedStyles);
    if (cache && styleCache.has(cacheKey)) {
      return { classNames: styleCache.get(cacheKey)!, css: '' };
    }

    const compiledStyles: Record<string, any> = {};
    const newClassNames: Record<string, string> = {};

    for (const [key, styleDef] of Object.entries(resolvedStyles)) {
      const className = `${namespace}-${key}-${id.current}`;
      const styleObj = typeof styleDef === 'function' ? styleDef() : styleDef;
      
      newClassNames[key] = className;
      compiledStyles[`${key}_${id.current}`] = {
        selectors: [`.${className}`],
        ...styleObj
      };
    }

    const result = compileRuntime(compiledStyles);
    
    if (cache) {
      styleCache.set(cacheKey, result);
    }
    
    return { classNames: result, css: '' };
  }, [styles, namespace, id.current, ...deps]);

  useEffect(() => {
    setClassNames(processed.classNames);
    
    return () => {
      if (!watch) {
        // Cleanup styles on unmount
        for (const key of Object.keys(processed.classNames)) {
          styleInjector.remove(`${namespace}-${key}-${id.current}`);
        }
      }
    };
  }, [processed.classNames, watch]);

  return classNames;
}

/**
 * Dynamic styles hook - re-runs when deps change
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
  return useChainStyles(themedStyles, [], options); // pass empty array for deps
}

/**
 * Global style injection component
 */
export function ChainCSSGlobal({ styles }: { styles: Record<string, any> }) {
  useChainStyles(styles, [], { watch: true });
  return null;
}

/**
 * Class name utility (like clsx)
 */
export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Debug utilities
let debugEnabled = false;

export function enableChainCSSDebug(): void {
  if (typeof window !== 'undefined') {
    debugEnabled = true;
    (window as any).__CHAINCSS_DEBUG__ = true;
    console.log('🔍 ChainCSS Debug Mode Enabled');
  }
}

export function disableChainCSSDebug(): void {
  if (typeof window !== 'undefined') {
    debugEnabled = false;
    (window as any).__CHAINCSS_DEBUG__ = false;
    console.log('🔍 ChainCSS Debug Mode Disabled');
  }
}

export function isDebugEnabled(): boolean {
  return debugEnabled || (typeof window !== 'undefined' && (window as any).__CHAINCSS_DEBUG__);
}

/**
 * HOC for class components
 */
export function withChainStyles<P extends object>(
  styles: Record<string, any> | ((props: P) => Record<string, any>),
  options?: UseChainStylesOptions
) {
  return function WrappedComponent(props: P & { chainStyles?: Record<string, string> }) {
    const classNames = useChainStyles(
      typeof styles === 'function' ? styles(props) : styles,
      [],  // ← Add empty deps array
      options
    );
    const Component = (props as any).component || (props as any).wrappedComponent;
    return <Component {...props} chainStyles={classNames} />;
  };
}

/**
 * Create a styled component (React)
 * Similar to .component() in build-time, but for runtime
 */
export function createStyledComponent<T extends keyof JSX.IntrinsicElements = 'div'>(
  elementType: T,
  styles: Record<string, any> | (() => Record<string, any>),
  options?: UseChainStylesOptions
): React.FC<React.ComponentProps<T> & { className?: string }> {
  const StyledComponent: React.FC<any> = (props) => {
    const { className: additionalClassName, ...rest } = props;
    const classNames = useChainStyles(styles, [], options);
    
    const combinedClassName = [classNames.root, additionalClassName].filter(Boolean).join(' ');
    
    return React.createElement(elementType, {
      ...rest,
      className: combinedClassName
    });
  };
  
  const displayName = typeof elementType === 'string' ? elementType : (elementType as any).displayName || 'Component';
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