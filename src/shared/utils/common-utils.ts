// src/shared/utils/common-utils.ts

import { shorthandMap, macros } from "../../compiler/utils/shorthands.js";
import type { DesignTokens } from "../../compiler/tokens/tokens.js";

// ============================================================================
// Utility Functions (Optimized with String Caching & Loop Avoidance)
// ============================================================================

const kebabCache: Record<string, string> = Object.create(null);
const camelCache: Record<string, string> = Object.create(null);

/**
 * Convert camelCase to kebab-case (Cached)
 */
export function kebabCase(str: string): string {
  if (kebabCache[str]) return kebabCache[str];
  return (kebabCache[str] = str.replace(/([A-Z])/g, "-$1").toLowerCase());
}

/**
 * Convert kebab-case to camelCase (Cached)
 */
export function camelCase(str: string): string {
  if (camelCache[str]) return camelCache[str];
  return (camelCache[str] = str.replace(/-([a-z])/g, (_, letter) =>
    letter.toUpperCase(),
  ));
}

// ============================================================================
// Token Resolution
// ============================================================================

/**
 * Resolve token references in a value
 * Supports $token.path format
 */
const IGNORE_TOKEN_PROPS = new Set(["content", "font-family", "url"]);
export function resolveToken(
  value: any,
  tokenStore: Record<string, any> | DesignTokens = {},
  key?: string, // Added key to check against ignore list
  debug: boolean = false,
): any {
  // If property is in ignore list, skip token resolution
  if (key && IGNORE_TOKEN_PROPS.has(key)) return value;

  if (typeof value !== "string" || !value.includes("$")) return value;

  return value.replace(/\$([a-zA-Z0-9_.-]+)/g, (match, pathStr) => {
    // If path ends with a trailing hyphen/dot due to regex capture, strip it
    const cleanPath = pathStr.replace(/[.-]$/, "");
    const parts = cleanPath.split(".");
    let current: any = tokenStore;

    // Handle DesignTokens instance
    if (current && typeof current.get === "function") {
      const resolved = current.get(cleanPath);
      if (resolved !== undefined && resolved !== null) {
        if (debug) console.log(`✨ Resolved ${match} to ${resolved}`);
        return String(resolved);
      }
    }

    // Fast-path lookup loop
    for (let i = 0; i < parts.length; i++) {
      if (current && current[parts[i]] !== undefined) {
        current = current[parts[i]];
      } else {
        if (debug) console.warn(`⚠️ Token not found: ${match}`);
        return match;
      }
    }

    if (typeof current === "string" || typeof current === "number") {
      if (debug) console.log(`✨ Resolved ${match} to ${current}`);
      return String(current);
    }

    return match;
  });
}

// ============================================================================
// Style Object Processing
// ============================================================================

const unitlessProps = new Set([
  "opacity",
  "zIndex",
  "fontWeight",
  "flex",
  "flexGrow",
  "flexShrink",
  "order",
  "gridColumn",
  "gridRow",
  "animationIterationCount",
  "lineHeight",
]);

/**
 * Process a style object, expanding shorthands and resolving tokens
 */
export function processStyleObject(
  obj: Record<string, any>,
  tokenStore: Record<string, any> | DesignTokens = {},
  options: { useTokens?: boolean; debug?: boolean } = {},
): string {
  const { useTokens = true, debug = false } = options;
  let css = "";
  const expandedProps: Record<string, any> = {};

  if (debug) {
    console.log("[ChainCSS] Processing style object:", obj);
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("_")) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value))
      continue;

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

  for (const [key, value] of Object.entries(expandedProps)) {
    let finalValue = value;
    if (useTokens && typeof value === "string") {
      finalValue = resolveToken(value, tokenStore, key, debug);
    }

    if (finalValue === undefined || finalValue === null) continue;

    const kebabKey = kebabCase(key);
    const unit =
      typeof value === "number" && !unitlessProps.has(key) ? "px" : "";

    css += `  ${kebabKey}: ${finalValue}${unit};\n`;
  }

  return css;
}

// ============================================================================
// Style Extraction
// ============================================================================

const structuralKeys = new Set([
  "selectors",
  "hover",
  "atRules",
  "nestedRules",
]);

/**
 * Extract CSS string from style definition
 */
export function extractCSS(styleDef: Record<string, any>): string {
  let css = "";
  const selectors = styleDef.selectors || [""];

  for (const [key, value] of Object.entries(styleDef)) {
    if (structuralKeys.has(key)) continue;
    css += `${kebabCase(key)}: ${value};`;
  }

  if (!css) return "";
  const safeSelectors = Array.isArray(selectors) ? selectors : [selectors];
  return `${safeSelectors.join(", ")} { ${css} }`;
}

