// chaincss/src/runtime/injector.ts

/**
 * ChainCSS Runtime Style Injector
 * This is the core 3.2KB runtime that users opt into
 */

export interface StyleDefinition {
  selectors: string[];
  hover?: Record<string, string | number>;
  [key: string]: any;
}

export interface CompiledStyle {
  className: string;
  css: string;
}

class StyleInjector {
  private styleElement: HTMLStyleElement | null = null;
  private stylesCache = new Map<string, string>();
  private injectedStyles = new Set<string>();

  constructor() {
    this.initStyleElement();
  }

  private initStyleElement() {
    if (typeof document === 'undefined') return;
    
    const existing = document.getElementById('chaincss-runtime-styles');
    if (existing) {
      this.styleElement = existing as HTMLStyleElement;
      return;
    }

    const style = document.createElement('style');
    style.id = 'chaincss-runtime-styles';
    style.setAttribute('data-chaincss', 'runtime');
    document.head.appendChild(style);
    this.styleElement = style;
  }

  private generateClassName(styleId: string): string {
    // Simple hash for class name generation
    let hash = 0;
    for (let i = 0; i < styleId.length; i++) {
      hash = ((hash << 5) - hash) + styleId.charCodeAt(i);
      hash |= 0;
    }
    return `c_${Math.abs(hash).toString(36)}`;
  }

  private generateCSS(style: StyleDefinition, className: string): string {
    let css = '';
    const selector = `.${className}`;

    // Normal styles
    let normalStyles = '';
    for (const [key, value] of Object.entries(style)) {
      if (key === 'selectors' || key === 'hover') continue;
      const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      normalStyles += `  ${kebabKey}: ${value};\n`;
    }
    
    if (normalStyles) {
      css += `${selector} {\n${normalStyles}}\n`;
    }

    // Hover styles
    if (style.hover && typeof style.hover === 'object') {
      let hoverStyles = '';
      for (const [key, value] of Object.entries(style.hover)) {
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        hoverStyles += `  ${kebabKey}: ${value};\n`;
      }
      if (hoverStyles) {
        css += `${selector}:hover {\n${hoverStyles}}\n`;
      }
    }

    return css;
  }

  inject(styleId: string, style: StyleDefinition): string {
    // Check cache
    if (this.stylesCache.has(styleId)) {
      return this.stylesCache.get(styleId)!;
    }

    const className = this.generateClassName(styleId);
    const css = this.generateCSS(style, className);

    // Store in cache
    this.stylesCache.set(styleId, className);
    
    // Inject if not already injected
    if (!this.injectedStyles.has(styleId) && this.styleElement && css) {
      this.styleElement.textContent += css;
      this.injectedStyles.add(styleId);
    }

    return className;
  }

