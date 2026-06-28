// src/compiler/tokens/token-resolver.ts

/**
 * Token Resolver — Resolves design token references in style values.
 * 
 * Supports formats:
 *   $colors.primary       → direct token reference
 *   token('colors.primary') → function-style
 *   $primary 1px solid $border → inline references within strings
 * 
 * IMPORTANT: No global mutable state. Tokens are passed explicitly
 * through constructor parameters or function arguments. This ensures
 * safe parallel builds when multiple .chain.ts files use different themes.
 */

import { tokens as globalTokens } from './tokens.js';
import type { DesignTokens } from './tokens.js';

// ============================================================================
// Resolution (no global state)
// ============================================================================

/**
 * Resolve token references in a value.
 * 
 * Fallback order: explicit context → global tokens
 * (No module-level mutable context — safe for parallel builds)
 */
export function resolveToken(
  value: any,
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null
): any {
  // Early return if tokens are disabled or value is not a string
  if (!useTokens || typeof value !== 'string') return value;

  // Handle function-style: token('colors.primary')
  const functionMatch = value.match(/^(?:token|\$token)\s*\(\s*['"]([^'"]+)['"]\s*\)$/);
  if (functionMatch) {
    const tokenPath = functionMatch[1];
    const resolved = resolveTokenPath(tokenPath, tokenContext);
    return resolved !== undefined ? resolved : value;
  }

  // Handle inline token references within strings
  if (value.includes('$')) {
    return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match: string, path: string) => {
      const resolved = resolveTokenPath(path, tokenContext);
      if (resolved !== undefined && resolved !== null) {
        // Guard: if the resolved value is an object (e.g., $shadows → { sm: '...' }),
        // we can't inline it into a string. Return the match and warn.
        if (typeof resolved === 'object') {
          console.warn(`[ChainCSS] Token "${path}" resolved to an object, cannot inline into string: "${value}"`);
          return match;
        }
        return String(resolved);
      }
      // Token not found — warn in development only
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        console.warn(`[ChainCSS] Token not found: ${path}`);
      }
      return match;
    });
  }

  return value;
}

/**
 * Resolve a token path to its value.
 * Tries explicit context first, then falls back to global tokens.
 * No module-level mutable context.
 */
function resolveTokenPath(
  path: string,
  tokenContext?: DesignTokens | null
): any {
  // First try the explicitly provided token context
  if (tokenContext && typeof tokenContext.get === 'function') {
    const resolved = tokenContext.get(path);
    if (resolved !== undefined && resolved !== null) return resolved;
  }

  // Fall back to global tokens
  if (globalTokens && typeof globalTokens.get === 'function') {
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
  tokenContext?: DesignTokens | null
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = resolveTokens(value, useTokens, tokenContext);
    } else {
      result[key] = resolveToken(value, useTokens, tokenContext);
    }
  }
  return result;
}

export function hasTokenReferences(value: any): boolean {
  if (typeof value !== 'string') return false;
  return value.includes('$') || /token\(['"][^'"]+['"]\)/.test(value);
}

export function extractTokenPaths(value: string): string[] {
  const paths: string[] = [];
  const dollarRegex = /\$([a-zA-Z0-9.-]+)/g;
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

export function createTokenResolver(tokenContext?: DesignTokens | null): (value: any) => any {
  const context = tokenContext || globalTokens;
  return (value: any) => {
    if (typeof value === 'string') return resolveToken(value, true, context);
    return value;
  };
}

export function resolveBatch(
  values: string[],
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null
): string[] {
  return values.map(v => resolveToken(v, useTokens, tokenContext));
}

// ============================================================================
// TokenResolver Class (cached, per-file)
// ============================================================================

export class TokenResolver {
  private cache: Map<string, any> = new Map();
  private context: DesignTokens | null;

  constructor(context?: DesignTokens | null) {
    this.context = context || globalTokens;
  }

  resolve(value: any): any {
    if (typeof value !== 'string') return value;
    if (this.cache.has(value)) return this.cache.get(value);
    const resolved = resolveToken(value, true, this.context);
    this.cache.set(value, resolved);
    return resolved;
  }

  resolveObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = this.resolveObject(val);
      } else {
        result[key] = this.resolve(val);
      }
    }
    return result;
  }

  clearCache(): void { this.cache.clear(); }

  updateContext(context: DesignTokens | null): void {
    this.context = context || globalTokens;
    this.clearCache();
  }

  getStats(): { cacheSize: number } { return { cacheSize: this.cache.size }; }
}

// ============================================================================
// Deprecated: global context functions (no-ops, kept for backward compat)
// ============================================================================

let _legacyContext: DesignTokens | null = null;

/** @deprecated Use TokenResolver or pass tokens to PropertyStore constructor. */
export function setTokenContext(context: DesignTokens | null): void { _legacyContext = context; }

/** @deprecated Use TokenResolver or pass tokens to PropertyStore constructor. */
export function getTokenContext(): DesignTokens | null { return _legacyContext; }

/** @deprecated */
export function clearTokenContext(): void { _legacyContext = null; }

export default {
  resolveToken, setTokenContext, getTokenContext, clearTokenContext,
  resolveTokens, hasTokenReferences, extractTokenPaths,
  createTokenResolver, resolveBatch, TokenResolver
};
