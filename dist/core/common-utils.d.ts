import type { DesignTokens } from '../compiler/tokens.js';
/**
 * Convert camelCase to kebab-case
 */
export declare function kebabCase(str: string): string;
/**
 * Convert kebab-case to camelCase
 */
export declare function camelCase(str: string): string;
/**
 * Resolve token references in a value
 * Supports $token.path format
 */
export declare function resolveToken(value: any, tokenStore?: Record<string, any> | DesignTokens, debug?: boolean): any;
/**
 * Process a style object, expanding shorthands and resolving tokens
 */
export declare function processStyleObject(obj: Record<string, any>, tokenStore?: Record<string, any> | DesignTokens, options?: {
    useTokens?: boolean;
    debug?: boolean;
}): string;
/**
 * Extract CSS string from style definition
 */
export declare function extractCSS(styleDef: Record<string, any>): string;
/**
 * Extract hover CSS from style definition
 */
export declare function extractHoverCSS(styleDef: Record<string, any>): string;
/**
 * Merge multiple style objects
 */
export declare function mergeStyles(...styles: Record<string, any>[]): Record<string, any>;
/**
 * Check if a value is a valid CSS length
 */
export declare function isValidCSSLength(value: any): boolean;
/**
 * Check if a value is a valid CSS color
 */
export declare function isValidCSSColor(value: any): boolean;
/**
 * Escape CSS selector
 */
export declare function escapeSelector(selector: string): string;
/**
 * Clean class name for CSS
 */
export declare function cleanClassName(className: string): string;
/**
 * Extract numeric value from CSS value
 */
export declare function extractNumericValue(value: string): number;
/**
 * Extract unit from CSS value
 */
export declare function extractUnit(value: string): string;
/**
 * Add unit to numeric value if missing
 */
export declare function addUnit(value: number | string, unit?: string): string;
/**
 * Sort class names for consistent output
 */
export declare function sortClassNames(classNames: string[]): string[];
/**
 * Join class names safely
 */
export declare function cn(...classes: (string | undefined | null | false)[]): string;
export declare function enableDebug(enable?: boolean): void;
export declare function isDebugEnabled(): boolean;
/**
 * Debug log function
 */
export declare function debugLog(message: string, ...args: any[]): void;
declare const _default: {
    kebabCase: typeof kebabCase;
    camelCase: typeof camelCase;
    resolveToken: typeof resolveToken;
    processStyleObject: typeof processStyleObject;
    extractCSS: typeof extractCSS;
    extractHoverCSS: typeof extractHoverCSS;
    mergeStyles: typeof mergeStyles;
    isValidCSSLength: typeof isValidCSSLength;
    isValidCSSColor: typeof isValidCSSColor;
    escapeSelector: typeof escapeSelector;
    cleanClassName: typeof cleanClassName;
    extractNumericValue: typeof extractNumericValue;
    extractUnit: typeof extractUnit;
    addUnit: typeof addUnit;
    sortClassNames: typeof sortClassNames;
    cn: typeof cn;
    enableDebug: typeof enableDebug;
    isDebugEnabled: typeof isDebugEnabled;
    debugLog: typeof debugLog;
};
export default _default;
