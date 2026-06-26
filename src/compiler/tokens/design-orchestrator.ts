// src/compiler/design-orchestrator.ts
/**
 * Design System Orchestrator
 * 
 * 1. WCAG Contrast Ratio Checker — validates text/background combos at build time
 * 2. Contextual Tokens — tokens that auto-flip based on container context
 * 3. Token Relationship Validator — ensures design tokens are consistent
 */

// ============================================================================
// Types
// ============================================================================

export interface ContrastResult {
  foreground: string;
  background: string;
  ratio: number;
  passes: { AA: boolean; AALarge: boolean; AAA: boolean; AAALarge: boolean };
  suggestion?: string;
}

export interface ContrastReport {
  checks: ContrastResult[];
  failures: ContrastResult[];
  warnings: ContrastResult[];
  passCount: number;
  failCount: number;
  summary: string;
}

export interface ContextualToken {
  name: string;
  default: string;
  contexts: Record<string, string>;  // e.g., { 'dark-section': 'white', 'light-section': 'black' }
}

export interface TokenContext {
  name: string;
  parentSelector?: string;
  tokens: Record<string, any>;
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Parse CSS color to RGBA components.
 * Supports: hex, rgb(), rgba(), named colors
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  const trimmed = color.trim().toLowerCase();

  // hex
  const hexMatch = trimmed.match(/^#([a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  // rgb/rgba
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // Named colors (common subset)
  const named: Record<string, [number, number, number]> = {
    white: [255, 255, 255], black: [0, 0, 0],
    red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255],
    gray: [128, 128, 128], grey: [128, 128, 128],
    transparent: [0, 0, 0],
  };
  if (named[trimmed]) {
    const [r, g, b] = named[trimmed];
    return { r, g, b, a: trimmed === 'transparent' ? 0 : 1 };
  }

  return null;
}

/**
 * Calculate relative luminance per WCAG 2.1.
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const rsrgb = r / 255;
  const gsrgb = g / 255;
  const bsrgb = b / 255;

  const rLin = rsrgb <= 0.04045 ? rsrgb / 12.92 : Math.pow((rsrgb + 0.055) / 1.055, 2.4);
  const gLin = gsrgb <= 0.04045 ? gsrgb / 12.92 : Math.pow((gsrgb + 0.055) / 1.055, 2.4);
  const bLin = bsrgb <= 0.04045 ? bsrgb / 12.92 : Math.pow((bsrgb + 0.055) / 1.055, 2.4);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculate WCAG contrast ratio between two colors.
 * Returns value between 1 (no contrast) and 21 (max contrast).
 */
export function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return -1;

  const lumFg = relativeLuminance(fg.r, fg.g, fg.b) + 0.05;
  const lumBg = relativeLuminance(bg.r, bg.g, bg.b) + 0.05;

  const lighter = Math.max(lumFg, lumBg);
  const darker = Math.min(lumFg, lumBg);

  return lighter / darker;
}

/**
 * Check WCAG compliance levels.
 * AA: 4.5:1 normal, 3:1 large text
 * AAA: 7:1 normal, 4.5:1 large text
 */
export function checkContrast(foreground: string, background: string): ContrastResult {
  const ratio = contrastRatio(foreground, background);

  return {
    foreground,
    background,
    ratio: Math.round(ratio * 100) / 100,
    passes: {
      AA: ratio >= 4.5,
      AALarge: ratio >= 3,
      AAA: ratio >= 7,
      AAALarge: ratio >= 4.5,
    },
    suggestion: ratio < 4.5
      ? `Contrast ratio ${Math.round(ratio * 100) / 100} fails AA. Need ${Math.round((4.5 - ratio) * 100) / 100} more. Consider darkening/lightening.`
      : undefined,
  };
}

// ============================================================================
// Contrast Report Generator
// ============================================================================

/**
 * Run contrast checks across a set of style definitions.
 */
