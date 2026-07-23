// src/core/style-proxy.ts — v3 fixed + SSR-safe dynamic
// - Handles static and mixed runtime
// - Returns { className, selectors, dynamic } for useChainStyles

import { styleInjector } from '../runtime/injector.js';
import { partitionForBuild, compileToCSS } from './style-compiler.js';

interface StyleCollectorLike {
  set(prop: string, value: any): any;
  hover(): any; focus(): any; active(): any; checked(): any; disabled(): any;
  before(): any; after(): any; placeholder(): any; end(): any;
  $el(...selectors: string[]): any;
  build(selectors?: string[] | string): any;
  explain(): any; addClass(name: string): any;
  enableDebug(): any; isMixed(): boolean;
  media(q: string, fn: any): any; supports(c: string, fn: any): any;
  container(q: string, fn: any): any; layer(n: string, fn: any): any;
  nest(s: string, fn: any): any; children(fn: any): any;
  when(c: boolean, fn: any): any; keyframes(n: string, s: any): any;
  fontFace(p: any): any; grid(o?: any): any; flex(o?: any): any;
  background(o?: any): any; animation(o: any): any; typography(o: any): any;
  box(o: any): any; position(o: any): any; transform(o?: any): any;
  transition(o?: any): any; filter(o: any): any; shadow(o: any): any;
  containerQuery(o: any): any; outline(o: any): any; scroll(o: any): any;
  list(o: any): any; raw(prop: string | Record<string, any>, value?: any): any;
  [key: string]: any;
}

type Handler = (target: StyleCollectorLike, proxy: any, ...args: any[]) => any;

const chain0 = (m: string): Handler => (t, p) => { t[m](); return p; };
const chain1 = (m: string): Handler => (t, p, a) => { t[m](a); return p; };
const builder2 = (m: string): Handler => (t, p, a, b) => { t[m](a, b); return p; };

function extractClassName(styleObj: any, fallback = 'chain-el'): string {
  const sel = styleObj?.selectors?.[0] || styleObj?.selectors || fallback;
  if (Array.isArray(sel)) {
    const first = sel[0] || fallback;
    return first.replace(/^\./, '');
  }
  if (typeof sel === 'string') return sel.replace(/^\./, '');
  return fallback;
}

/**
 * Build runtime result from a style object.
 * 
 * For static styles: returns className string
 * For mixed/dynamic styles: returns { className, selectors, dynamic }
 * 
 * The `dynamic` property contains the original functions.
 * useChainStyles() calls them with current theme/state and
 * converts the results to CSS custom properties.
 */
function buildRuntimeResult(styleObj: any) {
  const rawSelectors = styleObj.selectors || [];
  const firstSel = Array.isArray(rawSelectors) ? rawSelectors[0] : rawSelectors;
  const className = typeof firstSel === 'string' ? firstSel.replace(/^\./, '') : 'chain-el';
  const scope = `.${className}`;

  // Partition static vs dynamic
  const partitioned = partitionForBuild(styleObj, { scopeSelector: scope, minify: false });

  // Compile CSS with var() placeholders for dynamic values
  const cssWithVars = compileToCSS(styleObj, { scopeSelector: scope });

  // Inject static CSS into DOM (deduplicated by content hash)
  if (cssWithVars) {
    styleInjector.inject(className, cssWithVars);
  }

  // Static-only: return just the class name string
  if (!partitioned.hasDynamic) return className;

  // Mixed: return object with dynamic functions preserved
  const dynamic: Record<string, Function> = {};

  for (const [k, v] of Object.entries(partitioned.dynamicValues)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'function') {
      dynamic[k] = v;
    }
  }

  return {
    className,
    selectors: [scope],
    dynamic: Object.keys(dynamic).length > 0 ? dynamic : undefined,
  };
}

const TERMINAL = new Map<string, Handler>([
  ['$el', (t, _p, ...a: string[]) => {
    const styleObj = t.$el(...a);
    // Runtime path (browser)
    if (typeof document !== 'undefined') {
      return buildRuntimeResult(styleObj);
    }
    // SSR / build-time path — return raw object
    return styleObj;
  }],
  ['build', (t, _p, ...a: any[]) => {
    if (a.length === 0) return t.build();
    const sel = a.length === 1 && Array.isArray(a[0]) ? a[0] : a;
    const styleObj = t.build(sel);
    if (typeof document !== 'undefined' && t.isMixed()) {
      return buildRuntimeResult(styleObj);
    }
    return styleObj;
  }],
  ['explain', (t) => t.explain()],
  ['isMixed', (t) => t.isMixed()],
]);

