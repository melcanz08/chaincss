// src/runtime/injector.ts (fixed version)

import { shorthandMap, macros } from '../compiler/shorthands.js';
import { processStyleObject } from '../core/common-utils.js';

const TOKEN_V2_KEY = '__CHAINCSS_V2_TOKENS__';

// Runtime-specific style def — selectors optional
export interface RuntimeStyleDefinition {
  selectors?: string[];
  hover?: Record<string, string | number>;
  [key: string]: any;
}

export interface TokenStore {
  colors?: Record<string, string>;
  spacing?: Record<string, string>;
  typography?: Record<string, any>;
  [key: string]: any;
}

class StyleInjector {
  private styleElement: HTMLStyleElement | null = null;
  private injectedHashes = new Set<string>();
  private moduleMap = new Map<string, Set<string>>();
  private debugMode = false;
  
  private get tokenStore(): TokenStore {
    // Handle non-browser environments (SSR)
    if (typeof window === 'undefined') {
      return (this as any)._internalFallbackStore || {};
    }

    // Defensive initialization
    if (!(window as any)[TOKEN_V2_KEY]) {
      Object.defineProperty(window, TOKEN_V2_KEY, {
        value: {},
        writable: true,
        enumerable: false,
        configurable: true
      });
    }

    return (window as any)[TOKEN_V2_KEY];
  }

  constructor() {
    if (typeof document !== 'undefined') {
      const existing = document.getElementById('chaincss-runtime-styles');
      if (existing) {
        this.styleElement = existing as HTMLStyleElement;
      } else {
        const style = document.createElement('style');
        style.id = 'chaincss-runtime-styles';
        style.setAttribute('data-chaincss', 'runtime');
        document.head.appendChild(style);
        this.styleElement = style;
      }
    }
  }

  /**
   * Enable debug logging
   */
  enableDebug(enable: boolean = true): void {
    this.debugMode = enable;
  }

  /**
   * Set global tokens (e.g., brand colors, spacing scales)
   */
  setTokens(tokens: TokenStore): void {
    if (this.debugMode) {
      console.log('[ChainCSS] Tokens set:', Object.keys(tokens));
    }
    Object.assign(this.tokenStore, tokens);
  }

  /**
   * Get a token value by path
   */
  getToken(path: string): any {
    const parts = path.split('.');
    let current: any = this.tokenStore;
    for (const part of parts) {
      if (current && current[part] !== undefined) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Resolves $variables within a string using the tokenStore
   */
  resolveToken(value: any): any {
    if (typeof value !== 'string') return value;

    // Exact match: "$colors.primary"
    if (value.startsWith('$')) {
      const tokenValue = this.getToken(value.slice(1));
      return tokenValue !== undefined ? tokenValue : value;
    }

    // Partial match: "1px solid $colors.primary"
    return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match, path) => {
      const tokenValue = this.getToken(path);
      return tokenValue !== undefined ? String(tokenValue) : match;
    });
  }

  private generateCSS(style: RuntimeStyleDefinition, className: string): string {
    let css = '';
    const selector = `.${className}`;

    // Process style object (handles shorthands and tokens)
    const mainBody = processStyleObject(style, this.tokenStore, { useTokens: true, debug: false });
    if (mainBody && Object.keys(mainBody).length > 0) {
      let rules = '';
      for (const [prop, val] of Object.entries(mainBody)) {
        rules += `  ${prop}: ${val};\n`;
      }
      css += `${selector} {\n${rules}}\n`;
    }

    // Handle Hover
    if (style.hover) {
      const hoverBody = processStyleObject(style.hover, this.tokenStore, { useTokens: true, debug: false });
      if (hoverBody && Object.keys(hoverBody).length > 0) {
        let rules = '';
        for (const [prop, val] of Object.entries(hoverBody)) {
          rules += `  ${prop}: ${val};\n`;
        }
        css += `${selector}:hover {\n${rules}}\n`;
      }
    }

    return css;
  }

