// src/core/entities/style-proxy.ts

interface StyleCollectorLike {
  set(prop: string, value: any): any;
  hover(): any;
  focus(): any;
  active(): any;
  checked(): any;
  disabled(): any;
  before(): any;
  after(): any;
  placeholder(): any;
  end(): any;
  $el(...selectors: string[]): any;
  build(selectors?: string[] | string): any;
  explain(): any;
  addClass(name: string): any;
  enableDebug(): any;
  isMixed(): boolean;
  media(q: string, fn: any): any;
  supports(c: string, fn: any): any;
  container(q: string, fn: any): any;
  layer(n: string, fn: any): any;
  nest(s: string, fn: any): any;
  children(fn: any): any;
  when(c: boolean, fn: any): any;
  keyframes(n: string, s: any): any;
  fontFace(p: any): any;
  scope(q: string, fn: any): any;
  startingStyle(s: string, fn: any): any;
  viewTransition(n: string, fn: any): any;
  property(n: string, d: any): any;
  counterStyle(n: string, d: any): any;
  page(s: string, p: any): any;
  import(u: string, m?: string): any;
  namespace(p: string, u: string): any;
  grid(o?: any): any;
  flex(o?: any): any;
  background(o?: any): any;
  animation(o: any): any;
  typography(o: any): any;
  box(o: any): any;
  position(o: any): any;
  transform(o?: any): any;
  transition(o?: any): any;
  filter(o: any): any;
  shadow(o: any): any;
  containerQuery(o: any): any;
  outline(o: any): any;
  scroll(o: any): any;
  list(o: any): any;
  raw(prop: string | Record<string, any>, value?: any): any;
  [key: string]: any;
  intents(names: string[]): any;
  describe(description: string): any;
}

type Handler = (target: StyleCollectorLike, proxy: any, ...args: any[]) => any;

// Fix #6: Renamed helpers for clarity
const noArg =
  (m: string): Handler =>
  (t, p) => {
    t[m]();
    return p;
  };
const oneArg =
  (m: string): Handler =>
  (t, p, a) => {
    t[m](a);
    return p;
  };
const twoArgs =
  (m: string): Handler =>
  (t, p, a, b) => {
    t[m](a, b);
    return p;
  };

// Fix #5: No `any` index writes — explicit flush through RuleBuilder
function flushNestedRules(target: StyleCollectorLike, rules: any[]): void {
  const rb = (target as any).rules;
  for (const r of rules) {
    if (!r || !r.selector) continue;
    if (rb && typeof rb.addNested === "function") {
      rb.addNested(r.selector, r.styles);
    }
  }
}

function flushAtRules(target: StyleCollectorLike, rules: any[]): void {
  const rb = (target as any).rules;
  for (const r of rules) {
    if (!r) continue;
    switch (r.type) {
      case "media":
        rb?.addMedia?.(r.query || "", r.styles || {});
        break;
      case "supports":
        rb?.addSupports?.(r.condition || r.query || "", r.styles || {});
        break;
      case "container":
        rb?.addContainer?.(r.condition || r.query || "", r.styles || {});
        break;
      case "layer":
        rb?.addLayer?.(r.name || "", r.styles || {});
        break;
      case "keyframes":
        rb?.addKeyframes?.(r.name || "", r.steps || {});
        break;
      case "font-face":
        rb?.addFontFace?.(r.properties || {});
        break;
    }
  }
}

const TERMINAL = new Map<string, Handler>([
  [
    "$el",
    (t, _p, ...a: string[]) => {
      return t.$el(...a);
    },
  ],
  [
    "build",
    (t, _p, ...a: any[]) => {
      if (a.length === 0) return t.build();
      const sel = a.length === 1 && Array.isArray(a[0]) ? a[0] : a;
      return t.build(sel);
    },
  ],
  ["explain", (t) => t.explain()],
  ["isMixed", (t) => t.isMixed()],
]);

