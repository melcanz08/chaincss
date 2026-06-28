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
  { pattern: /^(hidden|invisible)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'visibility', corrected: v.toLowerCase()==='invisible'?'hidden':v.toLowerCase(), defaults: { visibility: 'hidden' }, confidence: 0.9, intent: 'visibility-toggle', explanation: '"' + v + '" -> visibility: hidden' }), description: 'invisible -> hidden' },
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
  'display','position','color','background','width','height','font-size',
  'text-align','cursor','opacity','z-index','overflow','visibility','flex',
  'flex-direction','justify-content','align-items','gap','grid','transition',
  'transform','animation','box-shadow','pointer-events','user-select','line-height'
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

export function findClosestProperty(prop: string): string | null {
  const lp = prop.toLowerCase();
  let best: string | null = null, bestDist = Infinity;
  for (const k of KNOWN_PROPERTIES) {
    const d = levenshtein(lp, k);
    if (d < bestDist && d <= 3) { bestDist = d; best = k; }
  }
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
