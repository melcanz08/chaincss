// src/compiler/pipeline/normalizers/intent-normalizer.ts
import { recordHistory } from '../ir/utils.js';

import type { StyleIR } from '../../style-ir.js';
import type { NormalizationPass, NormalizationResult, Correction } from '../pipeline-types.js';
import { createDeclaration } from '../../style-ir.js';

export const intentNormalizer: NormalizationPass = {
  name: 'intent-normalizer',
  
  normalize(ir: StyleIR): NormalizationResult {
    const corrections: Correction[] = [];

    for (const rule of ir.rules) {
      for (const decl of rule.declarations) {
        // Fix common value mistakes
        if (decl.property === 'display' && decl.value === 'flexbox') {
          const original = decl.value;
          decl.value = 'flex';
          corrections.push({
            nodeId: decl.id,
            property: 'display',
            original,
            corrected: 'flex',
            reason: 'flexbox → flex',
          });
          recordHistory(decl, 'intent-normalizer', 'corrected-value', original, 'flexbox → flex');

          // Add centering defaults
          const hasJustify = rule.declarations.some(d => d.property === 'justifyContent');
          const hasAlign = rule.declarations.some(d => d.property === 'alignItems');
          if (!hasJustify) {
            rule.declarations.push(
              createDeclaration('justifyContent', 'center', rule.source)
            );
            corrections.push({
              nodeId: rule.id,
              property: 'justifyContent',
              original: undefined,
              corrected: 'center',
              reason: 'Added flexbox centering default',
            });
          }
          if (!hasAlign) {
            rule.declarations.push(
              createDeclaration('alignItems', 'center', rule.source)
            );
            corrections.push({
              nodeId: rule.id,
              property: 'alignItems',
              original: undefined,
              corrected: 'center',
              reason: 'Added flexbox centering default',
            });
          }
        }

        if (decl.property === 'position' && decl.value === 'abs') {
          const original = decl.value;
          decl.value = 'absolute';
          corrections.push({
            nodeId: decl.id,
            property: 'position',
            original,
            corrected: 'absolute',
            reason: 'abs → absolute',
          });
          recordHistory(decl, 'intent-normalizer', 'corrected-value', original, 'abs → absolute');
        }
      }
    }

    return { ir, corrections };
  },
};