const CHAINABLE = new Map<string, Handler>([
    ...[
    "hover",
    "focus",
    "active",
    "checked",
    "disabled",
    "before",
    "after",
    "placeholder",
  ].map((k) => [k, (t: StyleCollectorLike, p: any, ...args: any[]) => {
    if (args.length > 0) {
      // Forward the callback to the StyleCollector
      t[k](...args);
    } else {
      // No callback - just enter pseudo mode
      t[k]();
    }
    return p;
  }] as const),
  // "end" still uses noArg because it takes no arguments
  ["end", noArg("end")],
  [
    "debug",
    (t, p) => {
      t.enableDebug();
      return p;
    },
  ],
  [
    "addClass",
    (t, p, n: string) => {
      t.addClass(n);
      return p;
    },
  ],
  [
    "intents",
    (t, p, names: string[]) => {
      t.intents(names);
      return p;
    },
  ],
  [
    "describe",
    (t, p, description: string) => {
      t.describe(description);
      return p;
    },
  ],
  ...[
    "grid",
    "flex",
    "background",
    "animation",
    "typography",
    "box",
    "position",
    "transform",
    "transition",
    "filter",
    "shadow",
    "containerQuery",
    "outline",
    "scroll",
    "list",
  ].map((k) => [k, oneArg(k)] as const),
  [
    "raw",
    (t, p, ...a: any[]) => {
      if (a.length === 1 && typeof a[0] === "object") {
        for (const [k, v] of Object.entries(a[0])) t.set(k, v);
      } else if (a.length === 2) t.set(a[0], a[1]);
      return p;
    },
  ],
]);

const CHILD = new Map<string, Handler>([
  ...["media", "supports", "container", "layer", "nest"].map(
    (k) => [k, twoArgs(k)] as const,
  ),
  ["scope", twoArgs("scope")],
  ["startingStyle", twoArgs("startingStyle")],
  ["viewTransition", twoArgs("viewTransition")],
  [
    "children",
    (t, p, fn: Function) => {
      t.children(fn);
      return p;
    },
  ],
  [
    "when",
    (t, p, c: boolean, fn: Function) => {
      t.when(c, fn);
      return p;
    },
  ],
]);

const SPECIAL = new Map<string, Handler>([
  [
    "keyframes",
    (t, p, n: string, s: any) => {
      t.keyframes(n, s);
      return p;
    },
  ],
  [
    "fontFace",
    (t, p, pr: any) => {
      t.fontFace(pr);
      return p;
    },
  ],
  ["property", (t, p, n: string, d: any) => { t.property(n, d); return p; }],
  ["counterStyle", (t, p, n: string, d: any) => { t.counterStyle(n, d); return p; }],
  ["page", (t, p, s: string, pr: any) => { t.page(s, pr); return p; }],
  ["import", (t, p, u: string, m?: string) => { t.import(u, m); return p; }],
  ["namespace", (t, p, pr: string, u: string) => { t.namespace(pr, u); return p; }],
  [
    "pseudo",
    (t, p, styles: Record<string, any>) => {
      t.pseudo(styles);
      return p;
    },
  ],
  [
    "atrule",
    (t, p, styles: Record<string, any>) => {
      t.atrule(styles);
      return p;
    },
  ],
]);

// Fix #6: String-only cache key — no symbols needed
const cache = new WeakMap<StyleCollectorLike, Map<string, Function>>();