const CHAINABLE = new Map<string, Handler>([
  ...['hover', 'focus', 'active', 'checked', 'disabled', 'before', 'after', 'end', 'placeholder'].map(k => [k, chain0(k)] as const),
  ['debug', (t, p) => { t.enableDebug(); return p; }],
  ['addClass', (t, p, n: string) => { t.addClass(n); return p; }],
  ...['grid', 'flex', 'background', 'animation', 'typography', 'box', 'position', 'transform', 'transition', 'filter', 'shadow', 'containerQuery', 'outline', 'scroll', 'list'].map(k => [k, chain1(k)] as const),
  ['raw', (t, p, ...a: any[]) => {
    if (a.length === 1 && typeof a[0] === 'object') {
      for (const [k, v] of Object.entries(a[0])) t.set(k, v);
    } else if (a.length === 2) t.set(a[0], a[1]);
    return p;
  }],
]);

const CHILD = new Map<string, Handler>([
  ...['media', 'supports', 'container', 'layer', 'nest'].map(k => [k, builder2(k)] as const),
  ['children', (t, p, fn: Function) => { t.children(fn); return p; }],
  ['when', (t, p, c: boolean, fn: Function) => { t.when(c, fn); return p; }],
]);

const SPECIAL = new Map<string, Handler>([
  ['keyframes', (t, p, n: string, s: any) => { t.keyframes(n, s); return p; }],
  ['fontFace', (t, p, pr: any) => { t.fontFace(pr); return p; }],
]);

const cache = new WeakMap<StyleCollectorLike, Map<string | symbol, Function>>();

export function createStyleProxy(collector: StyleCollectorLike, macros: Record<string, Function>) {
  let proxy: any;
  proxy = new Proxy(collector, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') return (target as any)[prop];
      if (prop === 'then') return undefined;
      if (prop === '_mixed') return (target as any).isMixed?.();

      if (typeof prop === 'string' && prop.startsWith('__')) {
        return (target as any)[prop];
      }

      let m = cache.get(target);
      if (!m) { m = new Map(); cache.set(target, m); }
      if (m.has(prop)) return m.get(prop)!;

      let fn: Function | undefined;

      if (TERMINAL.has(prop as string)) {
        const h = TERMINAL.get(prop as string)!;
        fn = (...a: any[]) => h(target, proxy, ...a);
      } else if (CHAINABLE.has(prop as string)) {
        const h = CHAINABLE.get(prop as string)!;
        fn = (...a: any[]) => h(target, proxy, ...a);
      } else if (CHILD.has(prop as string)) {
        const h = CHILD.get(prop as string)!;
        fn = (...a: any[]) => h(target, proxy, ...a);
      } else if (SPECIAL.has(prop as string)) {
        const h = SPECIAL.get(prop as string)!;
        fn = (...a: any[]) => h(target, proxy, ...a);
      } else if (macros[prop as string]) {
        const macroFn = macros[prop as string];
        fn = (...args: any[]) => {
          const val = args[0];
          const ensure = (k: string) => {
            if (!(target as any)[k]) (target as any)[k] = [];
            return (target as any)[k];
          };
          const sink = new Proxy(target, {
            get(t, p) {
              if (p === 'nestedRules' || p === 'atRules') return ensure(p as string);
              return (t as any)[p];
            },
            set(t, p, v) {
              const k = p as string;
              if (k === 'nestedRules' || k === 'atRules' || k === '_transforms') {
                (t as any)[k] = v;
              } else {
                t.set(k, v);
              }
              return true;
            }
          }) as any;

          const res = macroFn(val, sink);
          if (res && typeof res === 'object' && res !== sink && res !== target) {
            for (const [k, v] of Object.entries(res)) {
              if (k === 'nestedRules' && Array.isArray(v)) {
                for (const r of v as any[]) target.nest(r.selector, r.styles);
              } else if (k === 'atRules' && Array.isArray(v)) {
                for (const r of v as any[]) {
                  if (r.type === 'keyframes') target.keyframes(r.name, r.steps);
                  else target.fontFace(r.properties);
                }
              } else {
                target.set(k, v);
              }
            }
          }
          return proxy;
        };
      } else if (typeof (target as any)[prop] === 'function') {
        fn = (...a: any[]) => { (target as any)[prop](...a); return proxy; };
      } else {
        fn = () => {
          throw new Error(`[ChainCSS v3.0].${String(prop)}() removed. Use your 16 typed methods or .raw('${String(prop)}', value)`);
        };
      }

      m.set(prop, fn);
      return fn;
    }
  });
  return proxy;
}