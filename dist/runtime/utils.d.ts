/**
 * Runtime utility functions for ChainCSS
 */
/**
 * Generate a unique ID for style injection
 */
export declare function generateStyleId(prefix?: string): string;
/**
 * Simple hash function for class name generation
 */
export declare function hashString(str: string): string;
/**
 * Convert camelCase to kebab-case
 */
export declare function kebabCase(str: string): string;
/**
 * Check if code is running in browser
 */
export declare const isBrowser: boolean;
/**
 * Check if code is running in development mode
 */
export declare const isDevelopment: boolean;
/**
 * Check if code is running in production mode
 */
export declare const isProduction: boolean;
/**
 * Debounce function for HMR updates
 */
export declare function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void;
/**
 * Memoize function results
 */
export declare function memoize<T extends (...args: any[]) => any>(fn: T): T & {
    cache: Map<string, ReturnType<T>>;
};
/**
 * Safe class name joiner (like clsx)
 */
export declare function cn(...classes: (string | undefined | null | false)[]): string;
/**
 * Warn in development only
 */
export declare function devWarn(message: string, ...args: any[]): void;
/**
 * Log in development only
 */
export declare function devLog(message: string, ...args: any[]): void;
/**
 * Error logging (always)
 */
export declare function logError(message: string, error?: Error): void;
/**
 * Create a debug logger
 */
export declare function createDebugger(module: string): {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
};
//# sourceMappingURL=utils.d.ts.map