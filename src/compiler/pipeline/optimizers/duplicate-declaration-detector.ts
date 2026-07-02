// src/compiler/pipeline/optimizers/duplicate-declaration-detector.ts
//
// Duplicate Declaration Detector — flags redundant declarations within a rule.
//
// CSS silently uses the last declaration when a property is declared multiple
// times in the same rule. Earlier declarations are dead code. This pass
// detects them and emits diagnostics so developers can clean them up.
//
// This does NOT remove the declarations — only the developer knows which
// value they intended. The pass flags the issue and lets the human decide.

import type { StyleIR } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const duplicateDeclarationDetector: OptimizationPass = {
  name: 'duplicate-declaration-detector',
  cost: 'cheap',
  requiredFor: ['css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      // Track the last-seen index of each property
      const seen = new Map<string, number>();

      for (let i = 0; i < rule.declarations.length; i++) {
        const decl = rule.declarations[i];

        if (seen.has(decl.property)) {
          // Duplicate found — the earlier declaration is overridden
          changes++;

          ir.diagnostics.push({
            id: 'dup-decl-' + decl.id,
            nodeId: rule.id,
            severity: 'warning',
            message: `Duplicate property "${decl.property}" in "${rule.selector}" — declaration at position ${seen.get(decl.property)} is overridden by the one at position ${i}`,
            suggestion: `Remove the earlier "${decl.property}" declaration to clean up dead code.`,
            pass: 'duplicate-declaration-detector',
          });
        }

        seen.set(decl.property, i);
      }
    }

    if (changes > 0) {
      ir.diagnostics.push({
        id: 'dup-decl-summary-' + Date.now(),
        nodeId: ir.id,
        severity: 'info',
        message: `Duplicate declaration detector: found ${changes} overridden declarations across all rules`,
        pass: 'duplicate-declaration-detector',
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved: changes * 30, // Estimate: average declaration ~30 bytes
      },
      changes,
    };
  },
};