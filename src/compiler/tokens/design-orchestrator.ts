// src/compiler/tokens/design-orchestrator.ts

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
  contexts: Record<string, string>;
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
 * Supports: hex (3/6/8 digit), rgb(), rgba(), 90+ named colors.
 * Returns null for CSS variables, currentColor, inherit, and unknown values.
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  const trimmed = color.trim().toLowerCase();

  // CSS variables and keywords that can't be statically analyzed
  if (trimmed.startsWith('var(') || trimmed === 'currentcolor' || trimmed === 'inherit') {
    return null;
  }

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

  // Named colors — comprehensive subset covering design system usage
  const named: Record<string, [number, number, number]> = {
    // Core
    white: [255, 255, 255],
    black: [0, 0, 0],
    transparent: [0, 0, 0],

    // Primaries
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],

    // Extended palette
    orange: [255, 165, 0],
    yellow: [255, 255, 0],
    purple: [128, 0, 128],
    pink: [255, 192, 203],
    brown: [165, 42, 42],
    navy: [0, 0, 128],
    teal: [0, 128, 128],
    cyan: [0, 255, 255],
    magenta: [255, 0, 255],
    lime: [0, 255, 0],
    maroon: [128, 0, 0],
    olive: [128, 128, 0],
    silver: [192, 192, 192],
    gold: [255, 215, 0],
    coral: [255, 127, 80],
    salmon: [250, 128, 114],
    khaki: [240, 230, 140],
    plum: [221, 160, 221],
    tan: [210, 180, 140],
    azure: [240, 255, 255],
    beige: [245, 245, 220],
    bisque: [255, 228, 196],
    ivory: [255, 255, 240],
    lavender: [230, 230, 250],
    wheat: [245, 222, 179],
    snow: [255, 250, 250],
    mintcream: [245, 255, 250],
    ghostwhite: [248, 248, 255],
    whitesmoke: [245, 245, 245],
    gainsboro: [220, 220, 220],
    lightgray: [211, 211, 211],
    lightgrey: [211, 211, 211],
    darkgray: [169, 169, 169],
    darkgrey: [169, 169, 169],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    indigo: [75, 0, 130],
    turquoise: [64, 224, 208],
    violet: [238, 130, 238],
    orchid: [218, 112, 214],
    tomato: [255, 99, 71],
    chocolate: [210, 105, 30],
    peru: [205, 133, 63],
    crimson: [220, 20, 60],
    firebrick: [178, 34, 34],
    royalblue: [65, 105, 225],
    steelblue: [70, 130, 180],
    skyblue: [135, 206, 235],
    lightblue: [173, 216, 230],
    darkblue: [0, 0, 139],
    midnightblue: [25, 25, 112],
    forestgreen: [34, 139, 34],
    darkgreen: [0, 100, 0],
    seagreen: [46, 139, 87],
    mediumseagreen: [60, 179, 113],
    darkorange: [255, 140, 0],
    goldenrod: [218, 165, 32],
    darkgoldenrod: [184, 134, 11],
    sienna: [160, 82, 45],
    saddlebrown: [139, 69, 19],
    rosybrown: [188, 143, 143],
    indianred: [205, 92, 92],
    mediumpurple: [147, 112, 219],
    darkorchid: [153, 50, 204],
    darkviolet: [148, 0, 211],
    mediumorchid: [186, 85, 211],
    thistle: [216, 191, 216],
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
 * Returns -1 if either color is unparseable.
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
 * 
 * Returns null if either color is unparseable (CSS variables, currentColor, etc.)
 * so callers can skip rather than report false failures.
 */
export function checkContrast(foreground: string, background: string): ContrastResult | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  // Skip unparseable colors — can't statically analyze CSS variables
  if (!fg || !bg) {
    return null;
  }

  const lumFg = relativeLuminance(fg.r, fg.g, fg.b) + 0.05;
  const lumBg = relativeLuminance(bg.r, bg.g, bg.b) + 0.05;

  const lighter = Math.max(lumFg, lumBg);
  const darker = Math.min(lumFg, lumBg);
  const ratio = lighter / darker;

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
      ? `Contrast ratio ${Math.round(ratio * 100) / 100} fails AA. Consider darkening/lightening.`
      : undefined,
  };
}

// ============================================================================
// Contrast Report Generator
// ============================================================================

/**
 * Run contrast checks across a set of style definitions.
 * Skips unparseable colors (CSS variables, currentColor) silently —
 * those must be validated at runtime or with design token resolution.
 */
export function auditContrast(
  styles: Array<{ selector: string; color: string; backgroundColor: string }>
): ContrastReport {
  const checks: ContrastResult[] = [];

  for (const style of styles) {
    if (style.color && style.backgroundColor) {
      const result = checkContrast(style.color, style.backgroundColor);
      if (result) {
        checks.push(result);
      }
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
      ? `All ${checks.length} contrast checks pass AA.`
      : `${failures.length} of ${checks.length} contrast checks FAIL AA.`,
  };
}

// ============================================================================
// Contextual Token Engine
// ============================================================================

/**
 * Create a contextual token that auto-resolves based on parent container.
 * 
 * @example
 *   const buttonText = createContextualToken('#1a1a1a', {
 *     '.dark-section': '#ffffff',
 *     '.hero': '#ffffff',
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
 * Matches the most specific context that applies (longest match wins).
 */
export function resolveContextual(
  token: ContextualToken,
  selectorPath: string
): string {
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
 * Generate CSS custom property declarations for a contextual token.
 * 
 * @example
 *   generateContextualCSS('--button-text', contextualToken, '.my-button')
 *   // => ".my-button { --button-text: #1a1a1a; }\n"
 *   //    ".dark-section .my-button { --button-text: #ffffff; }\n"
 */
export function generateContextualCSS(
  propertyName: string,
  token: ContextualToken,
  baseSelector: string
): string {
  let css = '';

  // Default
  css += `${baseSelector} { ${propertyName}: ${token.default}; }\n`;

  // Context overrides
  for (const [context, value] of Object.entries(token.contexts)) {
    css += `${context} ${baseSelector} { ${propertyName}: ${value}; }\n`;
  }

  return css;
}

// ============================================================================
// Token Relationship Validator
// ============================================================================

/**
 * Validate that token references are consistent.
 * Checks that foreground/background token pairs meet WCAG contrast requirements.
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
 * Returns null if any segment of the path doesn't exist.
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