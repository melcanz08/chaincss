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
function runRuntime(...styles) {
  let css = "";
  for (const style of styles) {
    if (style.selectors) {
      let normalStyles = "";
      let hoverStyles = "";
      for (const [key, value] of Object.entries(style)) {
        if (key === "selectors")
          continue;
        if (key === "hover" && typeof value === "object") {
          hoverStyles = `${style.selectors.join(", ")}:hover {
`;
          for (const [hoverKey, hoverValue] of Object.entries(value)) {
            const kebabKey = hoverKey.replace(/([A-Z])/g, "-$1").toLowerCase();
            hoverStyles += `  ${kebabKey}: ${hoverValue};
`;
          }
          hoverStyles += `}
`;
        } else {
          const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
          normalStyles += `  ${kebabKey}: ${value};
`;
        }
      }
      if (normalStyles) {
        css += `${style.selectors.join(", ")} {
${normalStyles}}
`;
      }
      if (hoverStyles) {
        css += hoverStyles;
      }
    }
  }
  if (css && styleInjector.getStyleElement()) {
    styleInjector.getStyleElement().textContent += css;
  }
  return css;
}

// src/runtime/react.tsx
import React, { useMemo, useEffect, useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
var styleCache = /* @__PURE__ */ new Map();
function useChainStyles(styles, deps = [], options = {}) {
  const { cache = true, namespace = "chain", watch: watch2 = false } = options;
  const id = useRef(`chain-${Math.random().toString(36).substr(2, 9)}`);
  const [classNames, setClassNames] = useState({});
  const processed = useMemo(() => {
    const resolvedStyles = typeof styles === "function" ? styles() : styles;
    if (!resolvedStyles || Object.keys(resolvedStyles).length === 0) {
      return { classNames: {}, css: "" };
    }
    const cacheKey = JSON.stringify(resolvedStyles);
    if (cache && styleCache.has(cacheKey)) {
      return { classNames: styleCache.get(cacheKey), css: "" };
    }
    const compiledStyles = {};
    const newClassNames = {};
    for (const [key, styleDef] of Object.entries(resolvedStyles)) {
      const className = `${namespace}-${key}-${id.current}`;
      const styleObj = typeof styleDef === "function" ? styleDef() : styleDef;
      newClassNames[key] = className;
      compiledStyles[`${key}_${id.current}`] = {
        selectors: [`.${className}`],
        ...styleObj
      };
    }
    const result = compileRuntime(compiledStyles);
    if (cache) {
      styleCache.set(cacheKey, result);
    }
    return { classNames: result, css: "" };
  }, [styles, namespace, id.current, ...deps]);
  useEffect(() => {
    setClassNames(processed.classNames);
    return () => {
      if (!watch2) {
        for (const key of Object.keys(processed.classNames)) {
          styleInjector.remove(`${namespace}-${key}-${id.current}`);
        }
      }
    };
  }, [processed.classNames, watch2]);
  return classNames;
}
function useDynamicChainStyles(styleFactory, deps = [], options) {
  const styles = useMemo(() => styleFactory(), deps);
  return useChainStyles(styles, deps, options);
}
function useThemeChainStyles(styles, theme, options) {
  const themedStyles = useMemo(() => {
    if (typeof styles === "function")
      return styles(theme);
    return styles;
  }, [styles, theme]);
  return useChainStyles(themedStyles, [], options);
}
function ChainCSSGlobal({ styles }) {
  useChainStyles(styles, [], { watch: true });
  return null;
}
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}
var debugEnabled = false;
function enableChainCSSDebug() {
  if (typeof window !== "undefined") {
    debugEnabled = true;
    window.__CHAINCSS_DEBUG__ = true;
    console.log("\u{1F50D} ChainCSS Debug Mode Enabled");
  }
}
function disableChainCSSDebug() {
  if (typeof window !== "undefined") {
    debugEnabled = false;
    window.__CHAINCSS_DEBUG__ = false;
    console.log("\u{1F50D} ChainCSS Debug Mode Disabled");
  }
}
function isDebugEnabled() {
  return debugEnabled || typeof window !== "undefined" && window.__CHAINCSS_DEBUG__;
}
function withChainStyles(styles, options) {
  return function WrappedComponent(props) {
    const classNames = useChainStyles(
      typeof styles === "function" ? styles(props) : styles,
      [],
      // ← Add empty deps array
      options
    );
    const Component = props.component || props.wrappedComponent;
    return /* @__PURE__ */ jsx(Component, { ...props, chainStyles: classNames });
  };
}
function createStyledComponent(elementType, styles, options) {
  const StyledComponent = (props) => {
    const { className: additionalClassName, ...rest } = props;
    const classNames = useChainStyles(styles, [], options);
    const combinedClassName = [classNames.root, additionalClassName].filter(Boolean).join(" ");
    return React.createElement(elementType, {
      ...rest,
      className: combinedClassName
    });
  };
  const displayName = typeof elementType === "string" ? elementType : elementType.displayName || "Component";
  StyledComponent.displayName = `ChainCSS.${displayName}`;
  return StyledComponent;
}
function useComputedStyles(styles, props, deps = [], options) {
  const computedStyles = useMemo(() => styles(props), [props, ...deps]);
  return useChainStyles(computedStyles, deps, options);
}

