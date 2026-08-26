// src/frameworks/core/injector.ts

/**
 * ChainCSS Runtime Injector
 *
 * Injects styles into the DOM at runtime. Uses the unified style-compiler
 * for CSS generation instead of duplicating the logic.
 *
 * Deduplication: identical style content is only injected once.
 * Multiple components sharing the same styles share a single <style> entry.
 */

import { compileToCSSBrowser as compileToCSS } from "@core/usecases/browser-safe-compiler.js";
import type { StyleObject } from "@shared/types/index.js";

const TOKEN_KEY = "__CHAINCSS_TOKENS__";

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
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// no regex, handles "}", '}', /* } */, url()
// ============================================================================

export function splitCSSRules(css: string): string[] {
  const rules: string[] = [];
  let start = 0,
    depth = 0;
  let inSingle = false,
    inDouble = false,
    inComment = false;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i],
      next = css[i + 1];
    if (inComment) {
      if (ch === "*" && next === "/") {
        inComment = false;
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      inComment = true;
      i++;
      continue;
    }
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (inSingle || inDouble) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        rules.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }
  return rules.filter(Boolean);
}

// ============================================================================
// StyleInjector
// ============================================================================

class StyleInjector {
  private styleElement: HTMLStyleElement | null = null;
  private injectedIds = new Set<string>();
  private contentHashes = new Set<string>();
  private classToHash = new Map<string, string>(); // Maps class names back to their hashes for clean teardowns
  private moduleMap = new Map<string, Set<string>>();
  private debugMode = false;

  private get tokenStore(): TokenStore {
    if (typeof window === "undefined") return {};
    if (!(window as any)[TOKEN_KEY]) {
      Object.defineProperty(window, TOKEN_KEY, {
        value: {},
        writable: true,
        enumerable: false,
        configurable: true,
      });
    }
    return (window as any)[TOKEN_KEY];
  }

  constructor() {
    // Lazy initialization: DOM element created on first use, not on import.
    // This prevents "document is not defined" in SSR environments.
  }

  /**
   * Lazy-safe element accessor. Creates the style element on first call.
   * Safe for SSR (no document access until browser runtime).
   */
  private ensureElement(): HTMLStyleElement {
    if (this.styleElement) return this.styleElement;

    if (typeof document === "undefined") {
      throw new Error("[ChainCSS] Cannot access DOM in this environment");
    }

    const existing = document.getElementById(
      "chaincss-runtime",
    ) as HTMLStyleElement;
    if (existing) {
      this.styleElement = existing;
    } else {
      const el = document.createElement("style");
      el.id = "chaincss-runtime";
      el.setAttribute("data-chaincss", "runtime");
      document.head.appendChild(el);
      this.styleElement = el;
    }
    return this.styleElement;
  }

  enableDebug(enable: boolean = true): void {
    this.debugMode = enable;
  }

  setTokens(tokens: TokenStore): void {
    Object.assign(this.tokenStore, tokens);
    if (this.debugMode) {
      console.log("[ChainCSS] Tokens set:", Object.keys(tokens));
    }
  }

  getToken(path: string): any {
    const parts = path.split(".");
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
    if (typeof value !== "string") return value;
    if (value.startsWith("$")) {
      const resolved = this.getToken(value.slice(1));
      return resolved !== undefined ? resolved : value;
    }
    // Fixes Issue 1: Rigid path structure matching segment by segment via word/dash characters
    return value.replace(
      /\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g,
      (_, path) => {
        const resolved = this.getToken(path);
        return resolved !== undefined ? String(resolved) : _;
      },
    );
  }

  /**
   * Inject multiple named styles into the DOM.
   * Uses CSSStyleSheet.insertRule for O(1) injection — no textContent reparse.
   * Deduplicates by CSS content hash.
   */
  injectMultiple(
    styles: Record<string, StyleObject>,
    moduleId?: string,
  ): Record<string, string> {
    if (typeof document === "undefined") return {};
    const result: Record<string, string> = {};
    const sheet = this.ensureElement().sheet;
    if (!sheet) return result;
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

      const contentHash = hashString(css);
      if (this.contentHashes.has(contentHash)) {
        this.injectedIds.add(className);
        this.classToHash.set(className, contentHash);
        moduleClasses.add(className);
        if (this.debugMode) {
          console.log(
            `[ChainCSS] Deduplicated: ${className} (hash: ${contentHash})`,
          );
        }
        continue;
      }

      try {
        const rules = splitCSSRules(css);
        let insertedCount = 0;
        for (const rule of rules) {
          const trimmed = rule.trim();
          if (!trimmed) continue;
          const fullRule = trimmed.endsWith("}") ? trimmed : trimmed + "}";
          sheet.insertRule(fullRule, sheet.cssRules.length);
          insertedCount++;
        }

        this.injectedIds.add(className);
        this.contentHashes.add(contentHash);
        this.classToHash.set(className, contentHash);

        if (this.debugMode) {
          console.log(
            `[ChainCSS] Inserted: ${className} (${insertedCount} rules, hash: ${contentHash})`,
          );
        }
      } catch (e) {
        if (this.debugMode) {
          console.error(
            `[ChainCSS] insertRule failed for ${className}, falling back to textContent`,
            e,
          );
        }
        this.ensureElement().textContent += css + "\n";
        this.injectedIds.add(className);
        this.contentHashes.add(contentHash);
        this.classToHash.set(className, contentHash);
      }

      moduleClasses.add(className);
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
    if (typeof document === "undefined") return;
    const sheet = this.ensureElement().sheet;
    if (!sheet) return;

    const contentHash = hashString(css);
    if (this.contentHashes.has(contentHash)) {
      this.injectedIds.add(className);
      this.classToHash.set(className, contentHash);
      if (debug) console.log("[ChainCSS] Deduplicated: " + className);
      return;
    }

    try {
      const rules = splitCSSRules(css);
      for (const rule of rules) {
        const trimmed = rule.trim();
        if (!trimmed) continue;
        const fullRule = trimmed.endsWith("}") ? trimmed : trimmed + "}";
        const s = this.ensureElement().sheet;
        if (s) s.insertRule(fullRule, s.cssRules.length);
      }
      this.injectedIds.add(className);
      this.contentHashes.add(contentHash);
      this.classToHash.set(className, contentHash);
      if (debug) console.log("[ChainCSS] Injected: " + className);
    } catch (e) {
      this.ensureElement().textContent += css + "\n";
      this.injectedIds.add(className);
      this.contentHashes.add(contentHash);
      this.classToHash.set(className, contentHash);
    }
  }

