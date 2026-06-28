// src/core/style-proxy.ts

/**
 * StyleProxy — Creates the chainable proxy for StyleCollector.
 * Uses a dispatch map for method routing instead of a giant if/else chain.
 * 
 * IMPORTANT: This file does NOT import StyleCollector to avoid circular deps.
 * It uses a minimal interface that StyleCollector satisfies.
 */

// Minimal interface — StyleCollector satisfies this
interface StyleCollectorLike {
  set(prop: string, value: any): any;
  hover(): any;
  end(): any;
  $el(...selectors: string[]): any;
  build(selectors?: string[] | string): any;
  explain(): any;
  addClass(name: string): any;
  componentName(name: string): any;
  enableDebug(): any;
  isMixed(): boolean;
  media(query: string, fn: any): any;
  supports(condition: string, fn: any): any;
  container(query: string, fn: any): any;
  layer(name: string, fn: any): any;
  nest(selector: string, fn: any): any;
  children(fn: any): any;
  when(condition: boolean, fn: any): any;
  keyframes(name: string, steps: any): any;
  fontFace(props: any): any;
}

// ============================================================================
// Handler Map
// ============================================================================

type ProxyHandler = (target: StyleCollectorLike, proxy: any, ...args: any[]) => any;

const TERMINAL_HANDLERS: Record<string, ProxyHandler> = {
  $el: (target, _proxy, ...args: string[]) => target.$el(...args),
  build: (target, _proxy, ...args: any[]) => {
    const selectors = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    return target.build(selectors);
  },
  explain: (target) => target.explain(),
};

const CHAINABLE_HANDLERS: Record<string, ProxyHandler> = {
  hover: (target, proxy) => { target.hover(); return proxy; },
  end: (target, proxy) => { target.end(); return proxy; },
  debug: (target, proxy) => { target.enableDebug(); return proxy; },
  addClass: (target, proxy, name: string) => { target.addClass(name); return proxy; },
  componentName: (target, proxy, name: string) => { target.componentName(name); return proxy; },
  isMixed: (target, _proxy) => target.isMixed(),
};

const CHILD_BUILDER_HANDLERS: Record<string, ProxyHandler> = {
  media: (target, proxy, query: string, fn: Function) => {
    target.media(query, fn);
    return proxy;
  },
  supports: (target, proxy, condition: string, fn: Function) => {
    target.supports(condition, fn);
    return proxy;
  },
  container: (target, proxy, query: string, fn: Function) => {
    target.container(query, fn);
    return proxy;
  },
  layer: (target, proxy, name: string, fn: Function) => {
    target.layer(name, fn);
    return proxy;
  },
  nest: (target, proxy, selector: string, fn: Function) => {
    target.nest(selector, fn);
    return proxy;
  },
  children: (target, proxy, fn: Function) => {
    target.children(fn);
    return proxy;
  },
  when: (target, proxy, condition: boolean, fn: Function) => {
    target.when(condition, fn);
    return proxy;
  },
};

const SPECIAL_HANDLERS: Record<string, ProxyHandler> = {
  keyframes: (target, proxy, name: string, steps: any) => {
    target.keyframes(name, steps);
    return proxy;
  },
  fontFace: (target, proxy, props: any) => {
    target.fontFace(props);
    return proxy;
  },
};

// ============================================================================
// Proxy Factory
// ============================================================================

export function createStyleProxy(
  collector: StyleCollectorLike,
  macros: Record<string, Function>
): StyleCollectorLike & Record<string, any> {
  let proxy: any;

  proxy = new Proxy(collector, {
    get(target: StyleCollectorLike, prop: string) {
      if (prop in TERMINAL_HANDLERS) {
        return (...args: any[]) => TERMINAL_HANDLERS[prop](target, proxy, ...args);
      }
      if (prop in CHAINABLE_HANDLERS) {
        return (...args: any[]) => CHAINABLE_HANDLERS[prop](target, proxy, ...args);
      }
      if (prop in CHILD_BUILDER_HANDLERS) {
        return (...args: any[]) => CHILD_BUILDER_HANDLERS[prop](target, proxy, ...args);
      }
      if (prop in SPECIAL_HANDLERS) {
        return (...args: any[]) => SPECIAL_HANDLERS[prop](target, proxy, ...args);
      }
      if (prop === 'then') return undefined;
      if (prop === '_mixed') return target.isMixed();

      if (macros[prop]) {
        return (value: any) => {
          target.set(prop, value);
          return proxy;
        };
      }

      if (typeof (target as any)[prop] === 'function' &&
          !['set', 'build', '$el', 'hover', 'end'].includes(prop)) {
        return (...args: any[]) => {
          (target as any)[prop](...args);
          return proxy;
        };
      }

      return (value: any) => {
        target.set(prop, value);
        return proxy;
      };
    }
  });

  return proxy;
}