// src/runtime/vue.ts
import { ref, computed, inject, provide, h } from "vue";
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
var ChainCSSGlobal2 = {
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
function createStyledComponent2(styles, tag = "div") {
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
    result[name] = createStyledComponent2(styles, element);
  }
  return result;
}
function useComputedStyles2(styles, props) {
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

// src/runtime/hmr.ts
function setupHMR() {
  if (typeof window === "undefined")
    return;
  if (import.meta.hot) {
    import.meta.hot.on("chaincss:update", (payload) => {
      console.log(`[HMR] Updating styles for ${payload.file}`);
    });
  }
}
function registerForHMR(moduleId, styles) {
  if (typeof window === "undefined")
    return;
  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      console.log(`[HMR] Accepting update for ${moduleId}`);
    });
  }
}

// src/runtime/utils.ts
function generateStyleId(prefix = "chain") {
  const random = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}-${random}`;
}
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
function kebabCase(str) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}
var isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
var isDevelopment = true;
var isProduction = false;
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
function memoize(fn) {
  const cache = /* @__PURE__ */ new Map();
  const memoized = (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
  memoized.cache = cache;
  return memoized;
}
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
function devWarn(message, ...args) {
  if (isDevelopment) {
    console.warn(`[ChainCSS] ${message}`, ...args);
  }
}
function devLog(message, ...args) {
  if (isDevelopment) {
    console.log(`[ChainCSS] ${message}`, ...args);
  }
}
function logError(message, error) {
  console.error(`[ChainCSS] ${message}`, error || "");
}
function createDebugger(module) {
  return {
    log: (...args) => devLog(`[${module}]`, ...args),
    warn: (...args) => devWarn(`[${module}]`, ...args),
    error: (...args) => logError(`[${module}]`, ...args)
  };
}
export {
  $,
  ChainCSSGlobal,
  ChainCSSGlobal2 as ChainCSSGlobalVue,
  cn as cnUtils,
  compileRuntime as compile,
  createDebugger,
  createStyledComponent,
  createStyledComponent2 as createStyledVueComponent,
  createStyledComponents as createStyledVueComponents,
  cx,
  debounce,
  devLog,
  devWarn,
  disableChainCSSDebug,
  enableChainCSSDebug,
  generateStyleId,
  hashString,
  injectStyleContext,
  isBrowser,
  isDebugEnabled,
  isDevelopment,
  isProduction,
  kebabCase,
  logError,
  memoize,
  provideStyleContext,
  registerForHMR,
  runRuntime as run,
  setupHMR,
  styleInjector,
  useAtomicClasses,
  useChainStyles,
  useComputedStyles,
  useComputedStyles2 as useComputedStylesVue,
  useDynamicChainStyles,
  useThemeChainStyles,
  withChainStyles
};
