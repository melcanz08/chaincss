// src/frameworks/vue/index.ts — Deterministic, leak-safe Vue runtime (lazy-loaded)

// @ts-nocheck — optional peer dependency

import { compileRuntime, removeRuntimeModule } from '../core/injector.js';
import type { UseAtomicClassesOptions, UseAtomicClassesReturnVue } from '@shared/types/index.js';

const CHAIN_CSS_KEY = Symbol('chaincss');

// ============================================================================
// Lazy Vue loader — no static import, no crash if Vue isn't installed
// ============================================================================

let _vue: any = null;
let _vueLoaded = false;

function getVue(): any {
  if (_vueLoaded) return _vue;

  try {
    _vue = require('vue');
  } catch {
    _vue = {
      ref: (v: any) => ({ value: v, __v_isRef: true }),
      computed: (fn: any) => ({
        get value() { return fn(); },
      }),
      watch: () => {},
      onMounted: () => {},
      onUnmounted: () => {},
      h: (_tag: any, _props: any, _children: any) => null,
      defineComponent: (config: any) => ({
        ...config,
        setup() { return config.setup?.() || {}; },
      }),
      provide: () => {},
      inject: () => ({}),
    };
  }

  _vueLoaded = true;
  return _vue;
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `chain-${Math.random().toString(36).substring(2, 11)}`;
}

function resolveStyles(styles: any): Record<string, any> | null {
  if (typeof styles === 'function') return styles();
  if (styles && typeof styles === 'object' && (styles as any).__v_isRef) {
    return styles.value;
  }
  return styles;
}

/**
 * Evaluate dynamic functions with context and return CSS custom properties.
 * This is the Vue equivalent of React's useChainStyles styleVars generation.
 */
function resolveDynamicStyles(
  styleObj: any,
  context: Record<string, any>
): Record<string, string> {
  const styleVars: Record<string, string> = {};

  if (!styleObj?.dynamic) return styleVars;

  const baseClass =
    styleObj.className ||
    styleObj.selectors?.[0]?.replace(/^\./, '') ||
    'chain-el';

  for (const [prop, fn] of Object.entries(styleObj.dynamic)) {
    if (typeof fn === 'function') {
      try {
        const value = (fn as Function)(context);
        const cleanProp = prop
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase()
          .replace(/^-/, '');
        const varName = `--${baseClass}-${cleanProp}`;

        if (value !== undefined && value !== null) {
          styleVars[varName] = String(value);
        }
      } catch (err) {
        console.warn(`[ChainCSS Vue] Error evaluating dynamic style "${prop}":`, err);
      }
    }
  }

  return styleVars;
}

export function useChainStyles(
  styles: Record<string, any>,
  contextSource: Record<string, any> = {}
) {
  const { ref, computed, watch, onMounted, onUnmounted } = getVue();

  const moduleId = `chaincss-vue-${generateId()}`;
  const classMap = ref<Record<string, string>>({});
  const styleVars = ref<Record<string, string>>({});
  const injectedModules: string[] = [];

  // Build reactive context from refs and plain values
  const buildContext = () => {
    const ctx: Record<string, any> = {};
    for (const [key, val] of Object.entries(contextSource)) {
      // Unwrap Vue refs automatically
      ctx[key] = val?.__v_isRef || (val?.value !== undefined && val?.constructor?.name === 'RefImpl')
        ? val.value
        : val;
    }
    return ctx;
  };

  // Compile static class names
  const compileClassNames = () => {
    const names: Record<string, string> = {};
    for (const [key, styleObj] of Object.entries(styles)) {
      if (!styleObj) continue;
      names[key] =
        styleObj.className ||
        styleObj.selectors?.[0]?.replace(/^\./, '') ||
        key;
    }
    classMap.value = names;
  };

  // Evaluate dynamic styles
  const evaluateDynamics = () => {
    const context = buildContext();
    const vars: Record<string, string> = {};

    for (const [, styleObj] of Object.entries(styles)) {
      if (!styleObj?.dynamic) continue;
      Object.assign(vars, resolveDynamicStyles(styleObj, context));
    }

    styleVars.value = vars;
  };

  // Initial compilation
  compileClassNames();
  evaluateDynamics();

  // Watch context sources for changes
  const watchSources: any[] = [];
  for (const val of Object.values(contextSource)) {
    if (val?.__v_isRef || (val?.value !== undefined && val?.constructor?.name === 'RefImpl')) {
      watchSources.push(val);
    }
  }

  if (watchSources.length > 0) {
    watch(watchSources, () => {
      evaluateDynamics();
    }, { deep: false });
  }

  onUnmounted(() => {
    removeRuntimeModule(moduleId);
    for (const id of injectedModules) {
      removeRuntimeModule(id);
    }
  });

  return {
    classes: computed(() => classMap.value),
    styleVars: computed(() => styleVars.value),
    cx: (name: string) => classMap.value[name] || '',
    cn: (...names: string[]) => names.map((n: string) => classMap.value[n]).filter(Boolean).join(' '),
  };
}

