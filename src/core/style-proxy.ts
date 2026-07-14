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
  focus(): any;
  active(): any;
  checked(): any;
  disabled(): any;
  before(): any;
  after(): any;
  placeholder(): any;
  // Shorthand methods
  grid(options?: any): any;
  flex(options?: any): any;
  background(options?: any): any;
  animation(options: any): any;
  typography(options: any): any;
  box(options: any): any;
  position(options: any): any;
  transform(options?: any): any;
  transition(options?: any): any;
  filter(options: any): any;
  shadow(options: any): any;
  containerQuery(options: any): any;
  outline(options: any): any;
  scroll(options: any): any;
  list(options: any): any;
  raw(prop: string | Record<string, any>, value?: any): any;
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
  focus: (target, proxy) => { target.focus(); return proxy; },
  active: (target, proxy) => { target.active(); return proxy; },
  checked: (target, proxy) => { target.checked(); return proxy; },
  disabled: (target, proxy) => { target.disabled(); return proxy; },
  before: (target, proxy) => { target.before(); return proxy; },
  after: (target, proxy) => { target.after(); return proxy; },
  end: (target, proxy) => { target.end(); return proxy; },
  debug: (target, proxy) => { target.enableDebug(); return proxy; },
  addClass: (target, proxy, name: string) => { target.addClass(name); return proxy; },
  isMixed: (target, _proxy) => target.isMixed(),
  placeholder: (target, proxy) => { target.placeholder(); return proxy; },

  // Shorthand methods — each returns the proxy for chaining
  animation: (target, proxy, options: any) => {
    target.animation(options);
    return proxy;
  },
  typography: (target, proxy, options: any) => {
    target.typography(options);
    return proxy;
  },
  box: (target, proxy, options: any) => {
    target.box(options);
    return proxy;
  },
  position: (target, proxy, options: any) => {
    target.position(options);
    return proxy;
  },
  transition: (target, proxy, ...args: any[]) => {
    if (args.length === 0) return proxy;
    if (typeof args[0] === 'string') target.transition(args[0]);
    else target.transition(args[0]);
    return proxy;
  },
  transform: (target, proxy, ...args: any[]) => {
    if (args.length === 0) return proxy;
    if (typeof args[0] === 'string') target.transform(args[0]);
    else target.transform(args[0]);
    return proxy;
  },
  filter: (target, proxy, options: any) => {
    target.filter(options);
    return proxy;
  },
  shadow: (target, proxy, options: any) => {
    target.shadow(options);
    return proxy;
  },
  containerQuery: (target, proxy, options: any) => {
    target.containerQuery(options);
    return proxy;
  },
  grid: (target, proxy, ...args: any[]) => {
    if (args.length === 0) target.grid();
    else if (typeof args[0] === 'string') target.grid(args[0]);
    else target.grid(args[0]);
    return proxy;
  },
  flex: (target, proxy, ...args: any[]) => {
    if (args.length === 0) target.flex();
    else if (typeof args[0] === 'string') target.flex(args[0]);
    else target.flex(args[0]);
    return proxy;
  },
  background: (target, proxy, ...args: any[]) => {
    if (args.length === 0) target.background();
    else if (typeof args[0] === 'string') target.background(args[0]);
    else target.background(args[0]);
    return proxy;
  },
  outline: (target, proxy, options: any) => { target.outline(options); return proxy; },
  scroll: (target, proxy, options: any) => { target.scroll(options); return proxy; },
  list: (target, proxy, options: any) => { target.list(options); return proxy; },
  raw: (target, proxy, ...args: any[]) => {
    if (args.length === 1 && typeof args[0] === 'object') {
      // Object form: .raw({ outline: 'none', resize: 'vertical' })
      for (const [key, val] of Object.entries(args[0])) {
        target.set(key, val);
      }
    } else if (args.length === 2) {
      // Key-value form: .raw('outline', 'none')
      target.set(args[0], args[1]);
    }
    return proxy;
  },
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

      // Guard against runtime symbol inspection (Symbol.iterator, etc.)
      if (typeof prop === 'symbol' || (typeof prop === 'string' && prop.startsWith('__'))) {
        return (target as any)[prop];
      }

      // Default: treat as CSS property setter
      return (value: any) => {
        target.set(prop, value);
        return proxy;
      };
    }
  });

  return proxy;
}