export function auditContrast(
  styles: Array<{ selector: string; color: string; backgroundColor: string }>
): ContrastReport {
  const checks: ContrastResult[] = [];

  for (const style of styles) {
    if (style.color && style.backgroundColor) {
      checks.push(checkContrast(style.color, style.backgroundColor));
    }
  }

  const failures = checks.filter(c => !c.passes.AA);
  const warnings = checks.filter(c => c.passes.AA && !c.passes.AAA);

  return {
    checks,
    failures,
    warnings,
    passCount: checks.length - failures.length,
    failCount: failures.length,
    summary: failures.length === 0
      ? 'All ' + checks.length + ' contrast checks pass AA.'
      : failures.length + ' of ' + checks.length + ' contrast checks FAIL AA.',
  };
}

// ============================================================================
// Contextual Token Engine
// ============================================================================

/**
 * Contextual tokens that auto-resolve based on parent container.
 * 
 * @example
 *   const buttonText = contextualToken({
 *     default: '#1a1a1a',
 *     contexts: {
 *       '.dark-section': '#ffffff',
 *       '.hero': '#ffffff',
 *     },
 *   });
 *   
 *   resolveContextual(buttonText, '.dark-section .my-button')
 *   // => '#ffffff'
 */
export function createContextualToken(
  defaultValue: string,
  contexts: Record<string, string> = {}
): ContextualToken {
  const name = 'ctx-' + Math.random().toString(36).slice(2, 8);
  return { name, default: defaultValue, contexts };
}

/**
 * Resolve a contextual token based on the current selector path.
 * Matches the most specific context that applies.
 */
export function resolveContextual(
  token: ContextualToken,
  selectorPath: string
): string {
  // Find matching contexts — longest match wins (most specific)
  let bestMatch = token.default;
  let bestLength = 0;

  for (const [context, value] of Object.entries(token.contexts)) {
    if (selectorPath.includes(context) && context.length > bestLength) {
      bestMatch = value;
      bestLength = context.length;
    }
  }

  return bestMatch;
}

/**
 * Generate CSS custom property fallback for contextual tokens.
 * 
 * @example
 *   generateContextualCSS('button-text', contextualToken)
 *   // => "
 *   //   .my-button { --button-text: #1a1a1a; }
 *   //   .dark-section .my-button { --button-text: #ffffff; }
 *   // "
 */
export function generateContextualCSS(
  propertyName: string,
  token: ContextualToken,
  baseSelector: string
): string {
  let css = '';

  // Default
  css += baseSelector + ' { ' + propertyName + ': ' + token.default + '; }\n';

  // Context overrides
  for (const [context, value] of Object.entries(token.contexts)) {
    css += context + ' ' + baseSelector + ' { ' + propertyName + ': ' + value + '; }\n';
  }

  return css;
}

// ============================================================================
// Token Relationship Validator
// ============================================================================

/**
 * Validate that token references are consistent.
 * E.g., "primary" should have both foreground and background variants
 * that contrast well with each other.
 */
export function validateTokenRelationships(
  tokens: Record<string, any>,
  pairs: Array<{ foreground: string; background: string; label: string }>
): ContrastReport {
  const styles: Array<{ selector: string; color: string; backgroundColor: string }> = [];

  for (const pair of pairs) {
    const fg = resolveTokenPath(tokens, pair.foreground);
    const bg = resolveTokenPath(tokens, pair.background);
    if (fg && bg) {
      styles.push({ selector: pair.label, color: fg, backgroundColor: bg });
    }
  }

  return auditContrast(styles);
}

/**
 * Resolve a dot-path token reference like "colors.primary.500".
 */
function resolveTokenPath(tokens: Record<string, any>, path: string): string | null {
  const parts = path.split('.');
  let current: any = tokens;
  for (const part of parts) {
    if (current === undefined || current === null) return null;
    current = current[part];
  }
  return typeof current === 'string' ? current : null;
}

// ============================================================================
// Quick API
// ============================================================================

export const orchestrator = {
  contrastRatio,
  checkContrast,
  auditContrast,
  createContextualToken,
  resolveContextual,
  generateContextualCSS,
  validateTokenRelationships,
  parseColor,
};

export default orchestrator;
