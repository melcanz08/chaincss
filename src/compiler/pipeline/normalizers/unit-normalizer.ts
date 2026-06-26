// src/compiler/pipeline/normalizers/unit-normalizer.ts
import { recordHistory } from '../ir/utils.js';

import type { StyleIR } from '../../style-ir.js';
import type { NormalizationPass, NormalizationResult, Correction } from '../pipeline-types.js';

const UNITLESS_PROPERTIES = [
  'opacity', 'zIndex', 'flex', 'fontWeight', 'lineHeight', 'order',
  'flexGrow', 'flexShrink', 'scale', 'zoom',
];

export const unitNormalizer: NormalizationPass = {
  name: 'unit-normalizer',
  
  normalize(ir: StyleIR): NormalizationResult {
    const corrections: Correction[] = [];

    for (const rule of ir.rules) {
      for (const decl of rule.declarations) {
        // Normalize number values — add px where appropriate
        if (typeof decl.value === 'number') {
          if (!UNITLESS_PROPERTIES.includes(decl.property)) {
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
        }

        // Normalize string values that look like numbers
        if (typeof decl.value === 'string' && /^-?\d+(\.\d+)?$/.test(decl.value)) {
          if (!UNITLESS_PROPERTIES.includes(decl.property)) {
            const original = decl.value;
            decl.value = decl.value + 'px';
            corrections.push({
              nodeId: decl.id,
              property: decl.property,
              original,
              corrected: decl.value,
              reason: 'Added px unit to numeric string value',
            });
          }
        }
      }
    }

    return { ir, corrections };
  },
};