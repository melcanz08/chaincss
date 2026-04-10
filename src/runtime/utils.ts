// chaincss/src/runtime/utils.ts

/**
 * Runtime utility functions for ChainCSS
 */

/**
 * Generate a unique ID for style injection
 */
export function generateStyleId(prefix: string = 'chain'): string {
  const random = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Simple hash function for class name generation
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Convert camelCase to kebab-case
 */
export function kebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Check if code is running in browser
 */
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Check if code is running in development mode
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Check if code is running in production mode
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Debounce function for HMR updates
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T
): T & { cache: Map<string, ReturnType<T>> } {
  const cache = new Map<string, ReturnType<T>>();
  
  const memoized = ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T & { cache: Map<string, ReturnType<T>> };
  
  memoized.cache = cache;
  return memoized;
}

/**
 * Safe class name joiner (like clsx)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Warn in development only
 */
export function devWarn(message: string, ...args: any[]): void {
  if (isDevelopment) {
    console.warn(`[ChainCSS] ${message}`, ...args);
  }
}

/**
 * Log in development only
 */
export function devLog(message: string, ...args: any[]): void {
  if (isDevelopment) {
    console.log(`[ChainCSS] ${message}`, ...args);
  }
}

/**
 * Error logging (always)
 */
export function logError(message: string, error?: Error): void {
  console.error(`[ChainCSS] ${message}`, error || '');
}

/**
 * Create a debug logger
 */
export function createDebugger(module: string) {
  return {
    log: (...args: any[]) => devLog(`[${module}]`, ...args),
    warn: (...args: any[]) => devWarn(`[${module}]`, ...args),
    error: (...args: any[]) => logError(`[${module}]`, ...args)
  };
}