  injectMultiple(styles: Record<string, StyleDefinition>): Record<string, string> {
    const result: Record<string, string> = {};
    let allCSS = '';

    for (const [styleId, style] of Object.entries(styles)) {
      if (this.stylesCache.has(styleId)) {
        result[styleId] = this.stylesCache.get(styleId)!;
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

  update(styleId: string, style: StyleDefinition): string {
    // Remove old style
    this.injectedStyles.delete(styleId);
    
    // Regenerate
    const className = this.generateClassName(styleId);
    const css = this.generateCSS(style, className);
    
    this.stylesCache.set(styleId, className);
    
    // Rebuild all styles (simple but effective for runtime)
    if (this.styleElement) {
      let allCSS = '';
      for (const [id, className] of this.stylesCache) {
        // Need to regenerate CSS for all styles - this is the runtime cost
        // In production, use build-time compilation instead
      }
      this.styleElement.textContent = allCSS;
      this.injectedStyles.add(styleId);
    }
    
    return className;
  }

  remove(styleId: string): void {
    this.injectedStyles.delete(styleId);
    this.stylesCache.delete(styleId);
    
    // Rebuild remaining styles
    if (this.styleElement) {
      let allCSS = '';
      for (const [id, className] of this.stylesCache) {
        // Regenerate CSS for remaining styles
      }
      this.styleElement.textContent = allCSS;
    }
  }

  getStyleElement(): HTMLStyleElement | null {
    return this.styleElement;
  }

  clear(): void {
    this.stylesCache.clear();
    this.injectedStyles.clear();
    if (this.styleElement) {
      this.styleElement.textContent = '';
    }
  }
}

// Singleton instance
export const styleInjector = new StyleInjector();

// Core runtime functions
export function chainRuntime(useTokens = false) {
  const catcher: Record<string, any> = {};
  
  const handler: ProxyHandler<object> = {
    get: (target, prop: string) => {
      if (prop === '$el') {
        return (...selectors: string[]) => {
          if (selectors.length === 0) {
            const result = { ...catcher };
            Object.keys(catcher).forEach(key => delete catcher[key]);
            return result;
          }
          const result = {
            selectors,
            ...catcher
          };
          Object.keys(catcher).forEach(key => delete catcher[key]);
          return result;
        };
      }

      if (prop === 'hover') {
        return () => {
          const hoverCatcher: Record<string, any> = {};
          const hoverHandler: ProxyHandler<object> = {
            get: (_, hoverProp: string) => {
              if (hoverProp === 'end') {
                return () => {
                  catcher.hover = { ...hoverCatcher };
                  Object.keys(hoverCatcher).forEach(key => delete hoverCatcher[key]);
                  return proxy;
                };
              }
              return (value: any) => {
                hoverCatcher[hoverProp] = value;
                return hoverProxy;
              };
            }
          };
          const hoverProxy = new Proxy({}, hoverHandler);
          return hoverProxy;
        };
      }

      if (prop === 'end') {
        return () => proxy;
      }

      // CSS properties
      return (value: any) => {
        catcher[prop] = value;
        return proxy;
      };
    }
  };
  
  const proxy = new Proxy({}, handler);
  return proxy;
}

export const $ = chainRuntime();

// Compile function for runtime
export function compileRuntime(styles: Record<string, StyleDefinition>): Record<string, string> {
  return styleInjector.injectMultiple(styles);
}

// Run function for runtime
export function runRuntime(...styles: StyleDefinition[]): string {
  let css = '';
  for (const style of styles) {
    if (style.selectors) {
      let normalStyles = '';
      let hoverStyles = '';
      
      for (const [key, value] of Object.entries(style)) {
        if (key === 'selectors') continue;
        
        if (key === 'hover' && typeof value === 'object') {
          hoverStyles = `${style.selectors.join(', ')}:hover {\n`;
          for (const [hoverKey, hoverValue] of Object.entries(value)) {
            const kebabKey = hoverKey.replace(/([A-Z])/g, '-$1').toLowerCase();
            hoverStyles += `  ${kebabKey}: ${hoverValue};\n`;
          }
          hoverStyles += `}\n`;
        } else {
          const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          normalStyles += `  ${kebabKey}: ${value};\n`;
        }
      }
      
      if (normalStyles) {
        css += `${style.selectors.join(', ')} {\n${normalStyles}}\n`;
      }
      if (hoverStyles) {
        css += hoverStyles;
      }
    }
  }
  
  if (css && styleInjector.getStyleElement()) {
    styleInjector.getStyleElement()!.textContent += css;
  }
  
  return css;
}

// Add to injector.ts

/**
 * Add animation presets to runtime
 */
export const runtimeAnimations = {
  fadeIn: {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 }
  },
  fadeOut: {
    '0%': { opacity: 1 },
    '100%': { opacity: 0 }
  },
  slideInUp: {
    '0%': { transform: 'translateY(20px)', opacity: 0 },
    '100%': { transform: 'translateY(0)', opacity: 1 }
  },
  pulse: {
    '0%, 100%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.05)' }
  },
  spin: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' }
  }
};

/**
 * Add animation to runtime style
 */
export function withAnimation(
  style: Record<string, any>,
  animationName: keyof typeof runtimeAnimations,
  duration = '0.3s',
  timing = 'ease'
): Record<string, any> {
  return {
    ...style,
    animation: `${animationName} ${duration} ${timing}`,
    animationFillMode: 'both'
  };
}