/**
 * Extract hover CSS from style definition
 */
export function extractHoverCSS(styleDef: Record<string, any>): string {
  const hover = styleDef.hover;
  if (!hover || typeof hover !== "object") return "";

  const selectors = styleDef.selectors || [""];
  let hoverCSS = "";

  for (const [key, value] of Object.entries(hover)) {
    hoverCSS += `${kebabCase(key)}: ${value};`;
  }

  if (!hoverCSS) return "";
  const safeSelectors = Array.isArray(selectors) ? selectors : [selectors];
  return `${safeSelectors.join(", ")}:hover { ${hoverCSS} }`;
}

// ============================================================================
// Style Merging
// ============================================================================

export function mergeStyles(
  ...styles: Record<string, any>[]
): Record<string, any> {
  const result: Record<string, any> = {};

  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    if (!style) continue;

    for (const [key, value] of Object.entries(style)) {
      if (key === "hover" && result.hover && typeof value === "object") {
        result.hover = { ...result.hover, ...value };
      } else if (key === "selectors" && result.selectors) {
        const newSelectors = Array.isArray(value) ? value : [value];
        const existingSelectors = Array.isArray(result.selectors)
          ? result.selectors
          : [result.selectors];

        // Inline duplication removal strategy without full array reallocation overhead
        const combined = existingSelectors.concat(newSelectors);
        result.selectors = Array.from(
          new Set([...existingSelectors, ...newSelectors]),
        );
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

// ============================================================================
// Validation Utilities (Patched for 4/8 Hex and Modern Spec compatibility)
// ============================================================================

export function isValidCSSLength(value: any): boolean {
  if (typeof value === "number") return true;
  if (typeof value !== "string") return false;
  return /^[+-]?\d*\.?\d+(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc)?$/.test(
    value,
  );
}

const namedColors = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "cyan",
  "magenta",
  "gray",
  "grey",
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "blanchedalmond",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
]);

export function isValidCSSColor(value: any): boolean {
  if (typeof value !== "string") return false;
  const lower = value.toLowerCase().trim();

  // Supports 3, 4, 6, and 8 digit hex properties perfectly
  if (/^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/.test(lower)) return true;
  if (/^(rgba?|hsla?)\(.*\)$/.test(lower)) return true;
  if (namedColors.has(lower)) return true;

  return false;
}

// ============================================================================
// Selector & Value Extraction Utilities
// ============================================================================

export function escapeSelector(selector: string): string {
  if (!selector) return "";
  return selector.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

export function cleanClassName(className: string): string {
  if (!className) return "";
  let cleaned = className.replace(/[^a-zA-Z0-9_-]/g, "-");
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `c-${cleaned}`;
}

export function extractNumericValue(value: string): number {
  const match = value.match(/^[+-]?\d*\.?\d+/);
  return match ? parseFloat(match[0]) : 0;
}

export function extractUnit(value: string): string {
  const match = value.match(/[a-z%]+$/);
  return match ? match[0] : "";
}

export function addUnit(value: number | string, unit: string = "px"): string {
  if (typeof value === "number") return `${value}${unit}`;
  if (typeof value === "string") {
    return /^\d+(?:\.\d+)?$/.test(value) ? `${value}${unit}` : value;
  }
  return String(value);
}

// ============================================================================
// Class Name Utilities
// ============================================================================

export function sortClassNames(classNames: string[]): string[] {
  return [...classNames].sort((a, b) => {
    const aAtom = a.startsWith("a-");
    const bAtom = b.startsWith("a-");
    if (aAtom !== bAtom) return aAtom ? -1 : 1;

    const aComp = a.startsWith("c-");
    const bComp = b.startsWith("c-");
    if (aComp !== bComp) return aComp ? -1 : 1;

    return a.localeCompare(b);
  });
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  let out = "";
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i];
    if (c) out += (out ? " " : "") + c;
  }
  return out;
}

// ============================================================================
// Debug Utilities
// ============================================================================

let debugMode = false;
export function enableDebug(enable: boolean = true): void {
  debugMode = enable;
}
export function isDebugEnabled(): boolean {
  return debugMode;
}
export function debugLog(message: string, ...args: any[]): void {
  if (debugMode) console.log(`[ChainCSS Debug] ${message}`, ...args);
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
  debugLog,
};
