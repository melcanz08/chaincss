// src/core/common-utils.ts

import { shorthandMap, macros } from '../compiler/shorthands.js';
import type { DesignTokens } from '../compiler/tokens.js';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert camelCase to kebab-case
 */
export function kebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 */
export function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

// ============================================================================
// Token Resolution
// ============================================================================

/**
 * Resolve token references in a value
 * Supports $token.path format
 */
export function resolveToken(
  value: any, 
  tokenStore: Record<string, any> | DesignTokens = {},
  debug: boolean = false
): any {
  if (typeof value !== 'string' || !value.includes('$')) return value;

  return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match, pathStr) => {
    const parts = pathStr.split('.');
    let current: any = tokenStore;

    // Handle DesignTokens instance
    if (current && typeof current.get === 'function') {
      const resolved = current.get(pathStr);
      if (resolved !== undefined && resolved !== null) {
        if (debug) {
          console.log(`✨ Resolved ${match} to ${resolved}`);
        }
        return String(resolved);
      }
    }

    // Handle plain object
    for (const part of parts) {
      if (current && current[part] !== undefined) {
        current = current[part];
      } else {
        if (debug) {
          console.warn(`⚠️ Token not found: ${match}`);
        }
        return match;
      }
    }

    if (typeof current === 'string' || typeof current === 'number') {
      if (debug) {
        console.log(`✨ Resolved ${match} to ${current}`);
      }
      return String(current);
    }
    
    return match;
  });
}

// ============================================================================
// Style Object Processing
// ============================================================================

/**
 * Process a style object, expanding shorthands and resolving tokens
 */
export function processStyleObject(
  obj: Record<string, any>, 
  tokenStore: Record<string, any> | DesignTokens = {},
  options: { useTokens?: boolean; debug?: boolean } = {}
): string {
  const { useTokens = true, debug = false } = options;
  let css = '';
  const expandedProps: Record<string, any> = {};
  
  if (debug) {
    console.log('[ChainCSS] Processing style object:', obj);
    if (tokenStore && typeof tokenStore === 'object') {
      const tokenKeys = Object.keys(tokenStore);
      if (tokenKeys.length > 0) {
        console.log('[ChainCSS] Token store available:', tokenKeys);
      }
    }
  }
  
  for (let [key, value] of Object.entries(obj)) {
    // Skip internal properties
    if (key.startsWith('_')) continue;
    
    // Skip nested objects (handled separately)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      continue;
    }
    
    // Handle macros (mx, my, px, py, etc.)
    if (macros && macros[key]) {
      try {
        macros[key](value, expandedProps, useTokens);
      } catch (error) {
        console.warn(`[ChainCSS] Error applying macro "${key}":`, error);
      }
    } else {
      const realKey = shorthandMap[key] || key;
      expandedProps[realKey] = value;
    }
  }
  
  if (debug) {
    console.log('[ChainCSS] Expanded properties:', expandedProps);
  }
  
  // Generate CSS string from expanded properties
  const unitlessProps = [
    'opacity', 'zIndex', 'fontWeight', 'flex', 'flexGrow', 'flexShrink', 
    'order', 'gridColumn', 'gridRow', 'animationIterationCount', 'lineHeight'
  ];
  
  for (let [key, value] of Object.entries(expandedProps)) {
    if (debug) {
      console.log(`[ChainCSS] Processing property: ${key} = ${value}`);
    }
    
    // Resolve token references
    let finalValue = value;
    if (useTokens && typeof value === 'string') {
      finalValue = resolveToken(value, tokenStore, debug);
    }
    
    const kebabKey = kebabCase(key);
    
    // Add unit for numeric values
    let unit = '';
    if (typeof value === 'number' && !unitlessProps.includes(key)) {
      unit = 'px';
    }
    
    css += `  ${kebabKey}: ${finalValue}${unit};\n`;
  }
  
  return css;
}

// ============================================================================
// Style Extraction
// ============================================================================

/**
 * Extract CSS string from style definition
 */
export function extractCSS(styleDef: Record<string, any>): string {
  let css = '';
  const selectors = styleDef.selectors || [''];
  
  for (const [key, value] of Object.entries(styleDef)) {
    if (key === 'selectors' || key === 'hover' || key === 'atRules' || key === 'nestedRules') {
      continue;
    }
    
    const kebabKey = kebabCase(key);
    css += `${kebabKey}: ${value};`;
  }
  
  if (!css) return '';
  
  return `${selectors.join(', ')} { ${css} }`;
}

/**
 * Extract hover CSS from style definition
 */
