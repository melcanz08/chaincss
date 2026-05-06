// chaincss/src/core/utils.ts

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 1. RE-EXPORTS
 * Re-exporting everything from common-utils ensures the Compiler
 * can still find processStyleObject, resolveToken, and kebabCase
 * without changing its import statements.
 */
export * from './common-utils.js';

// Import types
import type { StyleDefinition } from '../compiler/btt.js';

/**
 * 2. HASHING & NAMING (Node/Compiler Only)
 */
export function hashString(str: string, length: number = 6): string {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, length);
}

export function generateClassName(styleId: string, naming: 'hash' | 'readable' = 'hash'): string {
  if (naming === 'hash') {
    return `c_${hashString(styleId)}`;
  }
  // Clean the styleId for readable names
  const cleanId = styleId
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `chain-${cleanId}`;
}

// Generate atomic class name
export function generateAtomicClassName(prop: string, value: string, type: 'atomic' | 'utility' = 'atomic'): string {
  const hash = hashString(`${prop}:${value}`, 6);
  const propKebab = kebabCase(prop);
  
  if (type === 'utility') {
    return `u-${propKebab}-${hash}`;
  }
  return `a-${propKebab}-${hash}`;
}

// Generate component class name with hash for uniqueness
export function generateComponentClassName(componentName: string, hash?: string): string {
  const cleanName = componentName
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  
  const suffix = hash || hashString(componentName, 4);
  return `c-${cleanName}-${suffix}`;
}

/**
 * 3. OBJECT MANIPULATION
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target } as any;
  
  for (const key in source) {
    const srcVal = source[key];
    const targetVal = result[key];
    
    if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
      result[key] = deepMerge(targetVal || {}, srcVal);
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  
  return result;
}

// Deep clone an object
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as any;
  
  const cloned: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

// Check if two objects are deeply equal
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  if (obj1 === null || obj2 === null) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}

// Pick specific keys from an object
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result as Pick<T, K>;
}

// Omit specific keys from an object
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * 4. FILE SYSTEM UTILS (Node Only)
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf8');
}

export function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function getFileExtension(filePath: string): string {
  return path.extname(filePath);
}

export function getBaseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export function getDirName(filePath: string): string {
  return path.dirname(filePath);
}

// Resolve a relative path from current working directory
export function resolvePath(filePath: string): string {
  return path.resolve(process.cwd(), filePath);
}

// Check if a path is a directory
export function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

// Get all files recursively in a directory
export function getAllFiles(dir: string, pattern?: RegExp): string[] {
  const files: string[] = [];
  
  const readDir = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir);
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        readDir(fullPath);
      } else if (!pattern || pattern.test(fullPath)) {
        files.push(fullPath);
      }
    }
  };
  
  readDir(dir);
  return files;
}

/**
 * 5. FORMATTING
 */