  injectMultiple(styles: Record<string, RuntimeStyleDefinition>, moduleId?: string): Record<string, string> {
    const result: Record<string, string> = {};
    let newCSS = '';
    const moduleClasses = new Set<string>();

    for (const [name, style] of Object.entries(styles)) {
      const className = name;
      result[name] = className;

      if (!this.injectedHashes.has(className)) {
        const generatedCSS = this.generateCSS(style, className);
        if (generatedCSS) {
          newCSS += generatedCSS;
          this.injectedHashes.add(className);
        }
      }
      moduleClasses.add(className);
    }

    if (moduleId && moduleClasses.size > 0) {
      this.moduleMap.set(moduleId, moduleClasses);
    }
    
    if (newCSS) {
      this.writeToDOM(newCSS);
      if (this.debugMode) {
        console.log(`[ChainCSS] Injected ${newCSS.length} bytes of CSS (${moduleId || 'anonymous'})`);
      }
    }
    
    return result;
  }

  writeToDOM(css: string): void {
    if (css && this.styleElement) {
      this.styleElement.textContent += css;
    }
  }

  removeModule(moduleId: string): void {
    const classes = this.moduleMap.get(moduleId);
    if (!classes || !this.styleElement?.sheet) return;

    const sheet = this.styleElement.sheet;
    let removedCount = 0;
    
    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
      const rule = sheet.cssRules[i] as CSSStyleRule;
      if (rule.selectorText) {
        const match = rule.selectorText.match(/\.([a-zA-Z0-9_-]+)/);
        if (match && classes.has(match[1])) {
          sheet.deleteRule(i);
          this.injectedHashes.delete(match[1]);
          removedCount++;
        }
      }
    }
    
    this.moduleMap.delete(moduleId);
    
    if (this.debugMode) {
      console.log(`[ChainCSS] Removed ${removedCount} rules for module ${moduleId}`);
    }
  }

  removeAll(): void {
    if (this.styleElement) {
      this.styleElement.textContent = '';
      this.injectedHashes.clear();
      this.moduleMap.clear();
      
      if (this.debugMode) {
        console.log('[ChainCSS] All runtime styles removed');
      }
    }
  }

  getStyleElement(): HTMLStyleElement | null {
    return this.styleElement;
  }
  
  getStats(): { injectedStyles: number; modules: number } {
    return {
      injectedStyles: this.injectedHashes.size,
      modules: this.moduleMap.size
    };
  }
}

// --- SINGLETON INSTANCE ---
export const styleInjector = new StyleInjector();

// --- PUBLIC API ---
export const setTokens = (t: TokenStore) => styleInjector.setTokens(t);
export const compileRuntime = (s: Record<string, RuntimeStyleDefinition>, moduleId?: string) =>
  styleInjector.injectMultiple(s, moduleId);
export const removeRuntimeModule = (moduleId: string) => styleInjector.removeModule(moduleId);
export const clearRuntimeStyles = () => styleInjector.removeAll();
export const enableRuntimeDebug = (enabled: boolean) => styleInjector.enableDebug(enabled);

export function runRuntime(...styles: RuntimeStyleDefinition[]): string {
  let css = '';
  for (const style of styles) {
    if (style.selectors && style.selectors.length > 0) {
      const combinedSelector = style.selectors.join(', ');
      
      // Use styleInjector directly instead of 'this'
      const mainBody = processStyleObject(style, styleInjector['tokenStore'], { useTokens: true, debug: false });
      
      if (mainBody && Object.keys(mainBody).length > 0) {
        let rules = '';
        for (const [prop, val] of Object.entries(mainBody)) {
          rules += `  ${prop}: ${val};\n`;
        }
        css += `${combinedSelector} {\n${rules}}\n`;
      }
      
      if (style.hover) {
        const hoverBody = processStyleObject(style.hover, styleInjector['tokenStore'], { useTokens: true, debug: false });
        if (hoverBody && Object.keys(hoverBody).length > 0) {
          let rules = '';
          for (const [prop, val] of Object.entries(hoverBody)) {
            rules += `  ${prop}: ${val};\n`;
          }
          css += `${combinedSelector}:hover {\n${rules}}\n`;
        }
      }
    }
  }
  styleInjector.writeToDOM(css);
  return css;
}