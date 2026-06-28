// src/compiler/pipeline/normalizers/intent-detector.ts
//
// Intent engine — corrects common CSS mistakes (typos, wrong values),
// heals entire style objects, and validates property/value pairs.
//
// Data extracted to:
//   intent-data.ts     — semantic intents, value corrections, known properties
//   layout-macros.ts   — layout macro definitions and resolvers

import type { CorrectionResult, HealMode, HealResult, IntentContext } from '../../../core/types.js';
import { detectIfPatterns, emitCSSIf } from '../lowering/css-if-lowering.js';

// Re-export types for backward compatibility
export type { CorrectionResult, HealMode, HealResult, IntentContext };

import {
  type ValueCorrection,
  VALUE_CORRECTIONS,
  KNOWN_PROPERTIES,
  SEMANTIC_INTENTS,
  findClosestProperty,
  detectIntent,
  levenshtein,
} from './intent-data.js';

import {
  LAYOUT_MACROS,
  expandLayoutMacro,
  getAvailableMacros,
  getMacroDescription,
  autoContrast,
} from './layout-macros.js';

// ============================================================================
// Core Intent Object
// ============================================================================

export const intent = {
  correct(property: string, value: string, context?: IntentContext): CorrectionResult | null {
    const ctx = { property, value, ...context };
    const si = detectIntent(value, ctx);
    if (si) return si;
    if (VALUE_CORRECTIONS[property]) {
      const c = VALUE_CORRECTIONS[property].find(c => c.wrong === value.toLowerCase());
      if (c) return {
        original: value, property, corrected: c.correct,
        defaults: { [property]: c.correct }, confidence: c.confidence,
        intent: 'value-correction',
        explanation: `"${value}" is not valid for ${property}. Did you mean "${c.correct}"?`
      };
    }
    const pc = findClosestProperty(property);
    if (pc && pc !== property.toLowerCase()) {
      const d = levenshtein(property.toLowerCase(), pc);
      return {
        original: property, property, corrected: pc, defaults: {},
        confidence: Math.max(0, 1 - d / Math.max(property.length, pc.length)),
        intent: 'property-correction',
        explanation: `Unknown property "${property}". Did you mean "${pc}"?`
      };
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

  getIntent(value: string, ctx?: IntentContext): string | null {
    const r = detectIntent(value, ctx);
    return r?.intent || null;
  },

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

  getCorrections(property: string): ValueCorrection[] {
    return VALUE_CORRECTIONS[property] || [];
  },

  explain(correction: CorrectionResult): string {
    return correction.explanation;
  },

  cssIf: { detect: detectIfPatterns, emit: emitCSSIf },

  getIntents() {
    return SEMANTIC_INTENTS.map(r => ({ pattern: r.pattern.toString(), description: r.description }));
  },

  getKnownProperties(): string[] { return [...KNOWN_PROPERTIES]; },

  // Layout Macros
  macro(name: string): Record<string, any> | null { return expandLayoutMacro(name); },
  getMacros(): string[] { return getAvailableMacros(); },
  autoContrast(bgColor: string): string { return autoContrast(bgColor); },
  getMacroDescription(name: string): string | null { return getMacroDescription(name); },
  hasMacro(name: string): boolean { return name in LAYOUT_MACROS; },

  applyMacro(name: string, overrides?: Record<string, any>): Record<string, any> | null {
    const macro = expandLayoutMacro(name);
    if (!macro) return null;
    if (!overrides) return macro;
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

// ============================================================================
// Convenience exports (backward compatible)
// ============================================================================

export const correct = intent.correct.bind(intent);
export const heal = intent.heal.bind(intent);
export const validate = intent.validate.bind(intent);
export const getIntent = intent.getIntent.bind(intent);
export const macro = intent.macro.bind(intent);
export const applyMacro = intent.applyMacro.bind(intent);
export const getMacros = intent.getMacros.bind(intent);
export const hasMacro = intent.hasMacro.bind(intent);

export default intent;
