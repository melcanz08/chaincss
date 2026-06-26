// src/compiler/pipeline/normalizers/intent-normalizer.ts

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
          decl.history.push({
            pass: 'intent-normalizer',
            action: 'corrected-value',
            timestamp: Date.now(),
            previous: original,
            reason: 'flexbox → flex',
          });

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
          decl.history.push({
            pass: 'intent-normalizer',
            action: 'corrected-value',
            timestamp: Date.now(),
            previous: original,
            reason: 'abs → absolute',
          });
        }
      }
    }

    return { ir, corrections };
  },
};