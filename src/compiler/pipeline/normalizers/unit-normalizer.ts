// ============================================================================
// FILE: src/compiler/pipeline/normalizers/unit-normalizer.ts
// ============================================================================

import { recordHistory } from '../ir/utils.js';

import type { StyleIR, IRRule } from '../ir/types.js';
import type { NormalizationPass, NormalizationResult, Correction } from '../pipeline-types.js';

const UNITLESS_PROPERTIES = new Set([
  'opacity', 'z-index', 'flex', 'font-weight', 'line-height', 'order',
  'flex-grow', 'flex-shrink', 'scale', 'zoom',
  'animation-iteration-count', 'column-count', 'orphans', 'widows',
  'fill-opacity', 'stroke-opacity', 'animation-composition'
]);

export const unitNormalizer: NormalizationPass = {
  name: 'unit-normalizer',
  
  normalize(ir: StyleIR): NormalizationResult {
    const corrections: Correction[] = [];

    // Phase 2 Recursive Normalization Engine
    function normalizeRule(rule: IRRule) {
      if (rule.isDead) return;

      for (const decl of rule.declarations) {
        if (decl.property.startsWith('--')) continue;
        
        // Safe casing normalizer match check
        const kebabProp = decl.property
          .replace(/[A-Z]/g, (m, offset) => (offset > 0 ? '-' : '') + m.toLowerCase());

        if (UNITLESS_PROPERTIES.has(kebabProp) || UNITLESS_PROPERTIES.has(decl.property.toLowerCase())) {
          continue;
        }

        // Normalize number values — add px where appropriate
        if (typeof decl.value === 'number') {
          if (decl.value === 0) continue;
          
          const original = decl.value;
          decl.value = decl.value + 'px';
          corrections.push({
            nodeId: decl.id,
            property: decl.property,
            original,
            corrected: decl.value,
            reason: 'Added px unit to number value',
          });
          recordHistory(decl, 'unit-normalizer', 'added-unit', original, 'Added px unit to number value');
        }

        // Normalize string values that look like numbers
        else if (typeof decl.value === 'string' && /^-?\d+(\.\d+)?$/.test(decl.value)) {
          if (parseFloat(decl.value) === 0) continue;
          
          const original = decl.value;
          decl.value = decl.value + 'px';
          corrections.push({
            nodeId: decl.id,
            property: decl.property,
            original,
            corrected: decl.value,
            reason: 'Added px unit to numeric string value',
          });
          recordHistory(decl, 'unit-normalizer', 'added-unit', original, 'Added px unit to numeric string value');
        }
      }

      // Natively cascade modifications into structural sub-branches
      if (rule.pseudoClasses) {
        for (let i = 0; i < rule.pseudoClasses.length; i++) {
          normalizeRule(rule.pseudoClasses[i] as unknown as IRRule);
        }
      }

      if (rule.nestedRules) {
        for (let i = 0; i < rule.nestedRules.length; i++) {
          normalizeRule(rule.nestedRules[i]);
        }
      }

      if (rule.atRules) {
        for (let i = 0; i < rule.atRules.length; i++) {
          const at = rule.atRules[i];
          if (at.nestedRules) {
            for (let j = 0; j < at.nestedRules.length; j++) {
              normalizeRule(at.nestedRules[j]);
            }
          }
          if (at.keyframes) {
            for (let j = 0; j < at.keyframes.length; j++) {
              normalizeRule(at.keyframes[j] as unknown as IRRule);
            }
          }
        }
      }
    }

    // Process all root rules
    for (let i = 0; i < ir.rules.length; i++) {
      normalizeRule(ir.rules[i]);
    }

    return { ir, corrections };
  },
};