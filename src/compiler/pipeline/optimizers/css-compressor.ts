// src/compiler/pipeline/optimizers/css-compressor.ts

import type { StyleIR } from '../../style-ir.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const cssCompressor: OptimizationPass = {
  name: 'css-compressor',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

    for (const rule of ir.rules) {
      for (const decl of rule.declarations) {
        // Shorten hex colors
        if (typeof decl.value === 'string' && /^#[0-9a-fA-F]{6}$/.test(decl.value)) {
          const hex = decl.value;
          if (hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) {
            const shortened = '#' + hex[1] + hex[3] + hex[5];
            decl.history.push({
              pass: 'css-compressor',
              action: 'shortened-hex',
              timestamp: Date.now(),
              previous: hex,
              reason: 'Shortened hex color',
            });
            decl.value = shortened;
            changes++;
          }
        }

        // Remove leading zeros from decimals
        if (typeof decl.value === 'string' && /^0\.\d+/.test(decl.value)) {
          decl.value = decl.value.replace(/^0\./, '.');
          changes++;
        }
      }
    }

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: changes * 3 },
      changes,
    };
  },
};