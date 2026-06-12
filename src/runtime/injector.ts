// src/runtime/injector.ts

/**
 * ChainCSS Runtime Injector
 * 
 * Injects styles into the DOM at runtime. Uses the unified style-compiler
 * for CSS generation instead of duplicating the logic.
 */

import { compileToCSS, type CompileOptions } from '../core/style-compiler.js';
import type { StyleObject } from '../core/style-collector.js';
import { partitionStyles } from '../core/value-classifier.js';

const TOKEN_KEY = '__CHAINCSS_TOKENS__';

// ============================================================================
// Types
// ============================================================================

export interface TokenStore {
  colors?: Record<string, string>;
  spacing?: Record<string, string>;
  typography?: Record<string, any>;
  [key: string]: any;
}

// ============================================================================
// StyleInjector
// ============================================================================

class StyleInjector {
  private styleElement: HTMLStyleElement | null = null;
  private injectedIds = new Set<string>();
  private moduleMap = new Map<string, Set<string>>();
  private debugMode = false;
  
  private get tokenStore(): TokenStore {
    if (typeof window === 'undefined') return {};
    if (!(window as any)[TOKEN_KEY]) {
      Object.defineProperty(window, TOKEN_KEY, {
        value: {},
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
    return (window as any)[TOKEN_KEY];
  }
  
  constructor() {
    if (typeof document !== 'undefined') {
      const existing = document.getElementById('chaincss-runtime');
      if (existing) {
        this.styleElement = existing as HTMLStyleElement;
      } else {
        const el = document.createElement('style');
        el.id = 'chaincss-runtime';
        el.setAttribute('data-chaincss', 'runtime');
        document.head.appendChild(el);
        this.styleElement = el;
      }
    }
  }
  
  enableDebug(enable: boolean = true): void {
    this.debugMode = enable;
  }
  
  setTokens(tokens: TokenStore): void {
    Object.assign(this.tokenStore, tokens);
    if (this.debugMode) {
      console.log('[ChainCSS] Tokens set:', Object.keys(tokens));
    }
  }
  
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
  
  resolveTokens(value: any): any {
    if (typeof value !== 'string') return value;
    if (value.startsWith('$')) {
      const resolved = this.getToken(value.slice(1));
      return resolved !== undefined ? resolved : value;
    }
    return value.replace(/\$([a-zA-Z0-9.-]+)/g, (_, path) => {
      const resolved = this.getToken(path);
      return resolved !== undefined ? String(resolved) : _;
    });
  }
  
  /**
   * Inject multiple named styles into the DOM.
   * Uses the unified compileToCSS for generation.
   */
  injectMultiple(
    styles: Record<string, StyleObject>,
    moduleId?: string
  ): Record<string, string> {
    const result: Record<string, string> = {};
    let newCSS = '';
    const moduleClasses = new Set<string>();
    
    for (const [name, style] of Object.entries(styles)) {
      const className = name;
      result[name] = className;
      
      if (!this.injectedIds.has(className)) {
        // Resolve tokens in the style object
        const resolved = this.resolveStyleTokens(style);
        
        // Generate CSS using the unified compiler
        const css = compileToCSS(resolved, {
          scopeSelector: `.${className}`,
          minify: false
        });
        
        if (css) {
          newCSS += css + '\n';
          this.injectedIds.add(className);
        }
      }
      
      moduleClasses.add(className);
    }
    
    if (moduleId && moduleClasses.size > 0) {
      this.moduleMap.set(moduleId, moduleClasses);
    }
    
    if (newCSS && this.styleElement) {
      this.styleElement.textContent += newCSS;
      if (this.debugMode) {
        console.log(`[ChainCSS] Injected ${newCSS.length} bytes (${moduleId || 'anonymous'})`);
      }
    }
    
    return result;
  }
  
  private resolveStyleTokens(style: StyleObject): StyleObject {
    const resolved: StyleObject = { ...style };
    
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveTokens(value);
      } else if (typeof value === 'object' && value !== null && !key.startsWith('_')) {
        resolved[key] = this.resolveStyleTokens(value);
      }
    }
    
    // Also resolve tokens in nested rules and at-rules
    if (resolved._nestedRules) {
      resolved._nestedRules = resolved._nestedRules.map((rule: any) => ({
        ...rule,
        styles: this.resolveStyleTokens(rule.styles)
      }));
    }
    
    return resolved;
  }
  
  removeModule(moduleId: string): void {
    const classes = this.moduleMap.get(moduleId);
    if (!classes || !this.styleElement?.sheet) return;
    
    const sheet = this.styleElement.sheet;
    let removed = 0;
    
    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
      const rule = sheet.cssRules[i] as CSSStyleRule;
      if (rule.selectorText) {
        const match = rule.selectorText.match(/\.([a-zA-Z0-9_-]+)/);
        if (match && classes.has(match[1])) {
          sheet.deleteRule(i);
          this.injectedIds.delete(match[1]);
          removed++;
        }
      }
    }
    
    this.moduleMap.delete(moduleId);
    
    if (this.debugMode) {
      console.log(`[ChainCSS] Removed ${removed} rules for ${moduleId}`);
    }
  }
  
  removeAll(): void {
    if (this.styleElement) {
      this.styleElement.textContent = '';
      this.injectedIds.clear();
      this.moduleMap.clear();
    }
  }
  
  getStyleElement(): HTMLStyleElement | null {
    return this.styleElement;
  }
  
  getStats(): { injectedStyles: number; modules: number } {
    return {
      injectedStyles: this.injectedIds.size,
      modules: this.moduleMap.size
    };
  }
}

// ============================================================================
// Singleton & Public API
// ============================================================================

export const styleInjector = new StyleInjector();

export const setTokens = (tokens: TokenStore) => styleInjector.setTokens(tokens);
export const compileRuntime = (styles: Record<string, StyleObject>, moduleId?: string) =>
  styleInjector.injectMultiple(styles, moduleId);
export const removeRuntimeModule = (moduleId: string) => styleInjector.removeModule(moduleId);
export const clearRuntimeStyles = () => styleInjector.removeAll();
export const enableRuntimeDebug = (enabled: boolean) => styleInjector.enableDebug(enabled);

/**
 * Legacy support — compile style objects to CSS string and inject.
 */
export function runRuntime(...styleObjects: StyleObject[]): string {
  const css = styleObjects
    .map(s => compileToCSS(s))
    .filter(Boolean)
    .join('\n');
  
  if (css) {
    (styleInjector as any).styleElement.textContent += css;
  }
  
  return css;
}

// Re-export for convenience

/** Accept manifest from build pipeline for atomic class lookup */
export function setManifest(manifest: Record<string, any>): void {
  if (manifest.atomicMap) {
    (styleInjector as any)._manifest = manifest;
  }
}
export { compileToCSS } from '../core/style-compiler.js';