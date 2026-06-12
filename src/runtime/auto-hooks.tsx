// src/runtime/auto-hooks.tsx

import React, { useEffect, useRef, useState } from 'react';
import { chain } from '../core/style-collector.js';
import { styleInjector, compileRuntime } from './injector.js';

export interface UseSmartStylesOptions {
  debug?: boolean;
  ssr?: boolean;
  moduleId?: string;
}

export function useSmartStyles<T extends Record<string, any>>(
  styleBuilder: (chain: any) => any,
  deps: any[] = [],
  options: UseSmartStylesOptions = {}
): Record<string, string> {
  const moduleId = useRef(options.moduleId || `smart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const isMounted = useRef(true);
  
  useEffect(() => {
    isMounted.current = true;
    
    // Clean up previous styles
    if (moduleId.current) {
      styleInjector.removeModule(moduleId.current);
    }
    
    // Build styles with auto-detection
    const chainInstance = chain();
    const result = styleBuilder(chainInstance);
    
    // Check if we got a hybrid result
    if (result && (result as any).__isHybrid) {
      const hybrid = result as any;
      
      // Static styles are already handled, just need to inject dynamic parts
      if (hybrid.__runtimeClasses && typeof hybrid.__runtimeClasses === 'object') {
        const dynamicMap = compileRuntime(hybrid.__runtimeClasses, moduleId.current);
        
        if (isMounted.current) {
          setClassMap({
            ...(typeof hybrid.__buildClasses === 'object' ? hybrid.__buildClasses : {}),
            ...dynamicMap
          });
        }
        
        if (options.debug) {
          console.log('[ChainCSS Smart] Hybrid styles - Static:', hybrid.__buildClasses, 'Dynamic:', dynamicMap);
        }
      } else if (isMounted.current) {
        setClassMap(typeof hybrid === 'object' ? hybrid : {});
      }
    } 
    // Pure runtime or build result
    else if (result && typeof result === 'object' && Object.keys(result).length > 0) {
      // Check if it needs injection (runtime mode)
      const needsInjection = Object.values(result).some(v => 
        typeof v === 'object' && v !== null && !String(v).startsWith('c-')
      );
      
      if (needsInjection && !options.ssr) {
        const injected = compileRuntime(result, moduleId.current);
        if (isMounted.current) {
          setClassMap(injected);
        }
      } else if (isMounted.current) {
        setClassMap(result);
      }
    }
    
    return () => {
      isMounted.current = false;
      if (moduleId.current) {
        styleInjector.removeModule(moduleId.current);
      }
    };
  }, deps);
  
  return classMap;
}

export function createSmartComponent<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  baseStyles?: (chain: any) => any
): React.FC<P & { className?: string }> {
  const SmartComponent: React.FC<P & { className?: string }> = (props) => {
    const styles = useSmartStyles((chain) => {
      let instance = chain();
      
      if (baseStyles) {
        instance = baseStyles(instance);
      }
      
      if (props.className) {
        instance = instance.className(props.className);
      }
      
      return instance.$el();
    }, [props.className]);
    
    return React.createElement(Component, {
      ...props,
      className: styles.root || props.className
    });
  };
  
  SmartComponent.displayName = `SmartComponent(${Component.displayName || Component.name || 'Component'})`;
  
  return SmartComponent;
}

// HOC for wrapping components with smart styles
export function withSmartStyles<P extends Record<string, any>>(
  WrappedComponent: React.ComponentType<P>,
  styles: (chain: any) => any
): React.FC<P> {
  const WithSmartStylesComponent: React.FC<P> = (props) => {
    const classMap = useSmartStyles(styles, []);
    return React.createElement(WrappedComponent, { ...props, ...classMap });
  };
  
  WithSmartStylesComponent.displayName = `WithSmartStyles(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  
  return WithSmartStylesComponent;
}