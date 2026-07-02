// src/compiler/pipeline/normalizers/intent-data.ts
//
// Pure data for the intent engine: semantic intents, value corrections,
// known properties, and the Levenshtein distance utility.
// Extracted from intent-detector.ts for separation of concerns.

import type { CorrectionResult, IntentContext } from '../../../core/types.js';

// ============================================================================
// Types
// ============================================================================

export interface ValueCorrection {
  wrong: string;
  correct: string;
  confidence: number;
}

// ============================================================================
// Semantic Intents
// ============================================================================

export const SEMANTIC_INTENTS: Array<{
  pattern: RegExp;
  handler: Function;
  description: string;
}> = [
  { pattern: /^flexbox$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'display', corrected: 'flex', defaults: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, confidence: 0.95, intent: 'flexbox-centering', explanation: '"flexbox" mapped to display: flex with centering defaults.' }), description: 'flexbox -> flex + centering' },
  { pattern: /^(absolutely|abs)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'position', corrected: 'absolute', defaults: { position: 'absolute' }, confidence: 0.9, intent: 'absolute-position', explanation: '"abs/absolutely" -> position: absolute' }), description: 'abs -> absolute' },
  { pattern: /^(rel|relatively)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'position', corrected: 'relative', defaults: { position: 'relative' }, confidence: 0.9, intent: 'relative-position', explanation: '"rel/relatively" -> position: relative' }), description: 'rel -> relative' },
  { pattern: /^(hidden|invisible)$/i, handler: (v: string, ctx: any) => {
    // Don't trigger on overflow: hidden — that's a valid overflow value, not a visibility toggle
    if (ctx.property === 'overflow') return null;
    return { original: v, property: ctx.property||'visibility', corrected: v.toLowerCase()==='invisible'?'hidden':v.toLowerCase(), defaults: { visibility: 'hidden' }, confidence: 0.9, intent: 'visibility-toggle', explanation: '"' + v + '" -> visibility: hidden' };
  }, description: 'invisible -> hidden' },
  { pattern: /^(full|fullscreen|full-screen)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'size', corrected: '100%', defaults: { width: '100%', height: '100%' }, confidence: 0.85, intent: 'full-size', explanation: '"full/fullscreen" -> width/height: 100%' }), description: 'full -> 100%' },
  { pattern: /^(rounded|round)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'border-radius', corrected: '9999px', defaults: { borderRadius: '9999px' }, confidence: 0.8, intent: 'rounded-pill', explanation: '"rounded" -> border-radius: 9999px (pill)' }), description: 'rounded -> pill' },
];

// ============================================================================
// Value Corrections — typo fixing
// ============================================================================

export const VALUE_CORRECTIONS: Record<string, ValueCorrection[]> = {
  'display': [{wrong:'flexbox',correct:'flex',confidence:0.95},{wrong:'inline-flexbox',correct:'inline-flex',confidence:0.95}],
  'position': [{wrong:'abs',correct:'absolute',confidence:0.9},{wrong:'rel',correct:'relative',confidence:0.9}],
  'text-align': [{wrong:'centered',correct:'center',confidence:0.85},{wrong:'justified',correct:'justify',confidence:0.85}],
  'overflow': [{wrong:'scrollable',correct:'auto',confidence:0.8}],
  'cursor': [{wrong:'hand',correct:'pointer',confidence:0.9}],
  'user-select': [{wrong:'unselectable',correct:'none',confidence:0.85}],
};

// ============================================================================
// Known CSS Properties (for Levenshtein suggestions)
// ============================================================================

export const KNOWN_PROPERTIES = [
  // Positioning
  'display','position','top','right','bottom','left',
  'inset','inset-block','inset-inline',
  // Box model
  'size','width','height','min-width','max-width','min-height','max-height',
  'margin','margin-top','margin-right','margin-bottom','margin-left',
  'padding','padding-top','padding-right','padding-bottom','padding-left',
  'border','border-top','border-right','border-bottom','border-left',
  'border-width','border-style','border-color','border-radius',
  'box-sizing','overflow','overflow-x','overflow-y',
  // Colors & Backgrounds
  'color','background','background-color','background-image',
  'background-position','background-size','background-repeat',
  'background-clip','opacity','box-shadow',
  // Typography
  'font-size','font-weight','font-family','font-style',
  'line-height','letter-spacing','text-align','text-decoration',
  'text-transform','text-overflow','white-space','word-break',
  'vertical-align','direction',
  // Flexbox
  'flex','flex-direction','flex-wrap','flex-basis','flex-grow','flex-shrink',
  'justify-content','align-items','align-content','align-self',
  'order','gap','row-gap','column-gap',
  // Grid
  'grid','grid-template-columns','grid-template-rows',
  'grid-column','grid-row','grid-area',
  'grid-auto-columns','grid-auto-rows','grid-auto-flow',
  // Visual effects
  'visibility','transform','transition','animation',
  'backdrop-filter','filter','mix-blend-mode',
  // Interaction
  'cursor','pointer-events','user-select','appearance',
  'outline','outline-offset','resize','caret-color',
  'accent-color','scroll-behavior','overscroll-behavior',
  // Z-index & stacking
  'z-index','isolation',
  // Table
  'border-collapse','border-spacing','table-layout',
  // SVG & misc
  'fill','stroke','stroke-width','object-fit','object-position',
  'aspect-ratio','content','will-change','contain',
];

// ============================================================================
// Levenshtein Distance
// ============================================================================

export function levenshtein(a: string, b: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+(a[j-1]===b[i-1]?0:1));
  return m[b.length][a.length];
}

const propertyCache = new Map<string, string | null>();

export function findClosestProperty(prop: string): string | null {
  const lp = prop.toLowerCase();
  
  // Cache hit — most properties repeat many times in a stylesheet
  const cached = propertyCache.get(lp);
  if (cached !== undefined) return cached;
  
  let best: string | null = null;
  let bestDist = Infinity;
  for (const k of KNOWN_PROPERTIES) {
    const d = levenshtein(lp, k);
    if (d < bestDist && d <= 3) { bestDist = d; best = k; }
  }
  
  propertyCache.set(lp, best);
  return best;
}

// ============================================================================
// Intent Detection
// ============================================================================

export function detectIntent(value: string, ctx: IntentContext = {}): CorrectionResult | null {
  const lv = value.toLowerCase();
  for (const rule of SEMANTIC_INTENTS) {
    if (rule.pattern.test(lv)) {
      const r = rule.handler(value, ctx);
      if (r) return r;
    }
  }
  return null;
}
