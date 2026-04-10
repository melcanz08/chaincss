// chaincss/src/core/utils.ts

import crypto from 'crypto';

/**
 * Generate a hash for a string
 */
export function hashString(str: string, length: number = 6): string {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, length);
}

/**
 * Convert camelCase to kebab-case
 */
export function kebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Generate a unique class name
 */
export function generateClassName(styleId: string, naming: 'hash' | 'readable' = 'hash'): string {
  if (naming === 'hash') {
    return `c_${hashString(styleId)}`;
  }
  // Readable naming for debugging
  return `chain-${styleId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target } as any;
  for (const key in source) {
    const srcVal = source[key];
    if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
      result[key] = deepMerge(result[key] || {}, srcVal);
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * Ensure directory exists
 */
export function ensureDir(dir: string): void {
  const fs = require('fs');
  const path = require('path');
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write file with parent directory creation
 */
export function writeFile(filePath: string, content: string): void {
  const fs = require('fs');
  const path = require('path');
  
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Format CSS (minify or beautify)
 */
export function formatCSS(css: string, minify: boolean = false): string {
  if (!minify) {
    // Beautify - add newlines and indentation
    return css
      .replace(/{/g, ' {\n  ')
      .replace(/;/g, ';\n  ')
      .replace(/}/g, '\n}\n')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
  
  // Minify - remove whitespace
  return css
    .replace(/\/\*.*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*{\s*/g, '{')
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*:\s*/g, ':')
    .trim();
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
  const path = require('path');
  return path.extname(filePath);
}

/**
 * Get base name without extension
 */
export function getBaseName(filePath: string): string {
  const path = require('path');
  return path.basename(filePath, path.extname(filePath));
}