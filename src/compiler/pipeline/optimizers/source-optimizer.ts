// src/compiler/pipeline/optimizers/source-optimizer.ts

import type { StyleIR } from '../../style-ir.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const sourceOptimizer: OptimizationPass = {
  name: 'source-optimizer',
  cost: 'expensive',
  requiredFor: ['css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

    // Detect and flag duplicate declarations within the same rule
    for (const rule of ir.rules) {
      const seen = new Map<string, number>();
      for (let i = rule.declarations.length - 1; i >= 0; i--) {
        const decl = rule.declarations[i];
        if (seen.has(decl.property)) {
          // Duplicate found — mark the earlier one as redundant
          const earlierIdx = seen.get(decl.property)!;
          ir.diagnostics.push({
            id: 'dup-decl-' + Date.now(),
            nodeId: rule.id,
            severity: 'warning',
            message: `Duplicate property "${decl.property}" in "${rule.selector}" — earlier declaration overridden`,
            pass: 'source-optimizer',
          });
          changes++;
        }
        seen.set(decl.property, i);
      }
    }

    // Detect identical rules (same selector, same declarations)
    const ruleHashes = new Map<string, number>();
    for (let i = ir.rules.length - 1; i >= 0; i--) {
      const rule = ir.rules[i];
      const hash = rule.selector + '|' + rule.declarations.map(d => d.property + ':' + d.value).sort().join(';');
      if (ruleHashes.has(hash)) {
        rule.isDead = true;
        changes++;
      }
      ruleHashes.set(hash, i);
    }

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: changes * 50 },
      changes,
    };
  },
};