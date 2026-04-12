// src/runtime/vue.ts
import { ref, computed, inject, provide, h } from "vue";

// src/runtime/injector.ts
var StyleInjector = class {
  styleElement = null;
  stylesCache = /* @__PURE__ */ new Map();
  injectedStyles = /* @__PURE__ */ new Set();
  constructor() {
    this.initStyleElement();
  }
  initStyleElement() {
    if (typeof document === "undefined")
      return;
    const existing = document.getElementById("chaincss-runtime-styles");
    if (existing) {
      this.styleElement = existing;
      return;
    }
    const style = document.createElement("style");
    style.id = "chaincss-runtime-styles";
    style.setAttribute("data-chaincss", "runtime");
    document.head.appendChild(style);
    this.styleElement = style;
  }
  generateClassName(styleId) {
    let hash = 0;
    for (let i = 0; i < styleId.length; i++) {
      hash = (hash << 5) - hash + styleId.charCodeAt(i);
      hash |= 0;
    }
    return `c_${Math.abs(hash).toString(36)}`;
  }
  generateCSS(style, className) {
    let css = "";
    const selector = `.${className}`;
    let normalStyles = "";
    for (const [key, value] of Object.entries(style)) {
      if (key === "selectors" || key === "hover")
        continue;
      const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      normalStyles += `  ${kebabKey}: ${value};
`;
    }
    if (normalStyles) {
      css += `${selector} {
${normalStyles}}
`;
    }
    if (style.hover && typeof style.hover === "object") {
      let hoverStyles = "";
      for (const [key, value] of Object.entries(style.hover)) {
        const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        hoverStyles += `  ${kebabKey}: ${value};
`;
      }
      if (hoverStyles) {
        css += `${selector}:hover {
${hoverStyles}}
`;
      }
    }
    return css;
  }
  inject(styleId, style) {
    if (this.stylesCache.has(styleId)) {
      return this.stylesCache.get(styleId);
    }
    const className = this.generateClassName(styleId);
    const css = this.generateCSS(style, className);
    this.stylesCache.set(styleId, className);
    if (!this.injectedStyles.has(styleId) && this.styleElement && css) {
      this.styleElement.textContent += css;
      this.injectedStyles.add(styleId);
    }
    return className;
  }
  injectMultiple(styles) {
    const result = {};
    let allCSS = "";
    for (const [styleId, style] of Object.entries(styles)) {
      if (this.stylesCache.has(styleId)) {
        result[styleId] = this.stylesCache.get(styleId);
        continue;
      }
      const className = this.generateClassName(styleId);
      const css = this.generateCSS(style, className);
      this.stylesCache.set(styleId, className);
      result[styleId] = className;
      allCSS += css;
    }
    if (allCSS && this.styleElement) {
      this.styleElement.textContent += allCSS;
    }
    return result;
  }
  update(styleId, style) {
    this.injectedStyles.delete(styleId);
    const className = this.generateClassName(styleId);
    const css = this.generateCSS(style, className);
    this.stylesCache.set(styleId, className);
    if (this.styleElement) {
      let allCSS = "";
      for (const [id, className2] of this.stylesCache) {
      }
      this.styleElement.textContent = allCSS;
      this.injectedStyles.add(styleId);
    }
    return className;
  }
  remove(styleId) {
    this.injectedStyles.delete(styleId);
    this.stylesCache.delete(styleId);
    if (this.styleElement) {
      let allCSS = "";
      for (const [id, className] of this.stylesCache) {
      }
      this.styleElement.textContent = allCSS;
    }
  }
  getStyleElement() {
    return this.styleElement;
  }
  clear() {
    this.stylesCache.clear();
    this.injectedStyles.clear();
    if (this.styleElement) {
      this.styleElement.textContent = "";
    }
  }
};
var styleInjector = new StyleInjector();
function chainRuntime(useTokens = false) {
  const catcher = {};
  const handler = {
    get: (target, prop) => {
      if (prop === "$el") {
        return (...selectors) => {
          if (selectors.length === 0) {
            const result2 = { ...catcher };
            Object.keys(catcher).forEach((key) => delete catcher[key]);
            return result2;
          }
          const result = {
            selectors,
            ...catcher
          };
          Object.keys(catcher).forEach((key) => delete catcher[key]);
          return result;
        };
      }
      if (prop === "hover") {
        return () => {
          const hoverCatcher = {};
          const hoverHandler = {
            get: (_, hoverProp) => {
              if (hoverProp === "end") {
                return () => {
                  catcher.hover = { ...hoverCatcher };
                  Object.keys(hoverCatcher).forEach((key) => delete hoverCatcher[key]);
                  return proxy;
                };
              }
              return (value) => {
                hoverCatcher[hoverProp] = value;
                return hoverProxy;
              };
            }
          };
          const hoverProxy = new Proxy({}, hoverHandler);
          return hoverProxy;
        };
      }
      if (prop === "end") {
        return () => proxy;
      }
      return (value) => {
        catcher[prop] = value;
        return proxy;
      };
    }
  };
  const proxy = new Proxy({}, handler);
  return proxy;
}
var $ = chainRuntime();
function compileRuntime(styles) {
  return styleInjector.injectMultiple(styles);
}

// src/runtime/vue.ts
var CHAIN_CSS_KEY = Symbol("chaincss");
function useAtomicClasses(styles, options = {}) {
  const { atomic = true, global = false } = options;
  const id = `chain-${Math.random().toString(36).substr(2, 9)}`;
  const classes = computed(() => {
    const resolvedStyles = typeof styles === "function" ? styles() : styles?.value || styles;
    if (!resolvedStyles)
      return {};
    const compiledStyles = {};
    const classNames = {};
    for (const [key, styleDef] of Object.entries(resolvedStyles)) {
      const className = `${key}-${id}`;
      const styleObj = typeof styleDef === "function" ? styleDef() : styleDef;
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
    cx: (name) => classes.value[name],
    cn: (...names) => names.map((name) => classes.value[name]).filter(Boolean).join(" ")
  };
}
var ChainCSSGlobal = {
  name: "ChainCSSGlobal",
  props: {
    styles: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    useAtomicClasses(props.styles);
    return () => null;
  }
};
function createStyledComponent(styles, tag = "div") {
  return {
    name: "ChainCSSStyledComponent",
    props: {
      className: { type: String, default: "" }
    },
    setup(props, { slots, attrs }) {
      const resolvedStyles = typeof styles === "function" ? styles() : styles;
      const { classes } = useAtomicClasses({ root: resolvedStyles });
      const combinedClass = computed(() => {
        const rootClass = classes.value?.root || "";
        return [rootClass, props.className].filter(Boolean).join(" ");
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
function createStyledComponents(components) {
  const result = {};
  for (const [name, config] of Object.entries(components)) {
    const { element = "div", styles } = config;
    result[name] = createStyledComponent(styles, element);
  }
  return result;
}
function useComputedStyles(styles, props) {
  const computedStyles = computed(() => ({ root: styles(props) }));
  const { classes } = useAtomicClasses(computedStyles);
  return {
    classes,
    rootClass: computed(() => classes.value?.root || "")
  };
}
function provideStyleContext(theme) {
  const themeRef = ref(theme);
  provide(CHAIN_CSS_KEY, themeRef);
  return themeRef;
}
function injectStyleContext() {
  return inject(CHAIN_CSS_KEY, ref({}));
}
export {
  ChainCSSGlobal,
  createStyledComponent,
  createStyledComponents,
  injectStyleContext,
  provideStyleContext,
  useAtomicClasses,
  useComputedStyles
};
