import type { DesignTokens } from './tokens.js';
/**
 * Set the current token context for resolution
 */
export declare function setTokenContext(context: DesignTokens | null): void;
/**
 * Get the current token context
 */
export declare function getTokenContext(): DesignTokens | null;
/**
 * Clear the current token context
 */
export declare function clearTokenContext(): void;
/**
 * Resolve token references in a value
 * Supports formats:
 * - $token.path (e.g., $colors.primary)
 * - token('path') function style
 * - Nested references within strings
 */
export declare function resolveToken(value: any, useTokens?: boolean, tokenContext?: DesignTokens | null): any;
/**
 * Resolve multiple token references in an object
 */
export declare function resolveTokens(obj: Record<string, any>, useTokens?: boolean, tokenContext?: DesignTokens | null): Record<string, any>;
/**
 * Check if a value contains token references
 */
export declare function hasTokenReferences(value: any): boolean;
/**
 * Extract all token paths from a string
 */
export declare function extractTokenPaths(value: string): string[];
/**
 * Create a token resolver function for a specific context
 */
export declare function createTokenResolver(tokenContext?: DesignTokens | null): (value: any) => any;
/**
 * Batch resolve multiple values
 */
export declare function resolveBatch(values: string[], useTokens?: boolean, tokenContext?: DesignTokens | null): string[];
/**
 * Token resolver class for caching and batch operations
 */
export declare class TokenResolver {
    private cache;
    private context;
    constructor(context?: DesignTokens | null);
    resolve(value: any): any;
    resolveObject(obj: Record<string, any>): Record<string, any>;
    clearCache(): void;
    updateContext(context: DesignTokens | null): void;
    getStats(): {
        cacheSize: number;
    };
}
declare const _default: {
    resolveToken: typeof resolveToken;
    setTokenContext: typeof setTokenContext;
    getTokenContext: typeof getTokenContext;
    clearTokenContext: typeof clearTokenContext;
    resolveTokens: typeof resolveTokens;
    hasTokenReferences: typeof hasTokenReferences;
    extractTokenPaths: typeof extractTokenPaths;
    createTokenResolver: typeof createTokenResolver;
    resolveBatch: typeof resolveBatch;
    TokenResolver: typeof TokenResolver;
};
export default _default;