  /**
   * Remove a single injected class from the sheet. Clears associated cache tokens.
   */
  remove(className: string): void {
    const sheet = this.ensureElement().sheet;
    if (!sheet) return;

    // Fixes Issue 2: Compile the selector match expression once, not per rule iteration
    const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ruleMatcher = new RegExp("\\." + escapedClass + "(\\s|:|$|,)");

    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
      const rule = sheet.cssRules[i] as CSSStyleRule;
      if (rule.selectorText && ruleMatcher.test(rule.selectorText)) {
        try {
          sheet.deleteRule(i);
        } catch {}
      }
    }

    const associatedHash = this.classToHash.get(className);
    if (associatedHash) {
      this.contentHashes.delete(associatedHash);
      this.classToHash.delete(className);
    }
    this.injectedIds.delete(className);
  }

  private resolveStyleTokens(style: StyleObject): StyleObject {
    const resolved = { ...style } as Record<string, any>;

    for (const key of Object.keys(resolved)) {
      const value = resolved[key];
      if (typeof value === "string") {
        resolved[key] = this.resolveTokens(value);
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        !key.startsWith("_") &&
        !key.startsWith("&")
      ) {
        resolved[key] = this.resolveStyleTokens(value);
      }
    }

    if (resolved._nestedRules && Array.isArray(resolved._nestedRules)) {
      resolved._nestedRules = resolved._nestedRules.map((rule: any) => ({
        ...rule,
        styles: this.resolveStyleTokens(rule.styles),
      }));
    }

    return resolved as StyleObject;
  }

  /**
   * Remove a module's injected styles safely via specific target selector matching.
   * Completely immune to absolute index displacements caused by multi-module actions.
   */
  removeModule(moduleId: string): void {
    const sheet = this.ensureElement().sheet;
    if (!sheet) return;

    const classes = this.moduleMap.get(moduleId);
    if (!classes) return;

    let removed = 0;
    // Walk backward to guarantee index modifications do not affect outstanding rules
    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
      const rule = sheet.cssRules[i] as CSSStyleRule;
      if (rule.selectorText) {
        const match = rule.selectorText.match(/\.([a-zA-Z0-9_-]+)/);
        if (match && classes.has(match[1])) {
          try {
            sheet.deleteRule(i);
            removed++;
          } catch (e) {
            if (this.debugMode) console.error(e);
          }
        }
      }
    }

    // Flush cache entries for this module
    for (const cls of classes) {
      const associatedHash = this.classToHash.get(cls);
      if (associatedHash) {
        this.contentHashes.delete(associatedHash);
        this.classToHash.delete(cls);
      }
      this.injectedIds.delete(cls);
    }

    this.moduleMap.delete(moduleId);

    if (this.debugMode) {
      console.log(
        `[ChainCSS] Safely unmounted ${removed} rules for ${moduleId}`,
      );
    }
  }

  removeAll(): void {
    if (this.styleElement) {
      this.ensureElement().textContent = "";
      this.injectedIds.clear();
      this.contentHashes.clear();
      this.classToHash.clear();
      this.moduleMap.clear();
    }
  }

  getStyleElement(): HTMLStyleElement | null {
    return (
      this.styleElement ||
      (typeof document !== "undefined"
        ? (document.getElementById("chaincss-runtime") as HTMLStyleElement)
        : null)
    );
  }

  getStats(): {
    injectedStyles: number;
    modules: number;
    deduplicatedHashes: number;
  } {
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

export const setTokens = (tokens: TokenStore) =>
  styleInjector.setTokens(tokens);
export const compileRuntime = (
  styles: Record<string, StyleObject>,
  moduleId?: string,
) => styleInjector.injectMultiple(styles, moduleId);
export const removeRuntimeModule = (moduleId: string) =>
  styleInjector.removeModule(moduleId);
export const clearRuntimeStyles = () => styleInjector.removeAll();
export const enableRuntimeDebug = (enabled: boolean) =>
  styleInjector.enableDebug(enabled);

export function runRuntime(...styleObjects: StyleObject[]): string {
  const css = styleObjects
    .map((s) => compileToCSS(s))
    .filter(Boolean)
    .join("\n");

  if (css) {
    styleInjector.inject("runtime-" + hashString(css), css);
  }

  return css;
}

export function setManifest(manifest: Record<string, any>): void {
  if (manifest.atomicMap) {
    (styleInjector as any)._manifest = manifest;
  }
}
