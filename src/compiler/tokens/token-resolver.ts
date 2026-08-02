// ============================================================================
// FILE: src/compiler/tokens/token-resolver.ts
// ============================================================================

/**
 * Token Resolver — Resolves design token references in style values.
 *
 * Supports formats:
 *   $colors.primary        → direct token reference
 *   token('colors.primary') → function-style
 *   $primary 1px solid $border → inline references within strings
 */

import { tokens as globalTokens } from "./tokens.js";
import type { DesignTokens } from "./tokens.js";
import { createLogger } from "@shared/logger/index.js";

const logger = createLogger(false, "token-resolver");

// ============================================================================
// Resolution (no global state)
// ============================================================================

export function resolveToken(
  value: any,
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null,
  useCSSVariables: boolean = false,
): any {
  if (!useTokens || typeof value !== "string") return value;

  // Handle function-style: token('colors.primary')
  const functionMatch = value.match(
    /^(?:token|\$token)\s*\(\s*['"]([^'"]+)['"]\s*\)$/,
  );
  if (functionMatch) {
    const tokenPath = functionMatch[1];
    const resolved = resolveTokenPath(tokenPath, tokenContext);
    if (useCSSVariables) {
      return `var(--theme-${tokenPath.replace(/\./g, "-")})`;
    }
    return resolved !== undefined ? resolved : value;
  }

  // Handle inline token references within strings
  if (value.includes("$")) {
    return value.replace(
      /\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g,
      (match: string, path: string) => {
        const resolved = resolveTokenPath(path, tokenContext);
        if (resolved !== undefined && resolved !== null) {
          if (typeof resolved === "object") {
            console.warn(
              `[ChainCSS] Token "${path}" resolved to an object, cannot inline into string: "${value}"`,
            );
            return match;
          }
          if (useCSSVariables) {
            return `var(--theme-${path.replace(/\./g, "-")})`;
          }
          return String(resolved);
        }
        if (
          typeof process !== "undefined" &&
          process.env?.NODE_ENV !== "production"
        ) {
          console.warn(`[ChainCSS] Token not found: ${path}`);
        }
        return match;
      },
    );
  }

  return value;
}

function resolveTokenPath(
  path: string,
  tokenContext?: DesignTokens | null,
): any {
  if (tokenContext && typeof tokenContext.get === "function") {
    const resolved = tokenContext.get(path);
    if (resolved !== undefined && resolved !== null) return resolved;
  }

  // Handle plain JavaScript objects if a raw object structure is passed down as context
  if (tokenContext && typeof tokenContext === "object") {
    const parts = path.split(".");
    let cur: any = tokenContext;
    for (const p of parts) {
      cur = cur?.[p];
    }
    if (cur !== undefined && cur !== null) {
      return typeof cur === "object" ? cur.$value || cur.value || cur : cur;
    }
  }

  if (globalTokens && typeof globalTokens.get === "function") {
    const resolved = globalTokens.get(path);
    if (resolved !== undefined && resolved !== null) return resolved;
  }

  return undefined;
}

// ============================================================================
// Batch & Utility Functions
// ============================================================================

export function resolveTokens(
  obj: Record<string, any>,
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null,
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = resolveTokens(value, useTokens, tokenContext);
    } else {
      result[key] = resolveToken(value, useTokens, tokenContext);
    }
  }
  return result;
}

export function hasTokenReferences(value: any): boolean {
  if (typeof value !== "string") return false;
  return value.includes("$") || /token\(['"][^'"]+['"]\)/.test(value);
}

export function extractTokenPaths(value: string): string[] {
  const paths: string[] = [];
  const dollarRegex = /\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g;
  let match;
  while ((match = dollarRegex.exec(value)) !== null) {
    paths.push(match[1]);
  }
  const functionRegex = /token\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = functionRegex.exec(value)) !== null) {
    paths.push(match[1]);
  }
  return [...new Set(paths)];
}

export function createTokenResolver(
  tokenContext?: DesignTokens | null,
): (value: any) => any {
  const context = tokenContext || globalTokens;
  return (value: any) => {
    if (typeof value === "string") return resolveToken(value, true, context);
    return value;
  };
}

export function resolveBatch(
  values: string[],
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null,
): string[] {
  return values.map((v) => resolveToken(v, useTokens, tokenContext));
}

// ============================================================================
// TokenResolver Class (Cached, per-file, theme-aware mapping)
// ============================================================================

export class TokenResolver {
  private cache: Map<string, any> = new Map();
  private context: any;
  private warningCache: Set<string> = new Set();

  constructor(context?: any) {
    // Gracefully unwrap default exports from modular runtime loaders
    const rawContext = context || globalTokens;
    this.context = rawContext?.default || rawContext;
  }

  /**
   * Safely traverses the token context using theme specificity fallbacks
   */
  public getLiteralValue(
    path: string,
    themeContext?: string,
  ): string | undefined {
    if (!path) return undefined;

    // 1. Prioritize active theme path namespace (e.g. 'dark.colors.primary')
    if (themeContext) {
      const themedPath = `${themeContext}.${path}`;
      const themedValue = resolveTokenPath(themedPath, this.context);
      if (themedValue !== undefined && themedValue !== null)
        return String(themedValue);
    }

    // 2. Default standard token resolution fallback
    const defaultValue = resolveTokenPath(path, this.context);
    if (defaultValue !== undefined && defaultValue !== null)
      return String(defaultValue);

    // 3. Emit a deduplicated compiler log warning instead of throwing an error
    this.emitWarning(path);
    return undefined;
  }

  private emitWarning(path: string): void {
    if (this.warningCache.has(path)) return;
    this.warningCache.add(path);

    if (logger && typeof logger.warn === "function") {
      logger.warn(
        `Token resolution failed for path: "${path}". Custom variable fallback applied.`,
      );
    } else {
      console.warn(
        `\x1b[33m[ChainCSS Warning]\x1b[0m Missing design token path: "${path}"`,
      );
    }
  }

  resolve(value: any): any {
    if (typeof value !== "string") return value;
    if (this.cache.has(value)) return this.cache.get(value);
    const resolved = resolveToken(value, true, this.context);
    this.cache.set(value, resolved);
    return resolved;
  }

  resolveObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        result[key] = this.resolveObject(val);
      } else {
        result[key] = this.resolve(val);
      }
    }
    return result;
  }

  clearCache(): void {
    this.cache.clear();
    this.warningCache.clear();
  }

  updateContext(context: any): void {
    const rawContext = context || globalTokens;
    this.context = rawContext?.default || rawContext;
    this.clearCache();
  }

  getStats(): { cacheSize: number } {
    return { cacheSize: this.cache.size };
  }
}

// ============================================================================
// Deprecated Context Variables
// ============================================================================

let _legacyContext: DesignTokens | null = null;
export function setTokenContext(context: DesignTokens | null): void {
  _legacyContext = context;
}
export function getTokenContext(): DesignTokens | null {
  return _legacyContext;
}
export function clearTokenContext(): void {
  _legacyContext = null;
}

export default {
  resolveToken,
  setTokenContext,
  getTokenContext,
  clearTokenContext,
  resolveTokens,
  hasTokenReferences,
  extractTokenPaths,
  createTokenResolver,
  resolveBatch,
  TokenResolver,
};
