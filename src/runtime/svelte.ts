// @ts-nocheck — optional peer dependency
// src/runtime/svelte.ts
//
// ChainCSS Runtime for Svelte 5
// Uses Svelte 5 runes ($state, $derived, $effect) when available.
// Falls back to plain values in non-Svelte environments (tests, SSR).

import { compileRuntime, removeRuntimeModule, styleInjector } from './injector.js';

// ============================================================================
// Svelte 5 Rune Detection
// ============================================================================

// $state/$effect/$derived are Svelte compiler macros — they only exist
// when compiled by the Svelte compiler. In tests and non-Svelte environments,
// we fall back to plain values that preserve the API shape.
const hasRunes = typeof $state !== 'undefined';

function createReactive<T>(initial: T): T {
  if (hasRunes) return $state(initial);
  return initial;
}

function createEffect(fn: () => (() => void) | void): void {
  if (hasRunes) {
    $effect(fn);
  } else {
    const cleanup = fn();
    if (typeof cleanup === 'function') cleanup();
  }
}

function createDerived<T>(fn: () => T): T {
  if (hasRunes) return $derived(fn);
  return fn();
}

// ============================================================================
// Types
// ============================================================================

export interface UseAtomicClassesOptions {
  debug?: boolean;
}

export interface AtomicClassesReturn {
  classes: Record<string, string>;
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

function resolveStyles(styles: any): Record<string, any> | null {
  if (typeof styles === 'function') return styles();
  if (styles && typeof styles === 'object') return styles;
  return null;
}

// ============================================================================
// useAtomicClasses
// ============================================================================

export function useAtomicClasses(
  styles: Record<string, any> | (() => Record<string, any>),
  options: UseAtomicClassesOptions = {}
): AtomicClassesReturn {
  const { debug = false } = options;
  const moduleId = `chaincss-svelte-${generateId()}`;

  let classes = createReactive<Record<string, string>>({});

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

    compileRuntime(compiledStyles, moduleId);
    classes = { ...classNames };

    if (debug) {
      console.log(`[ChainCSS Svelte] Compiled ${Object.keys(classNames).length} styles for ${moduleId}`);
    }
  };

  createEffect(() => {
    const sourceStyles = resolveStyles(styles);
    if (sourceStyles) {
      compileStyles(sourceStyles);
    }

    return () => {
      removeRuntimeModule(moduleId);
      if (debug) {
        console.log(`[ChainCSS Svelte] Cleaned up module: ${moduleId}`);
      }
    };
  });

  return {
    get classes() {
      return classes;
    },
    cx: (name: string) => classes[name] || '',
    cn: (...names: string[]) => names.map(name => classes[name]).filter(Boolean).join(' '),
    inject: (newStyles: Record<string, any>) => {
      const injectedId = `chaincss-injected-${Date.now()}`;
      compileRuntime(newStyles, injectedId);
      if (debug) {
        console.log(`[ChainCSS Svelte] Injected additional styles: ${injectedId}`);
      }
    },
  };
}

// ============================================================================
// ChainCSSGlobal
// ============================================================================

export function ChainCSSGlobal(props: {
  styles?: Record<string, any>;
  tokens?: Record<string, any>;
  debug?: boolean;
}): void {
  if (props.tokens && Object.keys(props.tokens).length > 0) {
    styleInjector.setTokens(props.tokens);
  }

  if (props.styles && Object.keys(props.styles).length > 0) {
    useAtomicClasses(props.styles, { debug: props.debug });
  }
}

// ============================================================================
// createStyledComponent
// ============================================================================

export function createStyledComponent(
  styles: Record<string, any> | (() => Record<string, any>),
  tag: string = 'div',
  options: UseAtomicClassesOptions = {}
): any {
  const resolvedStyles = typeof styles === 'function' ? styles() : styles;
  const { classes } = useAtomicClasses({ root: resolvedStyles }, options);

  return {
    $$render: (props: Record<string, any> = {}, { default: slot }: any = {}) => {
      const rootClass = classes['root'] || '';
      const combinedClass = [rootClass, props.class].filter(Boolean).join(' ');

      const attrs: Record<string, any> = { ...props };
      delete attrs.class;
      attrs.class = combinedClass;

      return {
        tag: props.as || tag,
        props: attrs,
        children: slot ? [slot] : [],
      };
    },
  };
}

// ============================================================================
// createStyledComponents
// ============================================================================

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

// ============================================================================
// useComputedStyles
// ============================================================================

export function useComputedStyles<T extends Record<string, any>>(
  stylesFactory: (props: T) => Record<string, any>,
  props: T
): {
  classes: Record<string, string>;
  rootClass: string;
} {
  const computedStyles = createDerived(() => ({
    root: stylesFactory(props),
  }));

  const { classes } = useAtomicClasses(computedStyles);

  return {
    get classes() {
      return classes;
    },
    get rootClass() {
      return classes['root'] || '';
    },
  };
}

// ============================================================================
// chainStyles
// ============================================================================

export function chainStyles(
  styleMap: Record<string, Record<string, any>>
): Record<string, string> {
  const moduleId = `chaincss-template-${generateId()}`;
  const compiledStyles: Record<string, any> = {};
  const classNames: Record<string, string> = {};

  for (const [key, styleDef] of Object.entries(styleMap)) {
    const className = `${key}-${moduleId}`;
    const styleObj = typeof styleDef === 'function' ? styleDef() : styleDef;
    classNames[key] = className;
    compiledStyles[`${key}_${moduleId}`] = {
      selectors: [`.${className}`],
      ...styleObj,
    };
  }

  compileRuntime(compiledStyles, moduleId);
  return classNames;
}

// ============================================================================
// Context
// ============================================================================

const CHAIN_CSS_KEY = Symbol('chaincss');

function getSvelteContext(): any {
  try {
    return require('svelte');
  } catch {
    return null;
  }
}

export function provideStyleContext(theme: any): void {
  const svelte = getSvelteContext();
  if (!svelte) return;

  const themeState = createReactive({ theme });
  svelte.setContext(CHAIN_CSS_KEY, themeState);
}

export function injectStyleContext(): any {
  const svelte = getSvelteContext();
  if (!svelte) return createReactive({ theme: {} });

  return svelte.getContext(CHAIN_CSS_KEY) || createReactive({ theme: {} });
}

// ============================================================================
// cx
// ============================================================================

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

// ============================================================================
// Debug
// ============================================================================

export function enableSvelteDebug(): void {
  if (typeof window !== 'undefined') {
    (window as any).__CHAINCSS_SVELTE_DEBUG__ = true;
    console.log('🔍 ChainCSS Svelte Debug Mode Enabled');
  }
}

export function disableSvelteDebug(): void {
  if (typeof window !== 'undefined') {
    (window as any).__CHAINCSS_SVELTE_DEBUG__ = false;
    console.log('🔍 ChainCSS Svelte Debug Mode Disabled');
  }
}

export function isSvelteDebugEnabled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__CHAINCSS_SVELTE_DEBUG__;
}