export function formatCSS(css: string, minify: boolean = false): string {
  if (!css || css.trim().length === 0) return '';
  
  if (!minify) {
    // Format nicely with proper indentation
    let formatted = css
      .replace(/\s*{\s*/g, ' {\n  ')
      .replace(/;\s*/g, ';\n  ')
      .replace(/\s*}\s*/g, '\n}\n')
      .replace(/\n\s*\n/g, '\n');
    
    // Ensure proper spacing for media queries
    formatted = formatted.replace(/@media[^{]+\{/g, match => {
      return match.replace(/\{/, ' {\n');
    });
    
    return formatted.trim();
  }
  
  // Minify CSS
  return css
    .replace(/\/\*.*?\*\//g, '')           // Remove comments
    .replace(/\s+/g, ' ')                   // Collapse whitespace
    .replace(/\s*{\s*/g, '{')               // Remove spaces around braces
    .replace(/\s*}\s*/g, '}')               // Remove spaces around braces
    .replace(/\s*;\s*/g, ';')               // Remove spaces around semicolons
    .replace(/\s*:\s*/g, ':')               // Remove spaces around colons
    .replace(/;}/g, '}')                    // Remove last semicolon
    .trim();
}

// Format JavaScript/TypeScript code
export function formatJS(code: string, minify: boolean = false): string {
  if (!minify) {
    return code;
  }
  
  return code
    .replace(/\/\/.*$/gm, '')               // Remove single-line comments
    .replace(/\/\*.*?\*\//g, '')            // Remove multi-line comments
    .replace(/\s+/g, ' ')                   // Collapse whitespace
    .trim();
}

// Convert string to kebab-case
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// Convert string to camelCase
export function camelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
    .replace(/^[A-Z]/, char => char.toLowerCase());
}

// Convert string to PascalCase
export function pascalCase(str: string): string {
  const camel = camelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

// Convert string to snake_case
export function snakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * 6. STRING UTILITIES
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

export function indent(str: string, level: number = 1, char: string = '  '): string {
  const indentStr = char.repeat(level);
  return str
    .split('\n')
    .map(line => indentStr + line)
    .join('\n');
}

export function stripIndent(str: string): string {
  const lines = str.split('\n');
  const minIndent = Math.min(
    ...lines
      .filter(line => line.trim())
      .map(line => line.match(/^\s*/)?.[0].length || 0)
  );
  
  return lines
    .map(line => line.slice(minIndent))
    .join('\n')
    .trim();
}

/**
 * 7. ARRAY UTILITIES
 */
export function unique<T>(arr: T[], key?: keyof T): T[] {
  if (!key) {
    return [...new Set(arr)];
  }
  
  const seen = new Set();
  return arr.filter(item => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
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
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
  }
  
  return result;
}

/**
 * 8. PERFORMANCE UTILITIES
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 9. ERROR HANDLING
 */
export class ChainCSSError extends Error {
  public code: string;
  public details?: any;
  
  constructor(message: string, code: string = 'CHAINCSS_ERROR', details?: any) {
    super(message);
    this.name = 'ChainCSSError';
    this.code = code;
    this.details = details;
  }
}

export function tryOrWarn<T>(fn: () => T, defaultValue: T, message?: string): T {
  try {
    return fn();
  } catch (error) {
    if (message) {
      console.warn(message, error);
    }
    return defaultValue;
  }
}

export function tryOrThrow<T>(fn: () => T, errorMessage?: string): T {
  try {
    return fn();
  } catch (error) {
    throw new ChainCSSError(
      errorMessage || (error as Error).message,
      'EXECUTION_ERROR',
      error
    );
  }
}

/**
 * 10. LOGGING UTILITIES (Node Only)
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

let currentLogLevel = process.env.DEBUG ? 'debug' : 'info';

export function setLogLevel(level: keyof typeof LOG_LEVELS): void {
  currentLogLevel = level;
}

function shouldLog(level: keyof typeof LOG_LEVELS): boolean {
  return LOG_LEVELS[level as keyof typeof LOG_LEVELS] >= LOG_LEVELS[currentLogLevel as keyof typeof LOG_LEVELS];
}

export function logDebug(message: string, ...args: any[]): void {
  if (shouldLog('debug')) {
    console.debug(`[ChainCSS Debug] ${message}`, ...args);
  }
}

export function logInfo(message: string, ...args: any[]): void {
  if (shouldLog('info')) {
    console.log(`[ChainCSS] ${message}`, ...args);
  }
}

export function logWarn(message: string, ...args: any[]): void {
  if (shouldLog('warn')) {
    console.warn(`[ChainCSS Warning] ${message}`, ...args);
  }
}

export function logError(message: string, ...args: any[]): void {
  if (shouldLog('error')) {
    console.error(`[ChainCSS Error] ${message}`, ...args);
  }
}

/**
 * 11. MEMORY MANAGEMENT
 */
export function getMemoryUsage(): { rss: number; heapTotal: number; heapUsed: number; external: number } {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 12. VALIDATION UTILITIES
 */
export function isValidSelector(selector: string): boolean {
  // Basic selector validation
  if (!selector || typeof selector !== 'string') return false;
  if (selector.length > 100) return false;
  
  // Check for invalid characters
  const invalidChars = /[<>`~]/;
  if (invalidChars.test(selector)) return false;
  
  return true;
}

export function isValidClassName(className: string): boolean {
  if (!className || typeof className !== 'string') return false;
  if (className.length > 50) return false;
  
  // CSS class name regex (letters, numbers, hyphens, underscores)
  const classNameRegex = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
  return classNameRegex.test(className);
}

export function isValidCSSProperty(prop: string): boolean {
  if (!prop || typeof prop !== 'string') return false;
  // CSS property regex
  const cssPropRegex = /^[a-z][a-z-]*$/;
  return cssPropRegex.test(prop);
}

/**
 * 13. EXPORTS
 */
export default {
  // Hashing
  hashString,
  generateClassName,
  generateAtomicClassName,
  generateComponentClassName,
  
  // Objects
  deepMerge,
  deepClone,
  deepEqual,
  pick,
  omit,
  
  // Filesystem
  ensureDir,
  writeFile,
  readFile,
  fileExists,
  getFileExtension,
  getBaseName,
  getDirName,
  resolvePath,
  isDirectory,
  getAllFiles,
  
  // Formatting
  formatCSS,
  formatJS,
  kebabCase,
  camelCase,
  pascalCase,
  snakeCase,
  
  // Strings
  truncate,
  indent,
  stripIndent,
  
  // Arrays
  unique,
  chunk,
  groupBy,
  
  // Performance
  debounce,
  throttle,
  
  // Errors
  ChainCSSError,
  tryOrWarn,
  tryOrThrow,
  
  // Logging
  setLogLevel,
  logDebug,
  logInfo,
  logWarn,
  logError,
  
  // Memory
  getMemoryUsage,
  formatBytes,
  
  // Validation
  isValidSelector,
  isValidClassName,
  isValidCSSProperty
};