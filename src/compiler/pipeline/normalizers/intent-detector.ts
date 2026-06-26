// src/compiler/intent-engine.ts

import type { CorrectionResult, HealMode, HealResult, IntentContext } from '../../../core/types.js';
import { detectIfPatterns, emitCSSIf } from '../lowering/css-if-lowering.js';
export type { CorrectionResult, HealMode, HealResult, IntentContext };

interface ValueCorrection { wrong: string; correct: string; confidence: number; }

const SEMANTIC_INTENTS: Array<{pattern: RegExp; handler: Function; description: string}> = [
  { pattern: /^flexbox$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'display', corrected: 'flex', defaults: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, confidence: 0.95, intent: 'flexbox-centering', explanation: '"flexbox" mapped to display: flex with centering defaults.' }), description: 'flexbox -> flex + centering' },
  { pattern: /^(absolutely|abs)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'position', corrected: 'absolute', defaults: { position: 'absolute' }, confidence: 0.9, intent: 'absolute-position', explanation: '"abs/absolutely" -> position: absolute' }), description: 'abs -> absolute' },
  { pattern: /^(rel|relatively)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'position', corrected: 'relative', defaults: { position: 'relative' }, confidence: 0.9, intent: 'relative-position', explanation: '"rel/relatively" -> position: relative' }), description: 'rel -> relative' },
  { pattern: /^(hidden|invisible)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'visibility', corrected: v.toLowerCase()==='invisible'?'hidden':v.toLowerCase(), defaults: { visibility: 'hidden' }, confidence: 0.9, intent: 'visibility-toggle', explanation: '"' + v + '" -> visibility: hidden' }), description: 'invisible -> hidden' },
  { pattern: /^(full|fullscreen|full-screen)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'size', corrected: '100%', defaults: { width: '100%', height: '100%' }, confidence: 0.85, intent: 'full-size', explanation: '"full/fullscreen" -> width/height: 100%' }), description: 'full -> 100%' },
  { pattern: /^(rounded|round)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'border-radius', corrected: '9999px', defaults: { borderRadius: '9999px' }, confidence: 0.8, intent: 'rounded-pill', explanation: '"rounded" -> border-radius: 9999px (pill)' }), description: 'rounded -> pill' },
];


// ============================================================================
// Layout Macros — High-level semantic intents
// These compile complex multi-property layouts from simple intent names
// ============================================================================

interface LayoutMacro {
  name: string;
  description: string;
  properties: Record<string, string | number>;
  defaults?: Record<string, string | number>;
  mediaQueries?: Record<string, Record<string, any>>;
}

const LAYOUT_MACROS: Record<string, LayoutMacro> = {
  stickyHeader: {
    name: 'stickyHeader',
    description: 'Sticky header with scroll shadow and entrance animation',
    properties: {
      position: 'sticky',
      top: '0',
      zIndex: '50',
      backgroundColor: 'var(--header-bg, white)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid transparent',
    },
    defaults: {
      '--header-bg': 'white',
      '--header-shadow': '0 4px 12px rgba(0,0,0,0.1)',
    },
    mediaQueries: {
      '(max-width: 768px)': {
        padding: '12px 16px',
      },
      '(min-width: 769px)': {
        padding: '16px 32px',
      },
    },
  },

  card: {
    name: 'card',
    description: 'Standard card container with hover lift effect',
    properties: {
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '12px',
      backgroundColor: 'var(--card-bg, white)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      overflow: 'hidden',
    },
    defaults: {
      '--card-bg': 'white',
      '--card-hover-shadow': '0 10px 30px rgba(0,0,0,0.15)',
    },
    mediaQueries: {
      '(hover: hover)': {
        '&:hover': {
          boxShadow: 'var(--card-hover-shadow)',
          transform: 'translateY(-2px)',
        },
      },
    },
  },

  hero: {
    name: 'hero',
    description: 'Full-width hero section with centered content',
    properties: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      minHeight: '60vh',
      padding: '48px 24px',
      textAlign: 'center',
    },
    defaults: {},
    mediaQueries: {
      '(max-width: 768px)': {
        minHeight: '40vh',
        padding: '32px 16px',
      },
    },
  },

  container: {
    name: 'container',
    description: 'Responsive centered container with max-width',
    properties: {
      width: '100%',
      maxWidth: '1200px',
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
    defaults: {},
    mediaQueries: {
      '(min-width: 768px)': {
        paddingLeft: '24px',
        paddingRight: '24px',
      },
      '(min-width: 1024px)': {
        paddingLeft: '32px',
        paddingRight: '32px',
      },
    },
  },

  center: {
    name: 'center',
    description: 'Absolute centering using flexbox',
    properties: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    defaults: {},
  },

  gridList: {
    name: 'gridList',
    description: 'Responsive grid list with auto-fit columns',
    properties: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '24px',
    },
    defaults: {},
    mediaQueries: {
      '(max-width: 640px)': {
        gridTemplateColumns: '1fr',
        gap: '16px',
      },
    },
  },

  sidebar: {
    name: 'sidebar',
    description: 'Two-column layout: sidebar + main content',
    properties: {
      display: 'grid',
      gridTemplateColumns: '280px 1fr',
      gap: '32px',
      minHeight: '100vh',
    },
    defaults: {},
    mediaQueries: {
      '(max-width: 1024px)': {
        gridTemplateColumns: '1fr',
        gap: '24px',
      },
    },
  },

  pill: {
    name: 'pill',
    description: 'Pill-shaped element (fully rounded)',
    properties: {
      borderRadius: '9999px',
      padding: '8px 20px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    defaults: {},
  },


  autoContrast: {
    name: 'autoContrast',
    description: 'Automatically sets text color (black/white) for WCAG AA contrast against the background',
    properties: {},
    defaults: {},
  },
  glass: {
    name: 'glass',
    description: 'Frosted glass morphism effect',
    properties: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '16px',
    },
    defaults: {},
  },

  truncate: {
    name: 'truncate',
    description: 'Single-line text truncation with ellipsis',
    properties: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    defaults: {},
  },

  srOnly: {
    name: 'srOnly',
    description: 'Screen-reader only (visually hidden but accessible)',
    properties: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: '0',
    },
    defaults: {},
  },
};

