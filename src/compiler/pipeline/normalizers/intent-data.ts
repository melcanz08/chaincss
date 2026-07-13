// src/compiler/pipeline/normalizers/intent-data.ts 
// Adds custom semantic intents, custom known properties, faster Levenshtein with early exit

import type { CorrectionResult, IntentContext } from '../../../core/types.js';

export interface ValueCorrection { wrong: string; correct: string; confidence: number; }

// ------------------------------------------------------------------
// Semantic intents — now mutable for custom intents from config
// ------------------------------------------------------------------
const BUILTIN_SEMANTIC_INTENTS: Array<{ pattern: RegExp; handler: Function; description: string }> = [
  { pattern: /^flexbox$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'display', corrected: 'flex', defaults: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, confidence: 0.95, intent: 'flexbox-centering', explanation: '"flexbox" mapped to display: flex with centering defaults.' }), description: 'flexbox -> flex + centering' },
  { pattern: /^(absolutely|abs)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'position', corrected: 'absolute', defaults: { position: 'absolute' }, confidence: 0.9, intent: 'absolute-position', explanation: '"abs/absolutely" -> position: absolute' }), description: 'abs -> absolute' },
  { pattern: /^(rel|relatively)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'position', corrected: 'relative', defaults: { position: 'relative' }, confidence: 0.9, intent: 'relative-position', explanation: '"rel/relatively" -> position: relative' }), description: 'rel -> relative' },
  { pattern: /^(hidden|invisible)$/i, handler: (v: string, ctx: any) => { if (ctx.property === 'overflow') return null; return { original: v, property: ctx.property||'visibility', corrected: v.toLowerCase()==='invisible'?'hidden':v.toLowerCase(), defaults: { visibility: 'hidden' }, confidence: 0.9, intent: 'visibility-toggle', explanation: '"' + v + '" -> visibility: hidden' }; }, description: 'invisible -> hidden' },
  { pattern: /^(full|fullscreen|full-screen)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'size', corrected: '100%', defaults: { width: '100%', height: '100%' }, confidence: 0.85, intent: 'full-size', explanation: '"full/fullscreen" -> width/height: 100%' }), description: 'full -> 100%' },
  { pattern: /^(rounded|round)$/i, handler: (v: string, ctx: any) => ({ original: v, property: ctx.property||'border-radius', corrected: '9999px', defaults: { borderRadius: '9999px' }, confidence: 0.8, intent: 'rounded-pill', explanation: '"rounded" -> border-radius: 9999px (pill)' }), description: 'rounded -> pill' },
];

export let SEMANTIC_INTENTS: Array<{ pattern: RegExp; handler: Function; description: string }> = [...BUILTIN_SEMANTIC_INTENTS];

export function registerSemanticIntent(intent: { pattern: RegExp; handler: Function; description: string }, allowOverride = false) {
  SEMANTIC_INTENTS.push(intent);
}
export function registerSemanticIntents(intents: Array<{ pattern: RegExp; handler: Function; description: string }>, allowOverride = false) {
  for (const i of intents) registerSemanticIntent(i, allowOverride);
}
export function resetSemanticIntents() { SEMANTIC_INTENTS = [...BUILTIN_SEMANTIC_INTENTS]; }

// ------------------------------------------------------------------
// Value corrections — mutable
// ------------------------------------------------------------------
const BUILTIN_VALUE_CORRECTIONS: Record<string, ValueCorrection[]> = {
  'display': [{wrong:'flexbox',correct:'flex',confidence:0.95},{wrong:'inline-flexbox',correct:'inline-flex',confidence:0.95}],
  'position': [{wrong:'abs',correct:'absolute',confidence:0.9},{wrong:'rel',correct:'relative',confidence:0.9}],
  'text-align': [{wrong:'centered',correct:'center',confidence:0.85},{wrong:'justified',correct:'justify',confidence:0.85}],
  'overflow': [{wrong:'scrollable',correct:'auto',confidence:0.8}],
  'cursor': [{wrong:'hand',correct:'pointer',confidence:0.9}],
  'user-select': [{wrong:'unselectable',correct:'none',confidence:0.85}],
};

export let VALUE_CORRECTIONS: Record<string, ValueCorrection[]> = { ...BUILTIN_VALUE_CORRECTIONS };
export function registerValueCorrections(prop: string, corrections: ValueCorrection[]) {
  VALUE_CORRECTIONS[prop] = [...(VALUE_CORRECTIONS[prop] || []), ...corrections];
}
export function resetValueCorrections() { VALUE_CORRECTIONS = { ...BUILTIN_VALUE_CORRECTIONS }; }