// ============================================================================
// useAtomicClasses — legacy API (kept for backward compat)
// ============================================================================

export function useAtomicClasses(
  styles: any,
  options: UseAtomicClassesOptions = {}
): UseAtomicClassesReturnVue {
  const { ref, computed, watch, onMounted, onUnmounted } = getVue();

  const moduleId = `chaincss-vue-${generateId()}`;
  const classMap = ref<Record<string, string>>({});
  const injectedModules: string[] = [];
  let isMounted = false;

  const compileStyles = (sourceStyles: Record<string, any>) => {
    if (!sourceStyles || Object.keys(sourceStyles).length === 0) return;

    const realMap = compileRuntime(sourceStyles, moduleId);
    if (realMap && Object.keys(realMap).length > 0) {
      classMap.value = realMap;
    } else {
      const classNames: Record<string, string> = {};
      for (const key of Object.keys(sourceStyles)) {
        classNames[key] = `${key}-${moduleId}`;
      }
      classMap.value = classNames;
    }
  };

  const sourceRef = computed(() => resolveStyles(styles));

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
// ChainCSSGlobal
// ============================================================================

export const ChainCSSGlobal = getVue().defineComponent({
  name: 'ChainCSSGlobal',
  props: {
    styles: {
      type: [String, Object],
      required: true
    }
  },
  setup(props, { slots }) {
    const { watch, onUnmounted } = getVue();
    let el: HTMLStyleElement | null = null;

    const updateGlobalSheet = () => {
      if (typeof document === 'undefined') return;
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

// ============================================================================
// createStyledComponent
// ============================================================================

export function createStyledComponent(baseStyle: any, tag: string = 'div'): any {
  const { h, defineComponent } = getVue();
  const cn = baseStyle?.className || baseStyle?.selectors?.[0]?.replace(/^\./, '') || '';

  return defineComponent({
    name: `ChainCSSStyled-${tag}`,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => {
        const { class: attrClass, className: attrClassName, ...restAttrs } = attrs;
        const finalClass = [cn, attrClass, attrClassName].filter(Boolean).join(' ');
        return h(tag, { ...restAttrs, class: finalClass }, slots);
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

// ============================================================================
// useComputedStyles (legacy — updated to use new useChainStyles)
// ============================================================================

export function useComputedStyles(stylesFactory: () => Record<string, any>): any {
  const { computed } = getVue();
  const sourceStyles = computed(stylesFactory);
  const result = useChainStyles(sourceStyles.value || {});
  const rootClass = computed(() => Object.values(result.classes.value).join(' '));
  return { classes: result.classes, rootClass };
}

// ============================================================================
// Context Sharing API
// ============================================================================

export function provideStyleContext(theme: any): any {
  const { ref, provide } = getVue();
  const themeRef = ref(theme);
  provide(CHAIN_CSS_KEY, themeRef);
  return themeRef;
}

export function injectStyleContext(): any {
  const { ref, inject } = getVue();
  return inject(CHAIN_CSS_KEY, ref({}));
}

// ============================================================================
// Debug
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

/**
 * Vue 3 composable for ChainCSS dynamic styles.
 * Equivalent to React's useChainStyles hook.
 *
 * @param styles - Style definitions from .chain.ts files
 * @param contextSource - Ref or reactive object containing context values
 *
 * @example

*<script setup>
import { ref } from 'vue'
import { useChainStyles } from 'chaincss/runtime'
import { themeToggle, counterBadge } from '../styles/playground.chain'

const isDark = ref(true)
const count = ref(0)

const { classes, styleVars } = useChainStyles(
  { themeToggle, counterBadge },
  { isDark, count }  // Vue refs auto-unwrapped!
)
</script>

<template>
  <button :class="classes.themeToggle" :style="styleVars" @click="isDark = !isDark">
    {{ isDark ? '🌙 Dark' : '☀️ Light' }}
  </button>
  <button :class="classes.counterBadge" :style="styleVars" @click="count++">
    Clicks: {{ count }}
  </button>
</template>*/