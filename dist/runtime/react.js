// src/runtime/react.tsx
import React, { useMemo, useEffect, useRef, useState } from "react";

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

// src/runtime/react.tsx
import { jsx } from "react/jsx-runtime";
var styleCache = /* @__PURE__ */ new Map();
function useChainStyles(styles, deps = [], options = {}) {
  const { cache = true, namespace = "chain", watch = false } = options;
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
      if (!watch) {
        for (const key of Object.keys(processed.classNames)) {
          styleInjector.remove(`${namespace}-${key}-${id.current}`);
        }
      }
    };
  }, [processed.classNames, watch]);
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
function createStyledComponents(components) {
  const result = {};
  for (const [name, config] of Object.entries(components)) {
    const { element = "div", styles, options } = config;
    result[name] = createStyledComponent(element, styles, options);
  }
  return result;
}
function useComputedStyles(styles, props, deps = [], options) {
  const computedStyles = useMemo(() => styles(props), [props, ...deps]);
  return useChainStyles(computedStyles, deps, options);
}
export {
  ChainCSSGlobal,
  createStyledComponent,
  createStyledComponents,
  cx,
  disableChainCSSDebug,
  enableChainCSSDebug,
  isDebugEnabled,
  useChainStyles,
  useComputedStyles,
  useDynamicChainStyles,
  useThemeChainStyles,
  withChainStyles
};
