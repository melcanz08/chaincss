// @ts-nocheck — optional peer dependency
// src/runtime/vue.ts

import { ref, computed, watch, onMounted, onUnmounted, inject, provide, reactive, h, type Ref, type Component } from 'vue';
import { compileRuntime, removeRuntimeModule, styleInjector } from './injector.js';

const CHAIN_CSS_KEY = Symbol('chaincss');

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `chain-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Resolve styles from various input formats.
 * Accepts: plain object, Ref<object>, () => object
 */
function resolveStyles(styles: any): Record<string, any> | null {
  if (typeof styles === 'function') return styles();
  if (styles && typeof styles === 'object') {
    // Check for Ref — unwrap .value
    return 'value' in styles ? styles.value : styles;
  }
  return null;
}

// ============================================================================
// useAtomicClasses
// ============================================================================

export function useAtomicClasses(
  styles: Record<string, any> | Ref<Record<string, any>> | (() => Record<string, any>),
  options: UseAtomicClassesOptions = {}
): AtomicClassesReturn {
  const { debug = false } = options;
  const moduleId = `chaincss-vue-${generateId()}`;
  const classMap = ref<Record<string, string>>({});
  let isMounted = false;

  // Compile styles and inject into DOM — must happen after mount
  const compileStyles = (sourceStyles: Record<string, any>) => {
    if (!sourceStyles || Object.keys(sourceStyles).length === 0) return;

    const compiledStyles: Record<string, any> = {};
    const classNames: Record<string, string> = {};

    for (const [key, styleDef] of Object.entries(sourceStyles)) {
      const className = `${key}-${moduleId}`;
      const styleObj = typeof styleDef === 'function' ? styleDef() : styleDef;
      classNames[key] = className;
      compiledStyles[`${key}_${moduleId}`] = {
        selectors: [`.${className}`],
        ...styleObj,
      };
    }

    // Only inject if mounted — avoids DOM manipulation before Vue app is ready
    if (isMounted) {
      compileRuntime(compiledStyles, moduleId);
    }

    classMap.value = classNames;

    if (debug) {
      console.log(`[ChainCSS Vue] Compiled ${Object.keys(classNames).length} styles for ${moduleId}`);
    }
  };

  // Track previous styles to avoid recompiling unchanged objects
  let prevStyles: Record<string, any> | null = null;

  // Watch for changes — uses shallow comparison to avoid deep-watch overhead
  const sourceRef = computed(() => resolveStyles(styles));

  watch(
    sourceRef,
    (newStyles) => {
      // Skip if identical reference (shallow) — prevents recompiles on parent re-renders
      if (newStyles === prevStyles) return;
      prevStyles = newStyles;
      if (newStyles) {
        compileStyles(newStyles);
      }
    },
    { immediate: false } // Don't run before mount
  );

  // Initial compile on mount
  onMounted(() => {
    isMounted = true;
    const initialStyles = resolveStyles(styles);
    if (initialStyles) {
      compileStyles(initialStyles);
    }
  });

  // Cleanup on unmount
  onUnmounted(() => {
    isMounted = false;
    removeRuntimeModule(moduleId);
    if (debug) {
      console.log(`[ChainCSS Vue] Cleaned up module: ${moduleId}`);
    }
  });

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
    },
  };
}

// ============================================================================
// ChainCSSGlobal — inject global styles and tokens
// ============================================================================

export const ChainCSSGlobal: Component = {
  name: 'ChainCSSGlobal',
  props: {
    styles: { type: Object, required: false, default: () => ({}) },
    tokens: { type: Object, required: false, default: () => ({}) },
    debug: { type: Boolean, default: false },
  },
  setup(props: any) {
    if (props.tokens && Object.keys(props.tokens).length > 0) {
      styleInjector.setTokens(props.tokens);
    }

    if (props.styles && Object.keys(props.styles).length > 0) {
      useAtomicClasses(props.styles, { debug: props.debug });
    }

    return () => null;
  },
};

// ============================================================================
// createStyledComponent — returns a proper Vue component with ref forwarding
// ============================================================================

export function createStyledComponent(
  styles: Record<string, any> | (() => Record<string, any>),
  tag: string = 'div',
  options: UseAtomicClassesOptions = {}
): Component {
  return {
    name: 'ChainCSSStyledComponent',
    props: {
      class: { type: String, default: '' },
      as: { type: String, default: tag },
    },
    setup(props: any, { slots, attrs, expose }: any) {
      const resolvedStyles = typeof styles === 'function' ? styles() : styles;
      const { classes } = useAtomicClasses({ root: resolvedStyles }, options);

      const combinedClass = computed(() => {
        const rootClass = classes.value?.root || '';
        return [rootClass, props.class].filter(Boolean).join(' ');
      });

      // Forward the root element ref so parent components can access the DOM node
      const rootRef = ref<HTMLElement | null>(null);
      expose({ rootRef });

      return () => {
        return h(
          props.as || tag,
          {
            ref: rootRef,
            class: combinedClass.value,
            ...attrs,
          },
          slots.default?.()
        );
      };
    },
  };
}

// ============================================================================
// createStyledComponents — batch create multiple styled components
// ============================================================================

export function createStyledComponents(
  components: Record<string, any>,
  options?: UseAtomicClassesOptions
): Record<string, Component> {
  const result: Record<string, Component> = {};

  for (const [name, config] of Object.entries(components)) {
    const { element = 'div', styles } = config as any;
    result[name] = createStyledComponent(styles, element, options);
  }

  return result;
}

// ============================================================================
// useComputedStyles — CSS-in-JS with computed props
// ============================================================================

export function useComputedStyles<T extends Record<string, any>>(
  stylesFactory: (props: T) => Record<string, any>,
  props: T | Ref<T>,
  options?: UseAtomicClassesOptions
): {
  classes: Ref<Record<string, string>>;
  rootClass: Ref<string>;
} {
  const resolvedProps = computed(() =>
    props && typeof props === 'object' && 'value' in props
      ? (props as Ref<T>).value
      : (props as T)
  );

  const computedStyles = computed(() => ({
    root: stylesFactory(resolvedProps.value),
  }));

  const { classes } = useAtomicClasses(computedStyles, options);

  return {
    classes,
    rootClass: computed(() => classes.value?.root || ''),
  };
}

// ============================================================================
// Style context — provide/inject for theme tokens
// ============================================================================

export function provideStyleContext(theme: any): Ref<any> {
  const themeRef = ref(theme);
  provide(CHAIN_CSS_KEY, themeRef);
  return themeRef;
}

export function injectStyleContext(): Ref<any> {
  return inject<Ref<any>>(CHAIN_CSS_KEY, ref({}));
}

// ============================================================================
// Debug utilities
// ============================================================================

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