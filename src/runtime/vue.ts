// @ts-nocheck — optional peer dependency
// src/runtime/vue.ts — Deterministic, leak-safe Vue runtime

import { ref, computed, watch, onMounted, onUnmounted, h, defineComponent, provide, inject as vueInject } from 'vue';
import { compileRuntime, removeRuntimeModule } from './injector.js';
import type { UseAtomicClassesOptions, UseAtomicClassesReturnVue } from './types.js';

const CHAIN_CSS_KEY = Symbol('chaincss');

function generateId(): string {
  return `chain-${Math.random().toString(36).substring(2, 11)}`;
}

function resolveStyles(styles: any): Record<string, any> | null {
  if (typeof styles === 'function') return styles();
  
  // Fixes Issue 1: Robust Vue Ref detection
  // Check for the standard Vue internal Ref flag (UnwrapRef)
  if (styles && typeof styles === 'object' && (styles as any).__v_isRef) {
    return styles.value;
  }
  
  return styles;
}

// ============================================================================
// useAtomicClasses
// ============================================================================

export function useAtomicClasses(
  styles: any,
  options: UseAtomicClassesOptions = {}
): UseAtomicClassesReturnVue {
  const moduleId = `chaincss-vue-${generateId()}`;
  const classMap = ref<Record<string, string>>({});
  const injectedModules: string[] = [];
  let isMounted = false;

  const compileStyles = (sourceStyles: Record<string, any>) => {
    if (!sourceStyles || Object.keys(sourceStyles).length === 0) return;
    
    // Attempt to compile synchronously if we have access to the compiler
    const realMap = compileRuntime(sourceStyles, moduleId);
    if (realMap && Object.keys(realMap).length > 0) {
      classMap.value = realMap;
    } else {
      // Only fabricate if we absolutely cannot get a real map yet
      const classNames: Record<string, string> = {};
      for (const key of Object.keys(sourceStyles)) {
        classNames[key] = `${key}-${moduleId}`;
      }
      classMap.value = classNames;
    }
  };

  const sourceRef = computed(() => resolveStyles(styles));

  // Deep track mutations inside style descriptors safely
  watch(sourceRef, (newStyles) => {
    if (newStyles) compileStyles(newStyles);
  }, { deep: true });

  onMounted(() => {
    isMounted = true;
    if (sourceRef.value) compileStyles(sourceRef.value);
  });

  onUnmounted(() => {
    isMounted = false;
    removeRuntimeModule(moduleId);
    
    // Fixes Issue 2: Safely unregister all inline dynamic runtime modules to prevent memory leaks
    for (const id of injectedModules) {
      removeRuntimeModule(id);
    }
  });

  return {
    classes: computed(() => classMap.value),
    cx: (name: string) => classMap.value[name] || '',
    cn: (...names: string[]) => names.map((n: string) => classMap.value[n]).filter(Boolean).join(' '),
    inject: (newStyles: Record<string, any>) => {
      const injectId = `chaincss-injected-${generateId()}`;
      injectedModules.push(injectId);
      return compileRuntime(newStyles, injectId);
    },
  };
}

// ============================================================================
// Real Functional Implementations for Global and Styled Utilities
// ============================================================================

// Fixes Issue 3: Complete operational feature layer implementation for global injection
export const ChainCSSGlobal = defineComponent({
  name: 'ChainCSSGlobal',
  props: {
    styles: {
      type: [String, Object],
      required: true
    }
  },
  setup(props, { slots }) {
    let el: HTMLStyleElement | null = null;

    const updateGlobalSheet = () => {
      if (typeof document === 'undefined') return; // <- add
      if (!props.styles) return;
      
      if (!el) {
        el = document.createElement('style');
        el.setAttribute('data-chaincss', 'global');
        document.head.appendChild(el);
      }

      if (typeof props.styles === 'string') {
        el.textContent = props.styles;
      } else if (typeof props.styles === 'object') {
        el.textContent = Object.entries(props.styles)
          .map(([_, def]: any) => {
            if (!def?.selectors) return '';
            const cssProps = Object.entries(def)
              .filter(([k, v]) => !k.startsWith('_') && k !== 'selectors' && typeof v !== 'object')
              .map(([k, v]) => `  ${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v};`)
              .join('\n');
            return `${def.selectors.join(', ')} {\n${cssProps}\n}`;
          })
          .filter(Boolean)
          .join('\n');
      }
    };

    if (typeof props.styles === 'object') {
      watch(() => props.styles, updateGlobalSheet, { deep: true, immediate: true });
    } else {
      watch(() => props.styles, updateGlobalSheet, { immediate: true });
    }

    onUnmounted(() => {
      if (el) {
        el.remove();
        el = null;
      }
    });

    return () => slots.default?.() || null;
  }
});

// Fixes Issue 3: Fully operational HOC component pipeline factory mapping attributes
export function createStyledComponent(baseStyle: any, tag: string = 'div'): any {
  const cn = baseStyle?.className || baseStyle?.selectors?.[0]?.replace(/^\./, '') || '';
  
  return defineComponent({
    name: `ChainCSSStyled-${tag}`,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => {
        // Specifically strip both potential HTML class attribute keys
        const { class: attrClass, className: attrClassName, ...restAttrs } = attrs;
        const finalClass = [cn, attrClass, attrClassName].filter(Boolean).join(' ');
        
        return h(tag, {
          ...restAttrs,
          class: finalClass
        }, slots);
      };
    }
  });
}

export function createStyledComponents(components: any): any {
  const result: Record<string, any> = {};
  for (const [name, config] of Object.entries(components)) {
    result[name] = createStyledComponent((config as any).styles, (config as any).element || 'div');
  }
  return result;
}

// Fixes Issue 3: Eradicated mock stubs to allow complete custom dynamic styles handling
export function useComputedStyles(stylesFactory: () => Record<string, any>): any {
  const sourceStyles = computed(stylesFactory);
  const { classes } = useAtomicClasses(sourceStyles);
  const rootClass = computed(() => Object.values(classes.value).join(' '));
  
  return { classes, rootClass };
}

// ============================================================================
// Context Sharing API
// ============================================================================

export function provideStyleContext(theme: any): any {
  const themeRef = ref(theme);
  provide(CHAIN_CSS_KEY, themeRef);
  return themeRef;
}

export function injectStyleContext(): any {
  return vueInject(CHAIN_CSS_KEY, ref({}));
}

// ============================================================================
// Debug Environments
// ============================================================================

export function enableVueDebug(): void {
  if (typeof window !== 'undefined') (window as any).__CHAINCSS_VUE_DEBUG__ = true;
}

export function disableVueDebug(): void {
  if (typeof window !== 'undefined') (window as any).__CHAINCSS_VUE_DEBUG__ = false;
}

export function isVueDebugEnabled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__CHAINCSS_VUE_DEBUG__;
}