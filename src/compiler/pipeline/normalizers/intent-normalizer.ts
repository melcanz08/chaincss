// src/compiler/pipeline/normalizers/intent-normalizer.ts
//
// Intent Normalizer — Pipeline pass that wires the full intent engine
// (semantic matching, Levenshtein correction, value fixes, macro expansion)
// into the IR compilation pipeline.

import { recordHistory } from '../ir/utils.js';
import { createDeclaration } from '../ir/factory.js';
import { intent } from './intent-detector.js';

import type { StyleIR } from '../ir/types.js';
import type { NormalizationPass, NormalizationResult, Correction } from '../pipeline-types.js';

export const intentNormalizer: NormalizationPass = {
  name: 'intent-normalizer',

  normalize(ir: StyleIR): NormalizationResult {
    const corrections: Correction[] = [];

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      // Collect defaults to inject after iterating declarations.
      const pendingDefaults: Array<{
        property: string;
        value: string | number;
        reason: string;
      }> = [];

      for (const decl of rule.declarations) {
        const rawValue = String(decl.value);

        // ── Step 1: Full intent correction ──
        const result = intent.correct(decl.property, rawValue);

        if (result) {
          if (result.intent === 'property-correction') {
            // Property name correction — fix the property in place
            const originalProperty = decl.property;
            decl.property = result.corrected;

            corrections.push({
              nodeId: decl.id,
              property: originalProperty,
              original: originalProperty,
              corrected: result.corrected,
              reason: result.explanation,
            });

            recordHistory(
              decl,
              'intent-normalizer',
              'corrected-property',
              originalProperty,
              result.explanation
            );

            ir.diagnostics.push({
              id: `intent-prop-${decl.id}`,
              nodeId: decl.id,
              severity: 'info',
              message: result.explanation,
              suggestion: `Auto-corrected "${originalProperty}" to "${result.corrected}"`,
              pass: 'normalization:intent-normalizer',
            });
          } else {
            // Value correction — fix the value and inject defaults
            const originalValue = rawValue;
            decl.value = result.corrected;

            corrections.push({
              nodeId: decl.id,
              property: decl.property,
              original: originalValue,
              corrected: result.corrected,
              reason: result.explanation,
            });

            recordHistory(
              decl,
              'intent-normalizer',
              'corrected-value',
              originalValue,
              result.explanation
            );

            // Queue defaults for injection (e.g., centering for flexbox)
            if (result.defaults) {
              const reason = result.explanation;
              for (const [prop, val] of Object.entries(result.defaults)) {
                if (prop !== decl.property) {
                  pendingDefaults.push({ property: prop, value: val, reason });
                }
              }
            }
          }
        }

        // ── Step 2: Unknown property suggestions ──
        // (This catches properties not even close enough for Levenshtein correction)
        const validation = intent.validate(decl.property, rawValue);
        if (!validation.valid && validation.suggestion) {
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

      // ── Step 3: Inject defaults from semantic corrections ──
      for (const { property, value, reason } of pendingDefaults) {
        const alreadyExists = rule.declarations.some(
          d => d.property === property
        );
        if (!alreadyExists) {
          const newDecl = createDeclaration(property, value, rule.source);
          rule.declarations.push(newDecl);
          corrections.push({
            nodeId: rule.id,
            property,
            original: undefined,
            corrected: String(value),
            reason: `Added default from: ${reason}`,
          });
          recordHistory(
            newDecl,
            'intent-normalizer',
            'injected-default',
            undefined,
            reason
          );
        }
      }
    }

    return { ir, corrections };
  },
};