// ============================================================================
// Layout Macro Resolver
// ============================================================================

function resolveLayoutMacro(name: string): LayoutMacro | null {
  return LAYOUT_MACROS[name] || null;
}

function expandLayoutMacro(name: string): Record<string, any> | null {
  const macro = resolveLayoutMacro(name);
  if (!macro) return null;

  // Start with properties
  const result: Record<string, any> = { ...macro.properties };
  
  // Merge defaults (CSS custom properties) into the result
  if (macro.defaults) {
    Object.assign(result, macro.defaults);
  }

  // Apply media queries as nested atRules
  if (macro.mediaQueries) {
    result.atRules = result.atRules || [];
    for (const [query, props] of Object.entries(macro.mediaQueries)) {
      result.atRules.push({
        type: 'media',
        query,
        styles: props,
      });
    }
  }

  return result;
}

function getAvailableMacros(): string[] {
  return Object.keys(LAYOUT_MACROS);
}

function getMacroDescription(name: string): string | null {
  const macro = resolveLayoutMacro(name);
  return macro?.description || null;
}

const VALUE_CORRECTIONS: Record<string, ValueCorrection[]> = {
  'display': [{wrong:'flexbox',correct:'flex',confidence:0.95},{wrong:'inline-flexbox',correct:'inline-flex',confidence:0.95}],
  'position': [{wrong:'abs',correct:'absolute',confidence:0.9},{wrong:'rel',correct:'relative',confidence:0.9}],
  'text-align': [{wrong:'centered',correct:'center',confidence:0.85},{wrong:'justified',correct:'justify',confidence:0.85}],
  'overflow': [{wrong:'scrollable',correct:'auto',confidence:0.8}],
  'cursor': [{wrong:'hand',correct:'pointer',confidence:0.9}],
  'user-select': [{wrong:'unselectable',correct:'none',confidence:0.85}],
};

const KNOWN_PROPERTIES = ['display','position','color','background','width','height','font-size','text-align','cursor','opacity','z-index','overflow','visibility','flex','flex-direction','justify-content','align-items','gap','grid','transition','transform','animation','box-shadow','pointer-events','user-select','line-height'];

function levenshtein(a: string, b: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+(a[j-1]===b[i-1]?0:1));
  return m[b.length][a.length];
}

function findClosestProperty(prop: string): string | null {
  const lp = prop.toLowerCase();
  let best: string | null = null, bestDist = Infinity;
  for (const k of KNOWN_PROPERTIES) { const d = levenshtein(lp, k); if (d < bestDist && d <= 3) { bestDist = d; best = k; } }
  return best;
}

function detectIntent(value: string, ctx: IntentContext = {}): CorrectionResult | null {
  const lv = value.toLowerCase();
  for (const rule of SEMANTIC_INTENTS) {
    if (rule.pattern.test(lv)) {
      const r = rule.handler(value, ctx);
      if (r) return r;
    }
  }
  return null;
}

