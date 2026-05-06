/**
 * 1. RE-EXPORTS
 * Re-exporting everything from common-utils ensures the Compiler
 * can still find processStyleObject, resolveToken, and kebabCase
 * without changing its import statements.
 */
export * from './common-utils.js';
/**
 * 2. HASHING & NAMING (Node/Compiler Only)
 */
export declare function hashString(str: string, length?: number): string;
export declare function generateClassName(styleId: string, naming?: 'hash' | 'readable'): string;
export declare function generateAtomicClassName(prop: string, value: string, type?: 'atomic' | 'utility'): string;
export declare function generateComponentClassName(componentName: string, hash?: string): string;
/**
 * 3. OBJECT MANIPULATION
 */
export declare function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T;
export declare function deepClone<T>(obj: T): T;
export declare function deepEqual(obj1: any, obj2: any): boolean;
export declare function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
export declare function omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
/**
 * 4. FILE SYSTEM UTILS (Node Only)
 */
export declare function ensureDir(dir: string): void;
export declare function writeFile(filePath: string, content: string): void;
export declare function readFile(filePath: string): string;
export declare function fileExists(filePath: string): boolean;
export declare function getFileExtension(filePath: string): string;
export declare function getBaseName(filePath: string): string;
export declare function getDirName(filePath: string): string;
export declare function resolvePath(filePath: string): string;
export declare function isDirectory(filePath: string): boolean;
export declare function getAllFiles(dir: string, pattern?: RegExp): string[];
/**
 * 5. FORMATTING
 */
export declare function formatCSS(css: string, minify?: boolean): string;
export declare function formatJS(code: string, minify?: boolean): string;
export declare function kebabCase(str: string): string;
export declare function camelCase(str: string): string;
export declare function pascalCase(str: string): string;
export declare function snakeCase(str: string): string;
/**
 * 6. STRING UTILITIES
 */
export declare function truncate(str: string, length: number, suffix?: string): string;
export declare function indent(str: string, level?: number, char?: string): string;
export declare function stripIndent(str: string): string;
/**
 * 7. ARRAY UTILITIES
 */
export declare function unique<T>(arr: T[], key?: keyof T): T[];
export declare function chunk<T>(arr: T[], size: number): T[][];
export declare function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]>;
/**
 * 8. PERFORMANCE UTILITIES
 */
export declare function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void;
export declare function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): (...args: Parameters<T>) => void;
/**
 * 9. ERROR HANDLING
 */
export declare class ChainCSSError extends Error {
    code: string;
    details?: any;
    constructor(message: string, code?: string, details?: any);
}
export declare function tryOrWarn<T>(fn: () => T, defaultValue: T, message?: string): T;
export declare function tryOrThrow<T>(fn: () => T, errorMessage?: string): T;
/**
 * 10. LOGGING UTILITIES (Node Only)
 */
declare const LOG_LEVELS: {
    debug: number;
    info: number;
    warn: number;
    error: number;
    silent: number;
};
export declare function setLogLevel(level: keyof typeof LOG_LEVELS): void;
export declare function logDebug(message: string, ...args: any[]): void;
export declare function logInfo(message: string, ...args: any[]): void;
export declare function logWarn(message: string, ...args: any[]): void;
export declare function logError(message: string, ...args: any[]): void;
/**
 * 11. MEMORY MANAGEMENT
 */
export declare function getMemoryUsage(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
};
export declare function formatBytes(bytes: number): string;
/**
 * 12. VALIDATION UTILITIES
 */
export declare function isValidSelector(selector: string): boolean;
export declare function isValidClassName(className: string): boolean;
export declare function isValidCSSProperty(prop: string): boolean;
/**
 * 13. EXPORTS
 */
declare const _default: {
    hashString: typeof hashString;
    generateClassName: typeof generateClassName;
    generateAtomicClassName: typeof generateAtomicClassName;
    generateComponentClassName: typeof generateComponentClassName;
    deepMerge: typeof deepMerge;
    deepClone: typeof deepClone;
    deepEqual: typeof deepEqual;
    pick: typeof pick;
    omit: typeof omit;
    ensureDir: typeof ensureDir;
    writeFile: typeof writeFile;
    readFile: typeof readFile;
    fileExists: typeof fileExists;
    getFileExtension: typeof getFileExtension;
    getBaseName: typeof getBaseName;
    getDirName: typeof getDirName;
    resolvePath: typeof resolvePath;
    isDirectory: typeof isDirectory;
    getAllFiles: typeof getAllFiles;
    formatCSS: typeof formatCSS;
    formatJS: typeof formatJS;
    kebabCase: typeof kebabCase;
    camelCase: typeof camelCase;
    pascalCase: typeof pascalCase;
    snakeCase: typeof snakeCase;
    truncate: typeof truncate;
    indent: typeof indent;
    stripIndent: typeof stripIndent;
    unique: typeof unique;
    chunk: typeof chunk;
    groupBy: typeof groupBy;
    debounce: typeof debounce;
    throttle: typeof throttle;
    ChainCSSError: typeof ChainCSSError;
    tryOrWarn: typeof tryOrWarn;
    tryOrThrow: typeof tryOrThrow;
    setLogLevel: typeof setLogLevel;
    logDebug: typeof logDebug;
    logInfo: typeof logInfo;
    logWarn: typeof logWarn;
    logError: typeof logError;
    getMemoryUsage: typeof getMemoryUsage;
    formatBytes: typeof formatBytes;
    isValidSelector: typeof isValidSelector;
    isValidClassName: typeof isValidClassName;
    isValidCSSProperty: typeof isValidCSSProperty;
};
export default _default;
