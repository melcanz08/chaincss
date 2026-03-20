import { useMemo, useEffect, useRef, useState } from 'react';
import { $, compile, chain } from './rtt';
const styleCache = new Map();
let styleSheet = null;
const initStyleSheet = () => {
  if (typeof document === 'undefined') return null;
  if (!styleSheet) {
    const existing = document.getElementById('chaincss-styles');
    if (existing) {
      styleSheet = existing;
      return styleSheet;
    }
    const style = document.createElement('style');
    style.id = 'chaincss-styles';
    style.setAttribute('data-chaincss', 'true');
    document.head.appendChild(style);
    styleSheet = style;
  }
  return styleSheet;
};
const updateStyles = (css) => {
  const sheet = initStyleSheet();
  if (sheet) {
    sheet.textContent = css;
  }
};
export function useChainStyles(styles, deps = [], options = {}) {
  const {
    cache = true,
    namespace = 'chain',
    watch = false
  } = options;
  const id = useRef(`chain-${Math.random().toString(36).substr(2, 9)}`);
  const [classNames, setClassNames] = useState({});
  const processed = useMemo(() => {
    const resolvedStyles = typeof styles === 'function' ? styles() : styles;
    if (!resolvedStyles || Object.keys(resolvedStyles).length === 0) {
      return { classNames: {}, css: '' };
    }
    const cacheKey = JSON.stringify(resolvedStyles);
    if (cache && styleCache.has(cacheKey)) {
      return styleCache.get(cacheKey);
    }
    const newClassNames = {};
    const compiledStyles = {};
    Object.entries(resolvedStyles).forEach(([key, styleDef]) => {
      const className = `${namespace}-${key}-${id.current}`;
      const styleObj = typeof styleDef === 'function' 
        ? styleDef() 
        : styleDef;
      newClassNames[key] = className;
      compiledStyles[`${key}_${id.current}`] = {
        selectors: [`.${className}`],
        ...styleObj
      };
    });
    compile(compiledStyles);
    const css = chain.cssOutput;
    const result = { classNames: newClassNames, css };
    if (cache) {
      styleCache.set(cacheKey, result);
    }
    return result;
  }, [styles, namespace, id.current, ...deps]);
  useEffect(() => {
    if (processed.css) {
      if (!watch) {
        const sheet = initStyleSheet();
        if (sheet) {
          const existingStyles = sheet.textContent || '';
          const styleRegex = new RegExp(`\\.[\\w-]*${id.current}[\\s\\S]*?}`, 'g');
          const cleanedStyles = existingStyles.replace(styleRegex, '');
          sheet.textContent = cleanedStyles + processed.css;
        }
      } else {
        updateStyles(processed.css);
      }
    }
    return () => {
      if (!watch && styleSheet) {
        const existingStyles = styleSheet.textContent || '';
        const styleRegex = new RegExp(`\\.[\\w-]*${id.current}[\\s\\S]*?}`, 'g');
        styleSheet.textContent = existingStyles.replace(styleRegex, '');
      }
    };
  }, [processed.css, watch]);
  return processed.classNames;
}
export function useDynamicChainStyles(styleFactory, deps = [], options = {}) {
  const styles = useMemo(() => {
    return styleFactory();
  }, deps);
  return useChainStyles(styles, options);
}
export function useThemeChainStyles(styles, theme, options = {}) {
  const themedStyles = useMemo(() => {
    if (typeof styles === 'function') {
      return styles(theme);
    }
    return styles;
  }, [styles, theme]);
  return useChainStyles(themedStyles, options);
}
export function ChainCSSGlobal({ styles }) {
  useChainStyles(styles, { watch: true });
  return null;
}
export function withChainStyles(styles, options = {}) {
  return function WrappedComponent(props) {
    const classNames = useChainStyles(
      typeof styles === 'function' ? styles(props) : styles,
      options
    );
    return <WrappedComponent {...props} chainStyles={classNames} />;
  };
}
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}