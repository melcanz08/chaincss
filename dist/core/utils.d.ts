/**
 * Generate a hash for a string
 */
export declare function hashString(str: string, length?: number): string;
/**
 * Convert camelCase to kebab-case
 */
export declare function kebabCase(str: string): string;
/**
 * Generate a unique class name
 */
export declare function generateClassName(styleId: string, naming?: 'hash' | 'readable'): string;
/**
 * Deep merge objects
 */
export declare function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T;
/**
 * Ensure directory exists
 */
export declare function ensureDir(dir: string): void;
/**
 * Write file with parent directory creation
 */
export declare function writeFile(filePath: string, content: string): void;
/**
 * Format CSS (minify or beautify)
 */
export declare function formatCSS(css: string, minify?: boolean): string;
/**
 * Get file extension
 */
export declare function getFileExtension(filePath: string): string;
/**
 * Get base name without extension
 */
export declare function getBaseName(filePath: string): string;
//# sourceMappingURL=utils.d.ts.map