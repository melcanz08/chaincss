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

// Pre-compiled regex constants
const REGEX_UPPER_CASE = /[A-Z]/g;
const REGEX_NUMERIC_STRING = /^-?\d+(\.\d+)?$/;

export const unitNormalizer: NormalizationPass = {
  name: 'unit-normalizer',
  
  normalize(ir: StyleIR): NormalizationResult {
    const corrections: Correction[] = [];

    function normalizeRule(rule: IRRule) {
      if (rule.isDead) return;
      const decls = rule.declarations;
      if (!decls) return;

      for (let i = 0, len = decls.length; i < len; i++) {
        const decl = decls[i];
        if (!decl || !decl.property) continue;
        if (decl.property.startsWith('--')) continue;
        
        const propLower = decl.property.toLowerCase();
        const kebabProp = propLower === decl.property 
          ? decl.property 
          : decl.property.replace(REGEX_UPPER_CASE, (m, offset) => (offset > 0 ? '-' : '') + m.toLowerCase());

        if (UNITLESS_PROPERTIES.has(kebabProp) || UNITLESS_PROPERTIES.has(propLower)) {
          continue;
        }

        const val = decl.value;
        if (typeof val === 'number') {
          if (val === 0) continue;
          
          const original = val;
          decl.value = val + 'px';
          corrections.push({
            nodeId: decl.id,
            property: decl.property,
            original,
            corrected: decl.value,
            reason: 'Added px unit to number value',
          });
          recordHistory(decl, 'unit-normalizer', 'added-unit', original, 'Added px unit to number value');
        } else if (typeof val === 'string' && REGEX_NUMERIC_STRING.test(val)) {
          if (parseFloat(val) === 0) continue;
          
          const original = val;
          decl.value = val + 'px';
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