// ------------------------------------------------------------------
// Known properties — Set for O(1) lookup, plus custom keys
// ------------------------------------------------------------------
const BUILTIN_KNOWN = [
  'display','position','top','right','bottom','left','inset','inset-block','inset-inline',
  'size','width','height','min-width','max-width','min-height','max-height',
  'margin','margin-top','margin-right','margin-bottom','margin-left',
  'padding','padding-top','padding-right','padding-bottom','padding-left',
  'border','border-top','border-right','border-bottom','border-left',
  'border-width','border-style','border-color','border-radius',
  'box-sizing','overflow','overflow-x','overflow-y',
  'color','background','background-color','background-image','background-position','background-size','background-repeat','background-clip','opacity','box-shadow',
  'font-size','font-weight','font-family','font-style','line-height','letter-spacing','text-align','text-decoration','text-transform','text-overflow','white-space','word-break','vertical-align','direction',
  'flex','flex-direction','flex-wrap','flex-basis','flex-grow','flex-shrink','justify-content','align-items','align-content','align-self','order','gap','row-gap','column-gap',
  'grid','grid-template-columns','grid-template-rows','grid-column','grid-row','grid-area','grid-auto-columns','grid-auto-rows','grid-auto-flow',
  'visibility','transform','transition','animation','backdrop-filter','filter','mix-blend-mode',
  'cursor','pointer-events','user-select','appearance','outline','outline-offset','resize','caret-color','accent-color','scroll-behavior','overscroll-behavior',
  'z-index','isolation','border-collapse','border-spacing','table-layout',
  'fill','stroke','stroke-width','object-fit','object-position','aspect-ratio','content','will-change','contain',
];

export const KNOWN_PROPERTIES: string[] = [...BUILTIN_KNOWN];
const knownSet = new Set<string>(BUILTIN_KNOWN.map(p=>p.toLowerCase()));
const customKnown = new Set<string>();

export function registerCustomKnownProperties(props: string[]) {
  for (const p of props) { const lp = p.toLowerCase(); if (!knownSet.has(lp)) { knownSet.add(lp); customKnown.add(lp); KNOWN_PROPERTIES.push(p); } }
}
export function isKnownProperty(prop: string): boolean { return knownSet.has(prop.toLowerCase()) || customKnown.has(prop.toLowerCase()); }
export function resetKnownProperties() {
  KNOWN_PROPERTIES.length = 0; KNOWN_PROPERTIES.push(...BUILTIN_KNOWN);
  knownSet.clear(); for (const p of BUILTIN_KNOWN) knownSet.add(p.toLowerCase()); customKnown.clear(); propertyCache.clear();
}

// ------------------------------------------------------------------
// Levenshtein — optimized with early exit and two-row DP
// ------------------------------------------------------------------
export function levenshtein(a: string, b: string, maxDist = 4): number {
  // Early prune: length diff > maxDist cannot be within threshold
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const al = a.length, bl = b.length;
  if (al === 0) return bl; if (bl === 0) return al;
  let prev = new Array(bl + 1), cur = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    let minInRow = cur[0];
    const ca = a.charCodeAt(i-1);
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j-1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + cost);
      if (cur[j] < minInRow) minInRow = cur[j];
    }
    if (minInRow > maxDist) return maxDist + 1; // early exit
    const tmp = prev; prev = cur; cur = tmp;
  }
  return prev[bl];
}

const propertyCache = new Map<string, string | null>();

export function findClosestProperty(prop: string): string | null {
  const lp = prop.toLowerCase();
  if (isKnownProperty(lp)) return lp; // exact match, no need to search
  const cached = propertyCache.get(lp);
  if (cached !== undefined) return cached;
  let best: string | null = null; let bestDist = 3; // threshold from original code
  // Prune by length: only check candidates where |len diff| <= 3
  for (const k of KNOWN_PROPERTIES) {
    if (Math.abs(k.length - lp.length) > 3) continue;
    const d = levenshtein(lp, k.toLowerCase(), bestDist);
    if (d < bestDist) { bestDist = d; best = k; if (d === 1) break; } // can't get better than 1
  }
  propertyCache.set(lp, best);
  return best;
}

export function clearPropertyCache() { propertyCache.clear(); }

// ------------------------------------------------------------------
// Intent detection
// ------------------------------------------------------------------
export function detectIntent(value: string, ctx: IntentContext = {}): CorrectionResult | null {
  const lv = value.toLowerCase();
  for (const rule of SEMANTIC_INTENTS) {
    if (rule.pattern.test(lv)) { const r = rule.handler(value, ctx); if (r) return r; }
  }
  return null;
}
