// ============================================================================
// FILE: src/compiler/tokens/token-resolver.ts
// ============================================================================

/**
 * Token Resolver — Resolves design token references in style values.
 *
 * Supports formats:
 *   $colors.primary         → direct token reference
 *   token('colors.primary') → function-style
 *   $primary 1px solid $border → inline references within strings
 */

import { createLogger } from "@shared/logger/index.js";
import { tokens as globalTokens } from "./tokens.js";
import type { DesignTokens } from "./tokens.js";

const logger = createLogger(false, "token-resolver");

const MAX_RECURSION_DEPTH = 10;

export interface TokenResolverOptions {
  useTokens?: boolean;
  useCSSVariables?: boolean;
  prefix?: string;
}

// Regex for function-style: token('path') or $token('path')
const FUNCTION_TOKEN_REGEX =
  /^(?:token|\$token)\s*\(\s*['"]([^'"]+)['"]\s*\)$/;

// Regex for inline tokens: $colors.primary (must start with letter or underscore)
const INLINE_TOKEN_REGEX =
  /\$([a-zA-Z_][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9_-]+)*)/g;

// Regex for extractTokenPaths matching function calls
const EXTRACT_FUNCTION_REGEX =
  /(?:token|\$token)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Unwraps W3C DTCG / Style Dictionary token objects ({ $value: ... } or { value: ... })
 */
function unwrapTokenValue(val: any): any {
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    if ("$value" in val) return val.$value;
    if ("value" in val) return val.value;
  }
  return val;
}

/**
 * Safely traverses context or calls .get() to locate a token path value.
 */
function resolveTokenPath(
  path: string,
  tokenContext?: DesignTokens | null,
): any {
  const cleanPath = path.startsWith("$") ? path.slice(1) : path;

  // 1. Check explicit tokenContext instance (.get() interface)
  if (tokenContext && typeof tokenContext.get === "function") {
    const resolved = tokenContext.get(cleanPath);
    if (resolved !== undefined && resolved !== null) {
      return unwrapTokenValue(resolved);
    }
  }

  // 2. Check plain object structure
  if (tokenContext && typeof tokenContext === "object") {
    const parts = cleanPath.split(".");
    let cur: any = tokenContext;
    for (const p of parts) {
      if (cur === null || cur === undefined) break;
      cur = cur[p];
    }
    if (cur !== undefined && cur !== null) {
      return unwrapTokenValue(cur);
    }
  }

  // 3. Fallback to globalTokens singleton
  if (globalTokens && typeof globalTokens.get === "function") {
    const resolved = globalTokens.get(cleanPath);
    if (resolved !== undefined && resolved !== null) {
      return unwrapTokenValue(resolved);
    }
  }

  return undefined;
}

// ============================================================================
// Resolution Functions
// ============================================================================

export function resolveToken(
  value: any,
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null,
  useCSSVariables: boolean = false,
  depth: number = 0,
): any {
  if (!useTokens || value === null || value === undefined) return value;

  // Handle Array values recursively
  if (Array.isArray(value)) {
    return value.map((v) =>
      resolveToken(v, useTokens, tokenContext, useCSSVariables, depth),
    );
  }

  if (typeof value !== "string") return value;

  // Guard against infinite recursive token loops
  if (depth > MAX_RECURSION_DEPTH) {
    console.warn(
      `[ChainCSS] Exceeded max token recursion depth for value: "${value}"`,
    );
    return value;
  }

  // Handle function-style: token('colors.primary') or $token('colors.primary')
  const functionMatch = value.match(FUNCTION_TOKEN_REGEX);
  if (functionMatch) {
    const tokenPath = functionMatch[1];
    if (useCSSVariables) {
      return `var(--theme-${tokenPath.replace(/\./g, "-")})`;
    }
    const resolved = resolveTokenPath(tokenPath, tokenContext);
    if (resolved !== undefined) {
      return typeof resolved === "string" && hasTokenReferences(resolved)
        ? resolveToken(resolved, useTokens, tokenContext, useCSSVariables, depth + 1)
        : resolved;
    }
    return value;
  }

  // Handle inline token references within strings ($colors.primary)
  if (value.includes("$")) {
    return value.replace(INLINE_TOKEN_REGEX, (match: string, path: string) => {
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

        const stringified = String(resolved);
        return hasTokenReferences(stringified)
          ? resolveToken(stringified, useTokens, tokenContext, useCSSVariables, depth + 1)
          : stringified;
      }

      if (
        typeof process !== "undefined" &&
        process.env?.NODE_ENV !== "production"
      ) {
        console.warn(`[ChainCSS] Token not found: ${path}`);
      }

      return match;
    });
  }

  return value;
}

