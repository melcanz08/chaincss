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

// Split cache: separate keys for property corrections vs value corrections
const correctionCache = new Map<string, CorrectionResult | null>();

// ============================================================================
// Core Intent Object
// ============================================================================

export const intent = {
  correct(property: string, value: string, context?: IntentContext): CorrectionResult | null {
    // ── Step 1: Property name correction FIRST ──
    // Run before semantic/value checks so misspelled properties aren't
    // short-circuited by a value matching a semantic intent pattern.
    const normalizedProp = property.toLowerCase();
    const pc = findClosestProperty(property);

    if (pc && pc !== normalizedProp) {
      const cacheKey = `prop-err:${normalizedProp}`;
      const cached = correctionCache.get(cacheKey);
      if (cached !== undefined) return cached;

      const d = levenshtein(normalizedProp, pc);
      const result: CorrectionResult = {
        original: property,
        property,
        corrected: pc,
        defaults: {},
        confidence: Math.max(0, 1 - d / Math.max(property.length, pc.length)),
        intent: 'property-correction',
        explanation: `Unknown property "${property}". Did you mean "${pc}"?`
      };

      correctionCache.set(cacheKey, result);
      return result;
    }

    // ── Step 2: Value/intent checks for valid properties ──
    const cacheKey = `val-err:${property}:${value}`;
    const cached = correctionCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const ctx = { property, value, ...context };

    // Semantic intent detection
    const si = detectIntent(value, ctx);
    if (si) {
      correctionCache.set(cacheKey, si);
      return si;
    }

    // Value correction table
    if (VALUE_CORRECTIONS[property]) {
      const c = VALUE_CORRECTIONS[property].find(c => c.wrong === value.toLowerCase());
      if (c) {
        const result: CorrectionResult = {
          original: value, property, corrected: c.correct,
          defaults: { [property]: c.correct }, confidence: c.confidence,
          intent: 'value-correction',
          explanation: `"${value}" is not valid for ${property}. Did you mean "${c.correct}"?`
        };
        correctionCache.set(cacheKey, result);
        return result;
      }
    }

    // Cache the null result too — don't recompute known-good values
    correctionCache.set(cacheKey, null);
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

    // Deep clone to prevent shared memory mutations — downstream passes
    // must not corrupt the master macro object.
    const merged = JSON.parse(JSON.stringify(macro));
    if (!overrides) return merged;

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