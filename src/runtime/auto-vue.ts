// src/runtime/auto-vue.ts

import { ref, watch, onUnmounted, type Ref } from 'vue';
import { smartChain } from '../core/smart-chain.js';
import { styleInjector, compileRuntime } from './injector.js';

export interface UseSmartStylesOptions {
  debug?: boolean;
  ssr?: boolean;
}

export function useSmartStyles<T extends Record<string, any>>(
  styleBuilder: (chain: any) => any,
  deps?: Ref<any>[],
  options: UseSmartStylesOptions = {}
): Ref<Record<string, string>> {
  const moduleId = `smart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const classMap = ref<Record<string, string>>({});
  
  const updateStyles = () => {
    // Clean up previous styles
    styleInjector.removeModule(moduleId);
    
    // Build styles with auto-detection
    const chainInstance = smartChain();
    const result = styleBuilder(chainInstance);
    
    // Handle hybrid result
    if (result && result.__isHybrid) {
      const hybrid = result as any;
      
      if (hybrid.__runtimeClasses && typeof hybrid.__runtimeClasses === 'object') {
        const dynamicMap = compileRuntime(hybrid.__runtimeClasses, moduleId);
        classMap.value = {
          ...(typeof hybrid.__buildClasses === 'object' ? hybrid.__buildClasses : {}),
          ...dynamicMap
        };
      } else {
        classMap.value = typeof hybrid === 'object' ? hybrid : {};
      }
    }
    // Pure result
    else if (result && typeof result === 'object') {
      const needsInjection = Object.values(result).some(v => 
        typeof v === 'object' && v !== null && !String(v).startsWith('c-')
      );
      
      if (needsInjection && !options.ssr) {
        classMap.value = compileRuntime(result, moduleId);
      } else {
        classMap.value = result;
      }
    }
    
    if (options.debug) {
      console.log('[ChainCSS Vue Smart] Updated styles:', classMap.value);
    }
  };
  
  updateStyles();
  
  // Watch dependencies if provided
  if (deps && deps.length > 0) {
    watch(deps, updateStyles, { deep: true });
  }
  
  onUnmounted(() => {
    styleInjector.removeModule(moduleId);
  });
  
  return classMap;
}