export const intent = {
  correct(property: string, value: string, context?: IntentContext): CorrectionResult | null {
    const ctx = { property, value, ...context };
    const si = detectIntent(value, ctx);
    if (si) return si;
    if (VALUE_CORRECTIONS[property]) {
      const c = VALUE_CORRECTIONS[property].find(c => c.wrong === value.toLowerCase());
      if (c) return { original: value, property, corrected: c.correct, defaults: { [property]: c.correct }, confidence: c.confidence, intent: 'value-correction', explanation: `"${value}" is not valid for ${property}. Did you mean "${c.correct}"?` };
    }
    const pc = findClosestProperty(property);
    if (pc && pc !== property.toLowerCase()) {
      const d = levenshtein(property.toLowerCase(), pc);
      return { original: property, property, corrected: pc, defaults: {}, confidence: Math.max(0, 1 - d / Math.max(property.length, pc.length)), intent: 'property-correction', explanation: `Unknown property "${property}". Did you mean "${pc}"?` };
    }
    return null;
  },
  heal(styles: Record<string, any>, mode: HealMode = 'smart', context?: IntentContext): HealResult {
    const corrections: CorrectionResult[] = [], warnings: string[] = [], fixed: Record<string, any> = {};
    for (const [prop, value] of Object.entries(styles)) {
      if (prop.startsWith('_') || prop === 'selectors') { fixed[prop] = value; continue; }
      if (typeof value === 'object' && value !== null && prop === 'hover') {
        const hr = this.heal(value as Record<string, any>, mode, { ...context, property: prop });
        fixed[prop] = hr.fixed; corrections.push(...hr.corrections); warnings.push(...hr.warnings); continue;
      }
      if (typeof value !== 'string' && typeof value !== 'number') { fixed[prop] = value; continue; }
      const sv = String(value), corr = this.correct(prop, sv, { ...context, property: prop, value: sv });
      if (corr) {
        corrections.push(corr);
        if (mode === 'strict') { warnings.push('[strict] ' + corr.explanation); fixed[prop] = sv; }
        else if (mode === 'dev') { fixed[prop] = corr.corrected; Object.assign(fixed, corr.defaults); }
        else { warnings.push('[auto-fix] ' + corr.explanation); fixed[prop] = corr.corrected; Object.assign(fixed, corr.defaults); }
      } else { fixed[prop] = value; }
    }
    return { fixed, corrections, warnings, mode };
  },
  getIntent(value: string, ctx?: IntentContext): string | null { const r = detectIntent(value, ctx); return r?.intent || null; },
  validate(property: string, value: string): { valid: boolean; suggestion?: string } {
    if (VALUE_CORRECTIONS[property]) {
      const c = VALUE_CORRECTIONS[property].find(c => c.wrong === value.toLowerCase());
      if (c) return c.confidence < 1 ? { valid: false, suggestion: c.correct } : { valid: true };
    }
    if (!KNOWN_PROPERTIES.includes(property.toLowerCase())) {
      const s = findClosestProperty(property);
      return s ? { valid: false, suggestion: s } : { valid: false };
    }
    return { valid: true };
  },
  getCorrections(property: string): ValueCorrection[] { return VALUE_CORRECTIONS[property] || []; },
  explain(correction: CorrectionResult): string { return correction.explanation; },
  cssIf: { detect: detectIfPatterns, emit: emitCSSIf },
  getIntents() { return SEMANTIC_INTENTS.map(r => ({ pattern: r.pattern.toString(), description: r.description })); },
  getKnownProperties(): string[] { return [...KNOWN_PROPERTIES]; },

  // Layout Macros
  macro(name: string): Record<string, any> | null { return expandLayoutMacro(name); },
  getMacros(): string[] { return getAvailableMacros(); },
  /**
   * Auto-set text color for accessible contrast against the background.
   * Uses WCAG AA contrast ratio to pick black or white.
   */
  autoContrast(bgColor: string): string {
    // Parse the background color and determine luminance
    let r = 128, g = 128, b = 128;
    const hex = bgColor.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    // Relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  },
  getMacroDescription(name: string): string | null { return getMacroDescription(name); },
  hasMacro(name: string): boolean { return name in LAYOUT_MACROS; },
  /**
   * Apply a layout macro to an existing styles object.
   * Merges macro properties with user overrides.
   */
  applyMacro(name: string, overrides?: Record<string, any>): Record<string, any> | null {
    const macro = expandLayoutMacro(name);
    if (!macro) return null;
    if (!overrides) return macro;
    // Deep merge: user overrides win
    const merged = { ...macro };
    for (const [key, value] of Object.entries(overrides)) {
      if (key === 'atRules' && Array.isArray(value) && Array.isArray(merged.atRules)) {
        merged.atRules = [...merged.atRules, ...value];
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = { ...(merged[key] || {}), ...value };
      } else {
        merged[key] = value;
      }
    }
    return merged;
  },
};

export const correct = intent.correct.bind(intent);
export const heal = intent.heal.bind(intent);
export const validate = intent.validate.bind(intent);
export const getIntent = intent.getIntent.bind(intent);
export const macro = intent.macro.bind(intent);
export const applyMacro = intent.applyMacro.bind(intent);
export const getMacros = intent.getMacros.bind(intent);
export const hasMacro = intent.hasMacro.bind(intent);
export default intent;
