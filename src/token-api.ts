/**
 * ChainCSS Token API
 * 
 * A clean, platform-friendly interface for token compilation.
 * Designed for integration with external platforms (DSaaS, CLIs, dashboards).
 */

import { TokenEntanglementEngine, createEntanglementEngine } from './compiler/tokens/entanglement.js';
import type { Relationship } from './compiler/tokens/entanglement.js';

// ============================================================================
// Types
// ============================================================================

export interface TokenCompileOptions {
  /** Target formats to generate */
  targets?: Array<'css' | 'scss' | 'tailwind' | 'bootstrap' | 'mui' | 'json'>;
  /** Token relationships (derived, harmony, contrast) */
  relationships?: Relationship[];
  /** Whether to auto-fix accessibility issues */
  autoFix?: boolean;
  /** Theme mode */
  theme?: 'light' | 'dark' | 'high-contrast';
}

export interface TokenCompileResult {
  /** Compiled tokens (with derived colors resolved) */
  tokens: Record<string, any>;
  /** Generated outputs per target */
  outputs: Record<string, { filename: string; content: string }>;
  /** Changes made during compilation */
  changes: Array<{ path: string; from: string; to: string; reason: string }>;
  /** Accessibility violations found */
  violations: Array<{ message: string; ratio: number; target: number }>;
  /** Whether compilation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Simple Token Derivation API
// ============================================================================

/**
 * Derive a color from another color.
 * 
 * @example
 * ```ts
 * const lightPrimary = derive('#6366f1', 'lighten', 0.1);
 * // → '#7375f2'
 * ```
 */
export function derive(source: string, method: string, amount: number): string {
  return deriveColor(source, method, amount);
}

/**
 * Get the complementary color (180° on color wheel).
 * 
 * @example
 * ```ts
 * const accent = complementary('#6366f1');
 * // → '#9c990e'
 * ```
 */
export function complementary(source: string): string {
  return complementaryColor(source);
}

/**
 * Calculate contrast ratio between two colors (WCAG).
 * 
 * @example
 * ```ts
 * const ratio = contrast('#6366f1', '#ffffff');
 * // → 4.5 (or similar)
 * ```
 */
export function contrast(foreground: string, background: string): number {
  return contrastRatio(foreground, background);
}

// ============================================================================
// Main Compilation API
// ============================================================================

/**
 * Compile design tokens into multiple output formats.
 * This is the main entry point for platform integration.
 * 
 * @example
 * ```ts
 * import { compileTokens } from 'chaincss/token-api';
 * 
 * const tokens = {
 *   colors: {
 *     primary: {
 *       500: '#6366f1',
 *       400: derive('#6366f1', 'lighten', 0.1),
 *       600: derive('#6366f1', 'darken', 0.2),
 *     },
 *     accent: complementary('#6366f1'),
 *   },
 *   spacing: { sm: '8px', md: '16px' },
 * };
 * 
 * const result = compileTokens(tokens, {
 *   targets: ['css', 'scss', 'tailwind'],
 *   autoFix: true,
 * });
 * 
 * console.log(result.outputs.css.content);
 * ```
 */
export function compileTokens(
  tokens: Record<string, any>,
  options: TokenCompileOptions = {},
): TokenCompileResult {
  try {
    const targets = options.targets || ['css', 'json'];
    const relationships = options.relationships || [];
    const autoFix = options.autoFix !== false;
    
    // 1. Resolve derived colors (flatten derive() function results)
    const resolvedTokens = resolveTokenValues(tokens);
    
    // 2. Run token entanglement for relationships
    let finalTokens = resolvedTokens;
    const changes: TokenCompileResult['changes'] = [];
    const violations: TokenCompileResult['violations'] = [];
    
    if (relationships.length > 0 || autoFix) {
      const engine = createEntanglementEngine({ relationships });
      const report = engine.fixAll(finalTokens);
      finalTokens = report.tokens;
      
      for (const change of report.changes) {
        changes.push({
          path: change.path,
          from: change.from,
          to: change.to,
          reason: change.reason,
        });
      }
      
      for (const violation of report.violations) {
        violations.push({
          message: violation.message,
          ratio: violation.ratio,
          target: violation.target,
        });
      }
    }
    
    // 3. Generate outputs
    const outputs: TokenCompileResult['outputs'] = {};
    
    for (const target of targets) {
      switch (target) {
        case 'css':
          outputs.css = { filename: 'tokens.css', content: emitCSS(finalTokens) };
          break;
        case 'scss':
          outputs.scss = { filename: '_tokens.scss', content: emitSCSS(finalTokens) };
          break;
        case 'tailwind':
          outputs.tailwind = { filename: 'tailwind.config.js', content: emitTailwind(finalTokens) };
          break;
        case 'bootstrap':
          outputs.bootstrap = { filename: '_bootstrap-theme.scss', content: emitBootstrap(finalTokens) };
          break;
        case 'mui':
          outputs.mui = { filename: 'mui-theme.ts', content: emitMUI(finalTokens) };
          break;
        case 'json':
          outputs.json = { filename: 'tokens.json', content: JSON.stringify(finalTokens, null, 2) };
          break;
      }
    }
    
    return {
      tokens: finalTokens,
      outputs,
      changes,
      violations,
      success: true,
    };
  } catch (error: any) {
    return {
      tokens,
      outputs: {},
      changes: [],
      violations: [],
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// Token Resolution (flatten derive() function results)
// ============================================================================

function resolveTokenValues(tokens: Record<string, any>): Record<string, any> {
  // Keep the original structure - don't flatten derive/harmony objects
  // The derive/harmony metadata is needed for relationship processing
  return JSON.parse(JSON.stringify(tokens));
}

// ============================================================================
// Color Utilities
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

function deriveColor(hex: string, method: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  
  switch (method) {
    case 'lighten':
      return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
    case 'darken':
      return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
    case 'mix-white':
      return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
    case 'mix-black':
      return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
    default:
      return hex;
  }
}

function complementaryColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(255 - r, 255 - g, 255 - b);
}

function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const rsRGB = r / 255 <= 0.03928 ? r / 255 / 12.92 : Math.pow((r / 255 + 0.055) / 1.055, 2.4);
  const gsRGB = g / 255 <= 0.03928 ? g / 255 / 12.92 : Math.pow((g / 255 + 0.055) / 1.055, 2.4);
  const bsRGB = b / 255 <= 0.03928 ? b / 255 / 12.92 : Math.pow((b / 255 + 0.055) / 1.055, 2.4);
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

function contrastRatio(fg: string, bg: string): number {
  const fgLum = getLuminance(fg);
  const bgLum = getLuminance(bg);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

// ============================================================================
// Emitters (simple, flat token output)
// ============================================================================

function flattenTokens(obj: any, prefix = '', result: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}-${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenTokens(value, path, result);
    } else if (typeof value === 'string' || typeof value === 'number') {
      result[path] = String(value);
    }
  }
  return result;
}

function emitCSS(tokens: Record<string, any>): string {
  const flat = flattenTokens(tokens);
  const lines = [':root {'];
  for (const [name, value] of Object.entries(flat)) {
    lines.push(`  --${name}: ${value};`);
  }
  lines.push('}');
  return lines.join('\n');
}

function emitSCSS(tokens: Record<string, any>): string {
  const flat = flattenTokens(tokens);
  const lines: string[] = [];
  for (const [name, value] of Object.entries(flat)) {
    lines.push(`$${name}: ${value};`);
  }
  return lines.join('\n');
}

function emitTailwind(tokens: Record<string, any>): string {
  const config = {
    theme: {
      extend: {
        colors: tokens.colors || {},
        spacing: tokens.spacing || {},
      },
    },
  };
  return `/** @type {import('tailwindcss').Config} */\nmodule.exports = ${JSON.stringify(config, null, 2)};\n`;
}

function emitBootstrap(tokens: Record<string, any>): string {
  const lines: string[] = [];
  const colors = tokens.colors || {};
  
  if (colors.primary) {
    for (const [shade, val] of Object.entries(colors.primary)) {
      if (typeof val === 'string') lines.push(`$primary-${shade}: ${val} !default;`);
    }
  }
  
  return lines.join('\n');
}

function emitMUI(tokens: Record<string, any>): string {
  const colors = tokens.colors || {};
  const palette: Record<string, any> = {};
  
  if (colors.primary) {
    palette.primary = {
      main: colors.primary[500] || Object.values(colors.primary)[0],
      light: colors.primary[400],
      dark: colors.primary[600],
    };
  }
  
  return `import { createTheme } from '@mui/material/styles';\n\nexport const theme = createTheme({\n  palette: ${JSON.stringify(palette, null, 4)},\n});\n`;
}

// Re-export for convenience
export { TokenEntanglementEngine, createEntanglementEngine };
export type { Relationship };
