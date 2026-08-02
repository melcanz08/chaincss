// ============================================================================
// FILE: src/compiler/pipeline/normalizers/intent-normalizer.ts
// ============================================================================

import { recordHistory } from '../ir/utils.js';
import { createDeclaration } from '../ir/index.js';
import { intent } from './intent-detector.js';

import type { StyleIR, IRRule } from '../ir/types.js';
import type { NormalizationPass, NormalizationResult, Correction } from '../pipeline-types.js';

let _customShorthands: Set<string> | null = null;
let _customMacros: Set<string> | null = null;

function getCustomSets() {
  if (_customShorthands) return { shorthands: _customShorthands, macros: _customMacros! };
  try {
    const sh = typeof require !== 'undefined' 
      ? require('../../utils/shorthands.js') 
      : { shorthandMap: {}, macros: {} };
      
    _customShorthands = new Set(Object.keys(sh.shorthandMap || {}));
    _customMacros = new Set(Object.keys(sh.macros || {}));
  } catch {
    _customShorthands = new Set();
    _customMacros = new Set();
  }
  return { shorthands: _customShorthands!, macros: _customMacros! };
}

export function invalidateIntentNormalizerCache() {
  _customShorthands = null;
  _customMacros = null;
}

export const intentNormalizer: NormalizationPass = {
  name: 'intent-normalizer',

  normalize(ir: StyleIR): NormalizationResult {
    const corrections: Correction[] = [];
    const { shorthands, macros } = getCustomSets();

    function normalizeRule(rule: IRRule) {
      if (rule.isDead) return;
      const decls = rule.declarations;
      if (!decls) return;

      const pendingDefaults: Array<{ property: string; value: string | number; reason: string }> = [];

      for (let i = 0, len = decls.length; i < len; i++) {
        const decl = decls[i];
        if (!decl || !decl.property) continue;

        const rawValue = String(decl.value);

        if (shorthands.has(decl.property) || macros.has(decl.property)) continue;
        if (
          (decl as any).meta?.intent ||
          rule.passMeta?.analysis?.semantic?.intents?.length ||
          (rule.meta as any)?._intent
        ) continue;

        const result = intent.correct(decl.property, rawValue);

        if (result) {
          if (result.intent === 'property-correction') {
            const originalProperty = decl.property;
            if (shorthands.has(result.corrected)) continue;
            decl.property = result.corrected;
            corrections.push({ nodeId: decl.id, property: originalProperty, original: originalProperty, corrected: result.corrected, reason: result.explanation });
            recordHistory(decl, 'intent-normalizer', 'corrected-property', originalProperty, result.explanation);
            if (!ir.diagnostics) ir.diagnostics = [];
            ir.diagnostics.push({
              id: `intent-prop-${decl.id}`,
              nodeId: decl.id,
              severity: 'info',
              message: result.explanation,
              suggestion: `Auto-corrected "${originalProperty}" to "${result.corrected}"`,
              pass: 'normalization:intent-normalizer',
            });
          } else {
            const originalValue = rawValue;
            decl.value = result.corrected;
            corrections.push({ nodeId: decl.id, property: decl.property, original: originalValue, corrected: result.corrected, reason: result.explanation });
            recordHistory(decl, 'intent-normalizer', 'corrected-value', originalValue, result.explanation);
            if (result.defaults) {
              const reason = result.explanation;
              for (const [prop, val] of Object.entries(result.defaults)) {
                if (prop !== decl.property) pendingDefaults.push({ property: prop, value: val as any, reason });
              }
            }
          }
        }

        const validation = intent.validate(decl.property, rawValue);
        if (!validation.valid && validation.suggestion) {
          if (shorthands.has(decl.property) || macros.has(decl.property)) continue;
          if (!ir.diagnostics) ir.diagnostics = [];
          ir.diagnostics.push({
            id: `intent-suggest-${decl.id}`,
            nodeId: decl.id,
            severity: 'info',
            message: `Unknown property "${decl.property}". Did you mean "${validation.suggestion}"?`,
            suggestion: `Rename "${decl.property}" to "${validation.suggestion}"`,
            pass: 'normalization:intent-normalizer',
          });
        }
      }

      for (let i = 0, len = pendingDefaults.length; i < len; i++) {
        const { property, value, reason } = pendingDefaults[i];
        let alreadyExists = false;
        for (let j = 0, jLen = decls.length; j < jLen; j++) {
          if (decls[j].property === property) {
            alreadyExists = true;
            break;
          }
        }
        if (!alreadyExists) {
          const newDecl = createDeclaration(property, value, rule.source);
          decls.push(newDecl);
          corrections.push({ nodeId: rule.id, property, original: undefined, corrected: String(value), reason: `Added default from: ${reason}` });
          recordHistory(newDecl, 'intent-normalizer', 'injected-default', undefined, reason);
        }
      }

      const pseudoClasses = rule.pseudoClasses;
      if (pseudoClasses) {
        for (let i = 0, len = pseudoClasses.length; i < len; i++) {
          normalizeRule(pseudoClasses[i] as unknown as IRRule);
        }
      }

      const nestedRules = rule.nestedRules;
      if (nestedRules) {
        for (let i = 0, len = nestedRules.length; i < len; i++) {
          normalizeRule(nestedRules[i]);
        }
      }

      const atRules = rule.atRules;
      if (atRules) {
        for (let i = 0, len = atRules.length; i < len; i++) {
          const at = atRules[i];
          const atNested = at.nestedRules;
          if (atNested) {
            for (let j = 0, jLen = atNested.length; j < jLen; j++) {
              normalizeRule(atNested[j]);
            }
          }
          const keyframes = at.keyframes;
          if (keyframes) {
            for (let j = 0, jLen = keyframes.length; j < jLen; j++) {
              normalizeRule(keyframes[j] as unknown as IRRule);
            }
          }
        }
      }
    }

    const rules = ir?.rules;
    if (rules) {
      for (let i = 0, len = rules.length; i < len; i++) {
        normalizeRule(rules[i]);
      }
    }

    return { ir, corrections };
  },
};