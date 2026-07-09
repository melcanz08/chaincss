// src/runtime/injector.ts

/**
 * ChainCSS Runtime Injector
 * 
 * Injects styles into the DOM at runtime. Uses the unified style-compiler
 * for CSS generation instead of duplicating the logic.
 * 
 * Deduplication: identical style content is only injected once.
 * Multiple components sharing the same styles share a single <style> entry.
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
// Content Hash (simple djb2 — fast, deterministic)
// ============================================================================

function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// StyleInjector
// ============================================================================

class StyleInjector {
  private styleElement: HTMLStyleElement | null = null;
  private injectedIds = new Set<string>();
  private contentHashes = new Set<string>();       // NEW: deduplicate by CSS content
  private moduleMap = new Map<string, Set<string>>();
  private ruleTracker = new Map<string, number[]>();
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
    // Lazy initialization: DOM element created on first use, not on import.
    // This prevents "document is not defined" in SSR and avoids relying
    // on import side-effects for critical DOM nodes.
  }

  /**
   * Lazy-safe element accessor. Creates the style element on first call.
   * Safe for SSR (no document access until browser runtime).
   */
  private ensureElement(): HTMLStyleElement {
    if (this.styleElement) return this.styleElement;

    if (typeof document === 'undefined') {
      throw new Error('[ChainCSS] Cannot access DOM in this environment');
    }

    const existing = document.getElementById('chaincss-runtime') as HTMLStyleElement;
    if (existing) {
      this.styleElement = existing;
    } else {
      const el = document.createElement('style');
      el.id = 'chaincss-runtime';
      el.setAttribute('data-chaincss', 'runtime');
      document.head.appendChild(el);
      this.styleElement = el;
    }
    return this.styleElement || (typeof document !== 'undefined' ? document.getElementById('chaincss-runtime') as HTMLStyleElement : null);
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
   * Uses CSSStyleSheet.insertRule for O(1) injection — no textContent reparse.
   * Deduplicates by CSS content hash.
   */

  injectMultiple(
    styles: Record<string, StyleObject>,
    moduleId?: string
  ): Record<string, string> {
    const result: Record<string, string> = {};
    const sheet = this.ensureElement().sheet;
    if (!sheet) return result;
    const indices: number[] = [];
    const moduleClasses = new Set<string>();

    for (const [name, style] of Object.entries(styles)) {
      const className = name;
      result[name] = className;

      if (this.injectedIds.has(className)) {
        moduleClasses.add(className);
        continue;
      }

      const resolved = this.resolveStyleTokens(style);
      const css = compileToCSS(resolved, {
        scopeSelector: `.${className}`,
        minify: true,
      });

      if (!css) continue;

      // Deduplicate by CSS content hash
      const contentHash = hashString(css);
      if (this.contentHashes.has(contentHash)) {
        this.injectedIds.add(className);
        moduleClasses.add(className);
        if (this.debugMode) {
          console.log(`[ChainCSS] Deduplicated: ${className} (hash: ${contentHash})`);
        }
        continue;
      }

      try {
        // Native CSSOM insertion — no textContent reparse
        // Split compound rules (e.g., .btn { ... } .btn:hover { ... })
        const rules = css.split(/\}(?=\s*\.|@)/);
        for (const rule of rules) {
          const trimmed = rule.trim();
          if (!trimmed) continue;
          const fullRule = trimmed.endsWith('}') ? trimmed : trimmed + '}';
          const index = sheet.insertRule(fullRule, sheet.cssRules.length);
          indices.push(index);
        }

        this.injectedIds.add(className);
        this.contentHashes.add(contentHash);

        if (this.debugMode) {
          console.log(`[ChainCSS] Inserted: ${className} (${indices.length} rules, hash: ${contentHash})`);
        }
      } catch (e) {
        // Fallback: if insertRule fails (malformed CSS), use textContent
        if (this.debugMode) {
          console.error(`[ChainCSS] insertRule failed for ${className}, falling back to textContent`, e);
        }
        this.ensureElement().textContent += css + '\n';
        this.injectedIds.add(className);
        this.contentHashes.add(contentHash);
      }

      moduleClasses.add(className);
    }

    if (moduleId && indices.length > 0) {
      this.ruleTracker.set(moduleId, indices);
    }
    if (moduleId && moduleClasses.size > 0) {
      this.moduleMap.set(moduleId, moduleClasses);
    }

    return result;
  }

  /**
   * Inject a single class with CSS content.
   * Used by useChainStyles() for dynamic style injection.
   */
  inject(className: string, css: string, debug: boolean = false): void {
    const sheet = this.ensureElement().sheet;
    if (!sheet) return;

    const contentHash = hashString(css);
    if (this.contentHashes.has(contentHash)) {
      this.injectedIds.add(className);
      if (debug) console.log("[ChainCSS] Deduplicated: " + className);
      return;
    }

    try {
      const rules = css.split(/\}(?=\s*\.|@)/);
      for (const rule of rules) {
        const trimmed = rule.trim();
        if (!trimmed) continue;
        const fullRule = trimmed.endsWith("}") ? trimmed : trimmed + "}";
        const s = this.ensureElement().sheet;
        if (s) s.insertRule(fullRule, s.cssRules.length);
      }
      this.injectedIds.add(className);
      this.contentHashes.add(contentHash);
      if (debug) console.log("[ChainCSS] Injected: " + className);
    } catch (e) {
      this.ensureElement().textContent += css + "\n";
      this.injectedIds.add(className);
      this.contentHashes.add(contentHash);
    }
  }

  /**
   * Remove a single injected class from the sheet.
   */
  remove(className: string): void {
    const sheet = this.ensureElement().sheet;
    if (!sheet) return;
    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
      const rule = sheet.cssRules[i] as CSSStyleRule;
      if (rule.selectorText?.includes(className)) {
        try { sheet.deleteRule(i); } catch {}
      }
    }
    this.injectedIds.delete(className);
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
    
    if (resolved._nestedRules) {
      resolved._nestedRules = resolved._nestedRules.map((rule: any) => ({
        ...rule,
        styles: this.resolveStyleTokens(rule.styles)
      }));
    }
    
    return resolved;
  }
  
  /**
   * Remove a module's injected styles.
   * Uses tracked rule indices for O(1) deletion — no sheet scan.
   */

  removeModule(moduleId: string): void {
    const sheet = this.ensureElement().sheet;
    if (!sheet) return;

    // Fast path: use tracked indices for O(1) deletion
    const indices = this.ruleTracker.get(moduleId);
    if (indices && indices.length > 0) {
      // Sort descending to avoid index shifting during deletion
      const sorted = [...indices].sort((a, b) => b - a);
      for (const index of sorted) {
        if (index < sheet.cssRules.length) {
          try {
            sheet.deleteRule(index);
          } catch {
            // Rule already removed or index shifted — ignore
          }
        }
      }
      this.ruleTracker.delete(moduleId);

      // Update injectedIds by matching classes from moduleMap
      const classes = this.moduleMap.get(moduleId);
      if (classes) {
        for (const cls of classes) {
          this.injectedIds.delete(cls);
        }
        this.moduleMap.delete(moduleId);
      }

      if (this.debugMode) {
        console.log(`[ChainCSS] Removed ${sorted.length} rules for ${moduleId}`);
      }
      return;
    }

    // Slow fallback: scan sheet for class names (for modules without tracked indices)
    const classes = this.moduleMap.get(moduleId);
    if (!classes) return;

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
      console.log(`[ChainCSS] Removed ${removed} rules for ${moduleId} (slow path)`);
    }
  }
  
  removeAll(): void {
    if (this.styleElement) {
      this.ensureElement().textContent = '';
      this.injectedIds.clear();
      this.contentHashes.clear();
      this.moduleMap.clear();
      this.ruleTracker.clear();
    }
  }

  
  getStyleElement(): HTMLStyleElement | null {
    return this.styleElement || (typeof document !== 'undefined' ? document.getElementById('chaincss-runtime') as HTMLStyleElement : null);
  }
  
  getStats(): { injectedStyles: number; modules: number; deduplicatedHashes: number } {
    return {
      injectedStyles: this.injectedIds.size,
      modules: this.moduleMap.size,
      deduplicatedHashes: this.contentHashes.size,
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

export function setManifest(manifest: Record<string, any>): void {
  if (manifest.atomicMap) {
    (styleInjector as any)._manifest = manifest;
  }
}

export { compileToCSS } from '../core/style-compiler.js';