// src/compiler/pipeline/normalizers/intent-normalizer.ts
// Now aware of custom shorthands/macros and custom intents via registries

import { recordHistory } from '../ir/utils.js';
import { createDeclaration } from '../ir/factory.js';
import { intent } from './intent-detector.js';

import type { StyleIR } from '../ir/types.js';
import type { NormalizationPass, NormalizationResult, Correction } from '../pipeline-types.js';

// v3.2: import custom registries to avoid false positives on user-defined keys
let _customShorthands: Set<string> | null = null;
let _customMacros: Set<string> | null = null;

function getCustomSets() {
  if (_customShorthands) return { shorthands: _customShorthands, macros: _customMacros! };
  try {
    // dynamic import to avoid circular dep at top level
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sh = require('../../utils/shorthands.js');
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

    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      const pendingDefaults: Array<{ property: string; value: string | number; reason: string }> = [];

      for (const decl of rule.declarations) {
        const rawValue = String(decl.value);

        // v3.2: skip correction for user-defined shorthands/macros/intents — they are intentional
        if (shorthands.has(decl.property) || macros.has(decl.property)) continue;
        if ((decl as any).meta?.intent || (rule.meta as any)?._intent) {
          // intent properties are resolved later by intentResolver, don't typo-correct them
          continue;
        }

        const result = intent.correct(decl.property, rawValue);

        if (result) {
          if (result.intent === 'property-correction') {
            const originalProperty = decl.property;
            // Don't auto-correct if the corrected name is actually a custom shorthand
            if (shorthands.has(result.corrected)) continue;
            decl.property = result.corrected;
            corrections.push({ nodeId: decl.id, property: originalProperty, original: originalProperty, corrected: result.corrected, reason: result.explanation });
            recordHistory(decl, 'intent-normalizer', 'corrected-property', originalProperty, result.explanation);
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
          // v3.2: don't suggest for custom keys
          if (shorthands.has(decl.property) || macros.has(decl.property)) continue;
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

      for (const { property, value, reason } of pendingDefaults) {
        const alreadyExists = rule.declarations.some(d => d.property === property);
        if (!alreadyExists) {
          const newDecl = createDeclaration(property, value, rule.source);
          rule.declarations.push(newDecl);
          corrections.push({ nodeId: rule.id, property, original: undefined, corrected: String(value), reason: `Added default from: ${reason}` });
          recordHistory(newDecl, 'intent-normalizer', 'injected-default', undefined, reason);
        }
      }
    }

    return { ir, corrections };
  },
};

