// src/compiler/pipeline/optimizers/source-optimizer.ts
//
// Source Optimizer — detects and eliminates duplicate CSS rules.
//
// Two rules are considered duplicates if they share the same selector
// and the same set of declarations (regardless of declaration order).
// The later rule is kept (it would win in CSS cascade anyway), and
// earlier duplicates are marked as dead for the dead-code-eliminator.

import type { StyleIR } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const sourceOptimizer: OptimizationPass = {
  name: 'source-optimizer',
  cost: 'expensive',
  requiredFor: ['css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    let bytesSaved = 0;

    // Build a hash for each rule: selector + sorted declarations
    // Walk backward so later rules are seen first — earlier duplicates get marked dead
    const seen = new Map<string, number>(); // hash → first-seen index

    for (let i = ir.rules.length - 1; i >= 0; i--) {
      const rule = ir.rules[i];
      if (rule.isDead) continue;

      // Generate a stable hash from selector + declarations (order-independent)
      const declString = rule.declarations
        .map(d => `${d.property}:${d.value}`)
        .sort()
        .join(';');
      const hash = rule.selector + '|' + declString;

      if (seen.has(hash)) {
        // Duplicate found — mark the earlier occurrence as dead
        rule.isDead = true;
        changes++;
        bytesSaved += declString.length + rule.selector.length + 20; // ~declarations + selector + braces

        ir.diagnostics.push({
          id: 'dup-rule-' + Date.now(),
          nodeId: rule.id,
          severity: 'info',
          message: `Duplicate rule "${rule.selector}" eliminated — identical to rule at index ${seen.get(hash)}`,
          suggestion: 'Consider using a shared style definition instead of duplicating rules.',
          pass: 'source-optimizer',
        });
      } else {
        seen.set(hash, i);
      }
    }

    if (changes > 0) {
      ir.diagnostics.push({
        id: 'source-opt-summary-' + Date.now(),
        nodeId: ir.id,
        severity: 'info',
        message: `Source optimizer: eliminated ${changes} duplicate rules, saving ~${bytesSaved} bytes`,
        pass: 'source-optimizer',
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: changes,
        declarationsEliminated: 0,
        bytesSaved,
      },
      changes,
    };
  },
};