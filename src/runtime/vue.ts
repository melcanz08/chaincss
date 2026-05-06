// @ts-nocheck — optional peer dependency
// src/runtime/vue.ts (fixed version)

import { ref, computed, watch, onMounted, onUnmounted, inject, provide, reactive, h, Ref } from 'vue';
import { compileRuntime, removeRuntimeModule, styleInjector } from './injector.js';
import { $ } from './Chain.js';

const CHAIN_CSS_KEY = Symbol('chaincss');

export interface UseAtomicClassesOptions {
  atomic?: boolean;
  global?: boolean;
  debug?: boolean;
}

export interface AtomicClassesReturn {
  classes: Ref<Record<string, string>>;
  cx: (name: string) => string;
  cn: (...names: string[]) => string;
  inject: (styles: Record<string, any>) => void;
}

export function useAtomicClasses(
  styles: any,
  options: UseAtomicClassesOptions = {}
): AtomicClassesReturn {
  const { atomic = true, global = false, debug = false } = options;
  // Fixed: use substring instead of deprecated substr
  const id = `chain-${Math.random().toString(36).substring(2, 11)}`;
  const moduleId = `chaincss-vue-module-${id}`;
  
  const classMap = ref<Record<string, string>>({});
  
  // Cleanup on unmount
  onUnmounted(() => {
    removeRuntimeModule(moduleId);
    if (debug) {
      console.log(`[ChainCSS Vue] Cleaned up module: ${moduleId}`);
    }
  });
  
  const compileStyles = () => {
    const resolvedStyles = typeof styles === 'function' 
      ? styles() 
      : (styles?.value || styles);
    
    if (!resolvedStyles) return {};
    
    const compiledStyles: Record<string, any> = {};
    const classNames: Record<string, string> = {};
    
    for (const [key, styleDef] of Object.entries(resolvedStyles)) {
      const className = `${key}-${id}`;
      const styleObj = typeof styleDef === 'function' ? styleDef() : styleDef;
      
      classNames[key] = className;
      compiledStyles[`${key}_${id}`] = {
        selectors: [`.${className}`],
        ...styleObj
      };
    }
    
    const result = compileRuntime(compiledStyles, moduleId);
    
    if (debug) {
      console.log(`[ChainCSS Vue] Compiled ${Object.keys(classNames).length} styles for module ${moduleId}`);
    }
    
    classMap.value = classNames;
    return result;
  };
  
  // Watch for changes if styles is reactive
  if (typeof styles === 'object' && styles !== null && 'value' in styles) {
    watch(styles, () => {
      compileStyles();
    }, { deep: true });
  }
  
  // Initial compile
  compileStyles();
  
  return {
    classes: computed(() => classMap.value),
    cx: (name: string) => classMap.value[name] || '',
    cn: (...names: string[]) => names.map(name => classMap.value[name]).filter(Boolean).join(' '),
    inject: (newStyles: Record<string, any>) => {
      const injectedId = `chaincss-injected-${Date.now()}`;
      compileRuntime(newStyles, injectedId);
      if (debug) {
        console.log(`[ChainCSS Vue] Injected additional styles: ${injectedId}`);
      }
    }
  };
}

// ChainCSS Global component for Vue
export const ChainCSSGlobal = {
  name: 'ChainCSSGlobal',
  props: {
    styles: {
      type: Object,
      required: false,
      default: () => ({})
    },
    tokens: {
      type: Object,
      required: false,
      default: () => ({})
    },
    debug: {
      type: Boolean,
      default: false
    }
  },
  setup(props: any) {
    if (props.tokens && Object.keys(props.tokens).length > 0) {
      styleInjector.setTokens(props.tokens);
    }
    
    if (props.styles && Object.keys(props.styles).length > 0) {
      useAtomicClasses(props.styles, { debug: props.debug });
    }
    
    return () => null;
  }
};

/**
 * Create a styled Vue component
 */
export function createStyledComponent(
  styles: Record<string, any> | (() => Record<string, any>),
  tag: string = 'div',
  options: UseAtomicClassesOptions = {}
) {
  return {
    name: 'ChainCSSStyledComponent',
    props: {
      className: { type: String, default: '' },
      as: { type: String, default: tag }
    },
    setup(props: any, { slots, attrs }: any) {
      const resolvedStyles = typeof styles === 'function' ? styles() : styles;
      const { classes } = useAtomicClasses({ root: resolvedStyles }, options);
      
      const combinedClass = computed(() => {
        const rootClass = classes.value?.root || '';
        return [rootClass, props.className].filter(Boolean).join(' ');
      });
      
      return () => {
        return h(props.as || tag, {
          class: combinedClass.value,
          ...attrs
        }, slots.default?.());
      };
    }
  };
}

/**
 * Create multiple styled Vue components at once
 */
export function createStyledComponents(
  components: Record<string, any>,
  options?: UseAtomicClassesOptions
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [name, config] of Object.entries(components)) {
    const { element = 'div', styles } = config as any;
    result[name] = createStyledComponent(styles, element, options);
  }
  
  return result;
}

/**
 * CSS-in-JS with computed props (Vue)
 */
export function useComputedStyles<T extends Record<string, any>>(
  styles: (props: T) => Record<string, any>,
  props: T,
  options?: UseAtomicClassesOptions
): {
  classes: Ref<Record<string, string>>;
  rootClass: Ref<string>;
} {
  const computedStyles = computed(() => ({ root: styles(props) }));
  const { classes } = useAtomicClasses(computedStyles, options);
  
  return {
    classes,
    rootClass: computed(() => classes.value?.root || '')
  };
}

/**
 * Style provider for theme/context (Vue)
 */
export function provideStyleContext(theme: any): Ref<any> {
  const themeRef = ref(theme);
  provide(CHAIN_CSS_KEY, themeRef);
  return themeRef;
}

export function injectStyleContext(): Ref<any> {
  return inject<Ref<any>>(CHAIN_CSS_KEY, ref({}));
}

/**
 * Debug utilities for Vue
 */
export function enableVueDebug(): void {
  if (typeof window !== 'undefined') {
    (window as any).__CHAINCSS_VUE_DEBUG__ = true;
    console.log('🔍 ChainCSS Vue Debug Mode Enabled');
  }
}

export function disableVueDebug(): void {
  if (typeof window !== 'undefined') {
    (window as any).__CHAINCSS_VUE_DEBUG__ = false;
    console.log('🔍 ChainCSS Vue Debug Mode Disabled');
  }
}

export function isVueDebugEnabled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__CHAINCSS_VUE_DEBUG__;
}