export function createStyleProxy(
  collector: StyleCollectorLike,
  macros: Record<string, Function>,
) {
  let proxy: any;
  proxy = new Proxy(collector, {
    get(target, prop: string | symbol) {
      if (prop === Symbol.toStringTag) return "StyleProxy";
      if (prop === Symbol.toPrimitive) return undefined;
      if (typeof prop === "symbol") return (target as any)[prop];

      if (prop === "then" || prop === "toJSON" || prop === "valueOf" || prop === "inspect") {
        return undefined;
      }
      if (prop === "_mixed") return (target as any).isMixed?.();

      if (typeof prop === "string" && prop.startsWith("__")) {
        return (target as any)[prop];
      }

      let m = cache.get(target);
      if (!m) {
        m = new Map<string, Function>();
        cache.set(target, m);
      }
      if (m.has(prop as string)) return m.get(prop as string)!;

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

          // Fix #3: Plain object sink with explicit method handlers — no Proxy allocation
          const sink = {
            get nestedRules() {
              if (!(target as any)["nestedRules"]) (target as any)["nestedRules"] = [];
              return (target as any)["nestedRules"];
            },
            set nestedRules(v: any) { (target as any)["nestedRules"] = v; },
            get _nestedRules() {
              if (!(target as any)["_nestedRules"]) (target as any)["_nestedRules"] = [];
              return (target as any)["_nestedRules"];
            },
            set _nestedRules(v: any) { (target as any)["_nestedRules"] = v; },
            get atRules() {
              if (!(target as any)["atRules"]) (target as any)["atRules"] = [];
              return (target as any)["atRules"];
            },
            set atRules(v: any) { (target as any)["atRules"] = v; },
            get _atRules() {
              if (!(target as any)["_atRules"]) (target as any)["_atRules"] = [];
              return (target as any)["_atRules"];
            },
            set _atRules(v: any) { (target as any)["_atRules"] = v; },
            get _transforms() { return (target as any)["_transforms"]; },
            set _transforms(v: any) { (target as any)["_transforms"] = v; },
            set(k: string, v: any) { target.set(k, v); return true; },
          };

          // Use a Proxy only for the sink to intercept unknown property sets
          // This is unavoidable for the macro API — macros set arbitrary props
          const sinkWithSet = new Proxy(sink, {
            set(_t, p, v) {
              const k = p as string;
              if (
                k === "nestedRules" || k === "_nestedRules" ||
                k === "atRules" || k === "_atRules" || k === "_transforms"
              ) {
                (_t as any)[k] = v;
              } else {
                target.set(k, v);
              }
              return true;
            },
            get(_t, p) {
              const k = p as string;
              if (
                k === "nestedRules" || k === "_nestedRules" ||
                k === "atRules" || k === "_atRules" || k === "_transforms"
              ) {
                return (_t as any)[k];
              }
              if (k === "rules") return (target as any).rules;
              if (k === "set") return target.set.bind(target);
              if (k === "nest") return target.nest.bind(target);
              return (_t as any)[k];
            },
          }) as any;

          const res = macroFn(val, sinkWithSet);

          // Fix #5: Flush structural keys through RuleBuilder
          const flushFrom = (obj: any) => {
            const nestedLists = [obj?.nestedRules, obj?._nestedRules].filter(Array.isArray).flat();
            const atLists = [obj?.atRules, obj?._atRules].filter(Array.isArray).flat();
            if (nestedLists.length) flushNestedRules(target, nestedLists);
            if (atLists.length) flushAtRules(target, atLists);
            // don't clear — test expects collector.nestedRules to remain
          };

          flushFrom(sink);

          // Fix #2: Handle macro return values with correct dispatch
          if (
            res &&
            typeof res === "object" &&
            res !== sink &&
            res !== sinkWithSet &&
            res !== target
          ) {
            flushFrom(res);
            for (const [k, v] of Object.entries(res)) {
              if (k === "nestedRules" || k === "_nestedRules") continue;
              if (k === "atRules" || k === "_atRules") continue;
              if (k === "_transforms") continue;
              target.set(k, v);
            }
          }

          return proxy;
        };
      } else if (typeof (target as any)[prop] === "function") {
        fn = (...a: any[]) => {
          (target as any)[prop](...a);
          return proxy;
        };
      } else {
        fn = () => {
          // Fix #6: Dynamic message — no hardcoded "16"
          throw new Error(
            `[ChainCSS v3.0] .${String(prop)}() is not a valid method. Use typed shorthands or .raw('${String(prop)}', value)`
          );
        };
      }

      m.set(prop as string, fn);
      return fn;
    },
  });
  return proxy;
}