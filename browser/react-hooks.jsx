import { useMemo, useEffect, useRef, useState } from 'react';
import { $, compile, chain } from './rtt';

// Cache for generated styles to avoid duplication
const styleCache = new Map();
let styleSheet = null;

// Initialize style sheet (add to document head)
const initStyleSheet = () => {
  if (typeof document === 'undefined') return null; // SSR safety
  
  if (!styleSheet) {
    // Check if already exists
    const existing = document.getElementById('chaincss-styles');
    if (existing) {
      styleSheet = existing;
      return styleSheet;
    }
    
    // Create new style element
    const style = document.createElement('style');
    style.id = 'chaincss-styles';
    style.setAttribute('data-chaincss', 'true');
    document.head.appendChild(style);
    styleSheet = style;
  }
  
  return styleSheet;
};

// Update styles in the style sheet
const updateStyles = (css) => {
  const sheet = initStyleSheet();
  if (sheet) {
    sheet.textContent = css;
  }
};

// Main hook for using ChainCSS styles in React
export function useChainStyles(styles, deps = [], options = {}) {
  const {
    cache = true,
    namespace = 'chain',
    watch = false
  } = options;

  // Generate a unique ID for this component instance
  const id = useRef(`chain-${Math.random().toString(36).substr(2, 9)}`);
  
  // Store the generated class names
  const [classNames, setClassNames] = useState({});
  
  // Process styles and generate CSS
  const processed = useMemo(() => {
    // ✅ FIRST: Resolve styles if it's a function
    const resolvedStyles = typeof styles === 'function' ? styles() : styles;
    
    if (!resolvedStyles || Object.keys(resolvedStyles).length === 0) {
      return { classNames: {}, css: '' };
    }
    
    // ✅ NOW use resolvedStyles for cache key
    const cacheKey = JSON.stringify(resolvedStyles);
    if (cache && styleCache.has(cacheKey)) {
      return styleCache.get(cacheKey);
    }
    
    // Generate unique class names for each style
    const newClassNames = {};
    const compiledStyles = {};
    
    // ✅ Use resolvedStyles here
    Object.entries(resolvedStyles).forEach(([key, styleDef]) => {
      // Generate a unique class name
      const className = `${namespace}-${key}-${id.current}`;
      
      // Create a style definition with the unique class
      const styleObj = typeof styleDef === 'function' 
        ? styleDef() 
        : styleDef;
      
      // Store the class name mapping
      newClassNames[key] = className;
      
      // Create the style rule
      compiledStyles[`${key}_${id.current}`] = {
        selectors: [`.${className}`],
        ...styleObj
      };
    });
    
    // Compile to CSS
    compile(compiledStyles);
    const css = chain.cssOutput;
    
    const result = { classNames: newClassNames, css };
    
    if (cache) {
      styleCache.set(cacheKey, result);
    }
    
    return result;
  }, [styles, namespace, id.current, ...deps]);
  
  // Update the style sheet when styles change
  useEffect(() => {
    if (processed.css) {
      // For simple apps, just append
      if (!watch) {
        const sheet = initStyleSheet();
        if (sheet) {
          // Remove old styles for this component
          const existingStyles = sheet.textContent || '';
          const styleRegex = new RegExp(`\\.[\\w-]*${id.current}[\\s\\S]*?}`, 'g');
          const cleanedStyles = existingStyles.replace(styleRegex, '');
          
          // Add new styles
          sheet.textContent = cleanedStyles + processed.css;
        }
      } else {
        // For watch mode, update everything
        updateStyles(processed.css);
      }
    }
    
    // Cleanup on unmount
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

// Hook for dynamic styles that depend on props/state
export function useDynamicChainStyles(styleFactory, deps = [], options = {}) {
  const styles = useMemo(() => {
    return styleFactory();
  }, deps);
  
  return useChainStyles(styles, options);
}

// Hook for theme-aware styles
export function useThemeChainStyles(styles, theme, options = {}) {
  const themedStyles = useMemo(() => {
    if (typeof styles === 'function') {
      return styles(theme);
    }
    return styles;
  }, [styles, theme]);
  
  return useChainStyles(themedStyles, options);
}

// Component for injecting global ChainCSS styles
export function ChainCSSGlobal({ styles }) {
  useChainStyles(styles, { watch: true });
  return null;
}

// HOC for adding ChainCSS styles to components
export function withChainStyles(styles, options = {}) {
  return function WrappedComponent(props) {
    const classNames = useChainStyles(
      typeof styles === 'function' ? styles(props) : styles,
      options
    );
    
    return <WrappedComponent {...props} chainStyles={classNames} />;
  };
}

// Utility to combine multiple class names
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}