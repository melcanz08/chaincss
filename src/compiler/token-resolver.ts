// src/compiler/token-resolver.ts

import { tokens as globalTokens } from './tokens.js';
import type { DesignTokens } from './tokens.js';

// Current token context (for runtime resolution)
let currentTokenContext: DesignTokens | null = null;

/**
 * Set the current token context for resolution
 */
export function setTokenContext(context: DesignTokens | null): void {
  currentTokenContext = context;
}

/**
 * Get the current token context
 */
export function getTokenContext(): DesignTokens | null {
  return currentTokenContext;
}

/**
 * Clear the current token context
 */
export function clearTokenContext(): void {
  currentTokenContext = null;
}

/**
 * Resolve token references in a value
 * Supports formats:
 * - $token.path (e.g., $colors.primary)
 * - token('path') function style
 * - Nested references within strings
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
        return String(resolved);
      }
      // Token not found - warn in development
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[ChainCSS] Token not found: ${path}`);
      }
      return match;
    });
  }
  
  return value;
}

/**
 * Resolve a token path to its value
 */
function resolveTokenPath(
  path: string, 
  tokenContext?: DesignTokens | null
): any {
  let resolved: any = null;
  
  // First try the provided token context
  if (tokenContext && typeof tokenContext.get === 'function') {
    resolved = tokenContext.get(path);
  }
  
  // If not found, try current global context
  if ((resolved === undefined || resolved === null) && currentTokenContext) {
    resolved = currentTokenContext.get(path);
  }
  
  // If still not found, try global tokens
  if (resolved === undefined || resolved === null) {
    if (globalTokens && typeof globalTokens.get === 'function') {
      resolved = globalTokens.get(path);
    }
  }
  
  return resolved;
}

/**
 * Resolve multiple token references in an object
 */
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

/**
 * Check if a value contains token references
 */
export function hasTokenReferences(value: any): boolean {
  if (typeof value !== 'string') return false;
  return value.includes('$') || /token\(['"][^'"]+['"]\)/.test(value);
}

/**
 * Extract all token paths from a string
 */
export function extractTokenPaths(value: string): string[] {
  const paths: string[] = [];
  
  // Match $token.path format
  const dollarRegex = /\$([a-zA-Z0-9.-]+)/g;
  let match;
  while ((match = dollarRegex.exec(value)) !== null) {
    paths.push(match[1]);
  }
  
  // Match token('path') format
  const functionRegex = /token\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = functionRegex.exec(value)) !== null) {
    paths.push(match[1]);
  }
  
  return [...new Set(paths)]; // Remove duplicates
}

/**
 * Create a token resolver function for a specific context
 */
export function createTokenResolver(tokenContext?: DesignTokens | null): (value: any) => any {
  const context = tokenContext || currentTokenContext || globalTokens;
  
  return (value: any) => {
    if (typeof value === 'string') {
      return resolveToken(value, true, context);
    }
    return value;
  };
}

/**
 * Batch resolve multiple values
 */
export function resolveBatch(
  values: string[],
  useTokens: boolean = true,
  tokenContext?: DesignTokens | null
): string[] {
  return values.map(v => resolveToken(v, useTokens, tokenContext));
}

/**
 * Token resolver class for caching and batch operations
 */
export class TokenResolver {
  private cache: Map<string, any> = new Map();
  private context: DesignTokens | null;
  
  constructor(context?: DesignTokens | null) {
    this.context = context || currentTokenContext || globalTokens;
  }
  
  resolve(value: any): any {
    if (typeof value !== 'string') return value;
    
    // Check cache
    if (this.cache.has(value)) {
      return this.cache.get(value);
    }
    
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
  
  clearCache(): void {
    this.cache.clear();
  }
  
  updateContext(context: DesignTokens | null): void {
    this.context = context || globalTokens;
    this.clearCache();
  }
  
  getStats(): { cacheSize: number } {
    return { cacheSize: this.cache.size };
  }
}

// Export default with all utilities
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
  TokenResolver
};