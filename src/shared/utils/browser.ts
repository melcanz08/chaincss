// src/shared/utils/browser.ts

// Browser-safe utilities (no Node.js dependencies)
// ============================================================================

// String utilities
export function kebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function pascalCase(str: string): string {
  const camel = camelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function snakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

export function hashString(str: string, length: number = 6): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, length);
}

export function generateClassName(styleId: string, naming: 'hash' | 'readable' = 'hash'): string {
  if (naming === 'readable') {
    return styleId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  }
  return `_${hashString(styleId)}`;
}

export function generateAtomicClassName(prop: string, value: string, type: 'atomic' | 'utility' = 'atomic'): string {
  const prefix = type === 'atomic' ? 'a' : 'u';
  const hash = hashString(`${prop}-${value}`);
  return `${prefix}-${hash}`;
}

export function generateComponentClassName(componentName: string, hash?: string): string {
  const cleanName = componentName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  return hash ? `${cleanName}-${hash}` : cleanName;
}

// Object utilities
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result: Record<string, any> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge(target[key] || {}, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result as Pick<T, K>;
}

export function omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result: Partial<T> = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

// Formatting utilities
export function formatCSS(css: string, minify = false): string {
  if (minify) {
    return css.replace(/\s+/g, ' ').replace(/;\s*/g, ';').trim();
  }
  return css.trim();
}

export function formatJS(code: string, minify = false): string {
  if (minify) {
    return code.replace(/\s+/g, ' ').trim();
  }
  return code.trim();
}

export function truncate(str: string, len: number, suffix = '...'): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + suffix;
}

export function indent(str: string, level = 1, char = '  '): string {
  const prefix = char.repeat(level);
  return str.split('\n').map(line => prefix + line).join('\n');
}

export function stripIndent(str: string): string {
  const lines = str.split('\n');
  const minIndent = lines.reduce((min, line) => {
    if (!line.trim()) return min;
    const indent = line.match(/^\s*/)?.[0].length || 0;
    return Math.min(min, indent);
  }, Infinity);
  return lines.map(line => line.slice(minIndent)).join('\n');
}

// Array utilities
export function unique<T>(arr: T[], key?: keyof T): T[] {
  if (key) {
    const seen = new Set();
    return arr.filter(item => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
  return [...new Set(arr)];
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

// Function utilities
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}

export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Error handling
export class ChainCSSError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChainCSSError';
  }
}

export function tryOrWarn<T>(fn: () => T, def: T, msg?: string): T {
  try { return fn(); }
  catch (e) { console.warn(msg || 'Operation failed', e); return def; }
}

export function tryOrThrow<T>(fn: () => T, errMsg?: string): T {
  try { return fn(); }
  catch (e) { throw new Error(errMsg || 'Operation failed'); }
}

// Logging utilities (browser-safe)
let currentLogLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
  currentLogLevel = level;
}

function shouldLog(level: string): boolean {
  const levels = ['debug', 'info', 'warn', 'error'];
  return levels.indexOf(level) >= levels.indexOf(currentLogLevel);
}

export const logDebug = (msg: string, ...args: any[]) => {
  if (shouldLog('debug')) console.debug(`[ChainCSS Debug] ${msg}`, ...args);
};

export const logInfo = (msg: string, ...args: any[]) => {
  if (shouldLog('info')) console.log(`[ChainCSS] ${msg}`, ...args);
};

export const logWarn = (msg: string, ...args: any[]) => {
  if (shouldLog('warn')) console.warn(`[ChainCSS Warning] ${msg}`, ...args);
};

export const logError = (msg: string, ...args: any[]) => {
  if (shouldLog('error')) console.error(`[ChainCSS Error] ${msg}`, ...args);
};

export function devWarn(message: string, ...args: any[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[ChainCSS Dev] ${message}`, ...args);
  }
}

export function devLog(message: string, ...args: any[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ChainCSS Dev] ${message}`, ...args);
  }
}

export function createDebugger(module: string) {
  return {
    log: (...args: any[]) => devLog(`[${module}]`, ...args),
    warn: (...args: any[]) => devWarn(`[${module}]`, ...args),
  };
}

// Validation utilities
export function isValidSelector(s: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(s);
}

export function isValidClassName(c: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(c);
}

export function isValidCSSProperty(p: string): boolean {
  return /^[a-zA-Z-]+$/.test(p);
}

// Runtime utilities
export function generateStyleId(prefix: string = 'chain'): string {
  const random = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}-${random}`;
}

export const isBrowser = typeof window !== 'undefined';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
