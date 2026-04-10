// chaincss/src/runtime/vue.ts

import { ref, computed, watch, onMounted, onUnmounted, inject, provide, reactive, h, Ref } from 'vue';
import { chainRuntime as $, compileRuntime, styleInjector } from './injector.js';

const CHAIN_CSS_KEY = Symbol('chaincss');

export interface UseAtomicClassesOptions {
  atomic?: boolean;
  global?: boolean;
}

export function useAtomicClasses(
  styles: any,
  options: UseAtomicClassesOptions = {}
) {
  const { atomic = true, global = false } = options;
  const id = `chain-${Math.random().toString(36).substr(2, 9)}`;
  
  const classes = computed(() => {
    const resolvedStyles = typeof styles === 'function' 
      ? styles() 
      : styles?.value || styles;
    
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
    
    return compileRuntime(compiledStyles);
  });
  
  return {
    classes,
    cx: (name: string) => classes.value[name],
    cn: (...names: string[]) => names.map(name => classes.value[name]).filter(Boolean).join(' ')
  };
}

// ChainCSS Global component for Vue
export const ChainCSSGlobal = {
  name: 'ChainCSSGlobal',
  props: {
    styles: {
      type: Object,
      required: true
    }
  },
  setup(props: any) {
    useAtomicClasses(props.styles);
    return () => null;
  }
};

/**
 * Create a styled Vue component
 */
export function createStyledComponent(
  styles: Record<string, any> | (() => Record<string, any>),
  tag = 'div'
) {
  return {
    name: 'ChainCSSStyledComponent',
    props: {
      className: { type: String, default: '' }
    },
    setup(props: any, { slots, attrs }: any) {
      const resolvedStyles = typeof styles === 'function' ? styles() : styles;
      const { classes } = useAtomicClasses({ root: resolvedStyles });
      
      const combinedClass = computed(() => {
        const rootClass = classes.value?.root || '';
        return [rootClass, props.className].filter(Boolean).join(' ');
      });
      
      return () => {
        return h(tag, {
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
export function createStyledComponents(components: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [name, config] of Object.entries(components)) {
    const { element = 'div', styles } = config as any;
    result[name] = createStyledComponent(styles, element);
  }
  
  return result;
}

/**
 * CSS-in-JS with computed props (Vue)
 */
export function useComputedStyles<T extends Record<string, any>>(
  styles: (props: T) => Record<string, any>,
  props: T
) {
  const computedStyles = computed(() => ({ root: styles(props) }));
  const { classes } = useAtomicClasses(computedStyles);
  
  return {
    classes,
    rootClass: computed(() => classes.value?.root || '')
  };
}

/**
 * Style provider for theme/context (Vue)
 */
export function provideStyleContext(theme: any) {
  const themeRef = ref(theme);
  provide(CHAIN_CSS_KEY, themeRef);
  return themeRef;
}

export function injectStyleContext() {
  return inject<Ref<any>>(CHAIN_CSS_KEY, ref({}));
}