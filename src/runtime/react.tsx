// src/runtime/react.tsx (fixed version)

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { compileRuntime, setTokens as setGlobalTokens, removeRuntimeModule } from './injector.js';
import { chain } from '../core/style-collector.js';

export interface UseChainStylesOptions {
  cache?: boolean;
  namespace?: string;
  watch?: boolean;
  debug?: boolean;
  ssr?: boolean;
}

// Better hash function with lower collision risk
function hashStyleObject(obj: Record<string, any>): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * React hook for ChainCSS runtime styles
 */
export function useChainStyles(
  styles: Record<string, any>,
  deps: any[] = [],
  options: UseChainStylesOptions = {}
): Record<string, string> {
  const { namespace = 'c', debug = false, ssr = false } = options;
  const instanceId = useRef(Math.random().toString(36).substring(2, 7));
  const moduleId = useRef(`chaincss-module-${instanceId.current}`);
  const [forceUpdate, setForceUpdate] = useState(0);

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
  }, [ssr]);

  return useMemo(() => {
    const finalClassMap: Record<string, string> = {};
    const injectionBundle: Record<string, any> = {};

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

      // Remove internal keys
      const staticClasses = Array.isArray(styleObject._classes) ? styleObject._classes : [];
      const internalKeys = ['catcher', 'proxy', 'useTokens', 'componentName', '_isChain', '_classes', '_name'];
      internalKeys.forEach(k => delete styleObject[k]);

      // Generate stable hash
      const hash = hashStyleObject(styleObject);
      const dynamicClassName = `${namespace}-${key}-${hash}`;

      // Check if there are actual styles
      const hasStyles = Object.keys(styleObject).length > 0;
      
      if (!ssr && hasStyles) {
        injectionBundle[dynamicClassName] = styleObject;
      }

      // Combine static and dynamic classes
      const classParts = [...staticClasses];
      if (hasStyles) {
        classParts.push(dynamicClassName);
      }
      finalClassMap[key] = classParts.join(' ').trim();
    }

    // Inject all styles at once
    if (!ssr && Object.keys(injectionBundle).length > 0) {
      compileRuntime(injectionBundle, moduleId.current);
      if (debug) {
        console.log(`[ChainCSS] Injected ${Object.keys(injectionBundle).length} styles for module ${moduleId.current}`);
      }
    }

    return finalClassMap;
  }, [forceUpdate, ...deps]);
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
 * HOC for class components
 */
export function withChainStyles<P extends object>(
  styles: Record<string, any> | ((props: P) => Record<string, any>),
  options?: UseChainStylesOptions
) {
  return function WrappedComponent(props: P & { chainStyles?: Record<string, string> }) {
    const styleProps = typeof styles === 'function' ? styles(props) : styles;
    const classNames = useChainStyles(styleProps, [], options);
    const Component = (props as any).component || (props as any).wrappedComponent;
    return <Component {...props} chainStyles={classNames} />;
  };
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