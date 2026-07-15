// @ts-nocheck — optional peer dependency
// src/runtime/auto-vue.ts — Lazy-load safe Vue runtime

import { compileRuntime, removeRuntimeModule, styleInjector } from './injector.js';

// ============================================================================
// Lazy Vue loader — won't crash if Vue is not installed
// ============================================================================

let _Vue: any = null;
let _VueLoadPromise: Promise<any> | null = null;

async function getVue(): Promise<any> {
  if (_Vue) return _Vue;
  if (!_VueLoadPromise) {
    _VueLoadPromise = import('vue')
      .then(mod => { _Vue = mod; return mod; })
      .catch(() => { _Vue = {}; return _Vue; });
  }
  return _VueLoadPromise;
}

const CHAIN_CSS_KEY = Symbol('chaincss');

// ============================================================================
// Types
// ============================================================================

export interface UseAtomicClassesOptions {
  atomic?: boolean;
  global?: boolean;
  debug?: boolean;
}

function generateId(): string {
  return `chain-${Math.random().toString(36).substring(2, 11)}`;
}

function resolveStyles(styles: any): Record<string, any> | null {
  if (typeof styles === 'function') return styles();
  if (styles && typeof styles === 'object') {
    return 'value' in styles ? styles.value : styles;
  }
  return null;
}

// ============================================================================
// useAtomicClasses
// ============================================================================

export function useAtomicClasses(
  styles: any,
  options: UseAtomicClassesOptions = {}
): any {
  const Vue = _Vue;
  if (!Vue || !Vue.ref) {
    getVue().then(v => { _Vue = v; });
    return { classes: { value: {} }, cx: () => '', cn: () => '', inject: () => {} };
  }

  const { ref, computed, watch, onMounted, onUnmounted } = Vue;
  const { debug = false } = options;
  const moduleId = `chaincss-vue-${generateId()}`;
  const classMap = ref<Record<string, string>>({});
  let isMounted = false;

  const compileStyles = (sourceStyles: Record<string, any>) => {
    if (!sourceStyles || Object.keys(sourceStyles).length === 0) return;
    const classNames: Record<string, string> = {};
    for (const [key] of Object.entries(sourceStyles)) {
      const className = `${key}-${moduleId}`;
      classNames[key] = className;
    }
    if (isMounted) {
      compileRuntime(sourceStyles, moduleId);
    }
    classMap.value = classNames;
  };

  let prevStyles: Record<string, any> | null = null;
  const sourceRef = computed(() => resolveStyles(styles));

  watch(sourceRef, (newStyles: any) => {
    if (newStyles === prevStyles) return;
    prevStyles = newStyles;
    if (newStyles) compileStyles(newStyles);
  }, { immediate: false });

  onMounted(() => {
    isMounted = true;
    const initialStyles = resolveStyles(styles);
    if (initialStyles) compileStyles(initialStyles);
  });

  onUnmounted(() => {
    isMounted = false;
    removeRuntimeModule(moduleId);
  });

  return {
    classes: computed(() => classMap.value),
    cx: (name: string) => classMap.value[name] || '',
    cn: (...names: string[]) => names.map((n: string) => classMap.value[n]).filter(Boolean).join(' '),
    inject: (newStyles: Record<string, any>) => compileRuntime(newStyles, `chaincss-injected-${Date.now()}`),
  };
}

// ============================================================================
// Stubs for other exports
// ============================================================================

export const ChainCSSGlobal = { name: 'ChainCSSGlobal', props: {}, setup() { return () => null; } };

export function createStyledComponent(styles: any, tag: string = 'div'): any {
  return { name: 'StyledComponent', props: {}, setup() { return () => null; } };
}

export function createStyledComponents(components: any): any {
  const result: Record<string, any> = {};
  for (const [name, config] of Object.entries(components)) {
    result[name] = createStyledComponent((config as any).styles, (config as any).element || 'div');
  }
  return result;
}

export function useComputedStyles(stylesFactory: any, props: any): any {
  return { classes: { value: {} }, rootClass: { value: '' } };
}

export function provideStyleContext(theme: any): any {
  const Vue = _Vue;
  if (!Vue) return {};
  const themeRef = Vue.ref(theme);
  Vue.provide(CHAIN_CSS_KEY, themeRef);
  return themeRef;
}

export function injectStyleContext(): any {
  const Vue = _Vue;
  if (!Vue) return { value: {} };
  return Vue.inject(CHAIN_CSS_KEY, Vue.ref({}));
}

export function enableVueDebug(): void {
  if (typeof window !== 'undefined') (window as any).__CHAINCSS_VUE_DEBUG__ = true;
}

export function disableVueDebug(): void {
  if (typeof window !== 'undefined') (window as any).__CHAINCSS_VUE_DEBUG__ = false;
}

export function isVueDebugEnabled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__CHAINCSS_VUE_DEBUG__;
}

// Initialize
getVue().then(v => { _Vue = v; });