// ============================================================================
// Batch & Utility Functions
// ============================================================================

export function resolveTokens(
  obj: Record<string, any>,
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null,
  useCSSVariables: boolean = false,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      result[key] = value.map((v) =>
        typeof v === "object" && v !== null
          ? resolveTokens(v, useTokens, tokenContext, useCSSVariables)
          : resolveToken(v, useTokens, tokenContext, useCSSVariables),
      );
    } else if (value && typeof value === "object") {
      result[key] = resolveTokens(value, useTokens, tokenContext, useCSSVariables);
    } else {
      result[key] = resolveToken(value, useTokens, tokenContext, useCSSVariables);
    }
  }

  return result;
}

export function hasTokenReferences(value: any): boolean {
  if (typeof value !== "string") return false;
  return (
    (value.includes("$") && INLINE_TOKEN_REGEX.test(value)) ||
    EXTRACT_FUNCTION_REGEX.test(value)
  );
}

export function extractTokenPaths(value: string): string[] {
  if (typeof value !== "string") return [];

  const paths: string[] = [];
  let match: RegExpExecArray | null;

  const dollarRegex = new RegExp(INLINE_TOKEN_REGEX.source, "g");
  while ((match = dollarRegex.exec(value)) !== null) {
    paths.push(match[1]);
  }

  const funcRegex = new RegExp(EXTRACT_FUNCTION_REGEX.source, "g");
  while ((match = funcRegex.exec(value)) !== null) {
    paths.push(match[1]);
  }

  return [...new Set(paths)];
}

export function createTokenResolver(
  tokenContext?: DesignTokens | null,
  options: TokenResolverOptions = {},
): (value: any) => any {
  const context = tokenContext || globalTokens;
  const { useTokens = true, useCSSVariables = false } = options;

  return (value: any) => resolveToken(value, useTokens, context, useCSSVariables);
}

export function resolveBatch(
  values: string[],
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null,
  useCSSVariables: boolean = false,
): string[] {
  return values.map((v) => resolveToken(v, useTokens, tokenContext, useCSSVariables));
}

// ============================================================================
// TokenResolver Class (Cached, per-file, theme-aware mapping)
// ============================================================================

export class TokenResolver {
  private cache: Map<string, any> = new Map();
  private context: any;
  private warningCache: Set<string> = new Set();
  private useCSSVariables: boolean;

  constructor(context?: any, options: TokenResolverOptions = {}) {
    const rawContext = context || globalTokens;
    this.context = rawContext?.default || rawContext;
    this.useCSSVariables = options.useCSSVariables || false;
  }

  public getLiteralValue(
    path: string,
    themeContext?: string,
  ): string | undefined {
    if (!path) return undefined;

    const cleanPath = path.startsWith("$") ? path.slice(1) : path;

    // 1. Active theme path namespace (e.g. 'dark.colors.primary')
    if (themeContext) {
      const themedPath = `${themeContext}.${cleanPath}`;
      const themedValue = resolveTokenPath(themedPath, this.context);
      if (themedValue !== undefined && themedValue !== null) {
        return String(themedValue);
      }
    }

    // 2. Default standard token resolution fallback
    const defaultValue = resolveTokenPath(cleanPath, this.context);
    if (defaultValue !== undefined && defaultValue !== null) {
      return String(defaultValue);
    }

    // 3. Emit deduplicated warning
    this.emitWarning(cleanPath);
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
    const cacheKey = `${this.useCSSVariables ? "var:" : "val:"}${value}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const resolved = resolveToken(value, true, this.context, this.useCSSVariables);
    this.cache.set(cacheKey, resolved);
    return resolved;
  }

  resolveObject(obj: Record<string, any>): Record<string, any> {
    return resolveTokens(obj, true, this.context, this.useCSSVariables);
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
// Deprecated Legacy Context
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