export function extractHoverCSS(styleDef: Record<string, any>): string {
  const hover = styleDef.hover;
  if (!hover || typeof hover !== 'object') return '';
  
  const selectors = styleDef.selectors || [''];
  let hoverCSS = '';
  
  for (const [key, value] of Object.entries(hover)) {
    const kebabKey = kebabCase(key);
    hoverCSS += `${kebabKey}: ${value};`;
  }
  
  if (!hoverCSS) return '';
  
  return `${selectors.join(', ')}:hover { ${hoverCSS} }`;
}

// ============================================================================
// Style Merging
// ============================================================================

/**
 * Merge multiple style objects
 */
export function mergeStyles(...styles: Record<string, any>[]): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const style of styles) {
    if (!style) continue;
    
    for (const [key, value] of Object.entries(style)) {
      if (key === 'hover' && result.hover && typeof value === 'object') {
        result.hover = { ...result.hover, ...value };
      } else if (key === 'selectors' && result.selectors) {
        const newSelectors = Array.isArray(value) ? value : [value];
        const existingSelectors = Array.isArray(result.selectors) ? result.selectors : [result.selectors];
        result.selectors = [...new Set([...existingSelectors, ...newSelectors])];
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if a value is a valid CSS length
 */
export function isValidCSSLength(value: any): boolean {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;
  
  const lengthRegex = /^[+-]?\d*\.?\d+(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc)?$/;
  return lengthRegex.test(value);
}

/**
 * Check if a value is a valid CSS color
 */
export function isValidCSSColor(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Hex colors
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) return true;
  
  // RGB/RGBA
  if (/^rgba?\([^)]+\)$/.test(value)) return true;
  
  // HSL/HSLA
  if (/^hsla?\([^)]+\)$/.test(value)) return true;
  
  // Named colors
  const namedColors = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
    'gray', 'grey', 'transparent', 'currentColor', 'inherit', 'initial',
    'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige',
    'bisque', 'blanchedalmond', 'blueviolet', 'brown', 'burlywood', 'cadetblue',
    'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson'
  ];
  if (namedColors.includes(value.toLowerCase())) return true;
  
  return false;
}

// ============================================================================
// Selector Utilities
// ============================================================================

/**
 * Escape CSS selector
 */
export function escapeSelector(selector: string): string {
  if (!selector) return '';
  
  // Escape special characters in CSS selectors
  return selector.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Clean class name for CSS
 */
export function cleanClassName(className: string): string {
  if (!className) return '';
  
  // Remove invalid characters and ensure it starts with a letter or underscore
  let cleaned = className.replace(/[^a-zA-Z0-9_-]/g, '-');
  
  // Ensure it starts with a valid character
  if (!/^[a-zA-Z_]/.test(cleaned)) {
    cleaned = `c-${cleaned}`;
  }
  
  return cleaned;
}

// ============================================================================
// Value Extraction
// ============================================================================

/**
 * Extract numeric value from CSS value
 */
export function extractNumericValue(value: string): number {
  const match = value.match(/^[+-]?\d*\.?\d+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Extract unit from CSS value
 */
export function extractUnit(value: string): string {
  const match = value.match(/[a-z%]+$/);
  return match ? match[0] : '';
}

/**
 * Add unit to numeric value if missing
 */
export function addUnit(value: number | string, unit: string = 'px'): string {
  if (typeof value === 'number') return `${value}${unit}`;
  if (typeof value === 'string') {
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}${unit}`;
    return value;
  }
  return String(value);
}

// ============================================================================
// Class Name Utilities
// ============================================================================

/**
 * Sort class names for consistent output
 */
export function sortClassNames(classNames: string[]): string[] {
  return [...classNames].sort((a, b) => {
    // Atomic classes (a-*) come first
    const aIsAtomic = a.startsWith('a-');
    const bIsAtomic = b.startsWith('a-');
    if (aIsAtomic && !bIsAtomic) return -1;
    if (!aIsAtomic && bIsAtomic) return 1;
    
    // Component classes (c-*) come next
    const aIsComponent = a.startsWith('c-');
    const bIsComponent = b.startsWith('c-');
    if (aIsComponent && !bIsComponent) return -1;
    if (!aIsComponent && bIsComponent) return 1;
    
    // Then alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Join class names safely
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Create a debug logger
 */
let debugMode = false;

export function enableDebug(enable: boolean = true): void {
  debugMode = enable;
}

export function isDebugEnabled(): boolean {
  return debugMode;
}

/**
 * Debug log function
 */
export function debugLog(message: string, ...args: any[]): void {
  if (debugMode) {
    console.log(`[ChainCSS Debug] ${message}`, ...args);
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  kebabCase,
  camelCase,
  resolveToken,
  processStyleObject,
  extractCSS,
  extractHoverCSS,
  mergeStyles,
  isValidCSSLength,
  isValidCSSColor,
  escapeSelector,
  cleanClassName,
  extractNumericValue,
  extractUnit,
  addUnit,
  sortClassNames,
  cn,
  enableDebug,
  isDebugEnabled,
  debugLog
};