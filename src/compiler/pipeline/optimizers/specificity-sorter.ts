// src/compiler/pipeline/optimizers/specificity-sorter.ts
//
// Specificity Sorter — sorts CSS rules by specificity (lowest first).
//
// WHY THIS MATTERS:
// CSS cascade depends on source order when specificity is equal. By sorting
// lowest-specificity first, we ensure:
//   1. Base styles (element selectors, classes) appear before overrides (IDs)
//   2. gzip/Brotli compression improves because similar selectors cluster together
//   3. The generated CSS is predictable regardless of input order
//
// This is safe because specificity ordering preserves the cascade:
// a rule with higher specificity always overrides one with lower specificity,
// regardless of source order.

import type { StyleIR } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const specificitySorter: OptimizationPass = {
  name: 'specificity-sorter',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

    // Calculate specificity for each rule using CSS spec algorithm:
    // a = IDs, b = classes/pseudo-classes/attributes, c = elements/pseudo-elements
    // Weight: a*10000 + b*100 + c
    for (const rule of ir.rules) {
      let a = 0, b = 0, c = 0;

      const idMatches = rule.selector.match(/#[a-zA-Z0-9_-]+/g);
      if (idMatches) a += idMatches.length;

      const classMatches = rule.selector.match(/\.[a-zA-Z0-9_-]+/g);
      if (classMatches) b += classMatches.length;

      const pseudoMatches = rule.selector.match(/:[a-zA-Z-]+/g);
      if (pseudoMatches) b += pseudoMatches.length;

      const elemMatches = rule.selector.match(/^[a-zA-Z]+|[a-zA-Z]+(?=[.#[:])/g);
      if (elemMatches) c += elemMatches.length;

      const newSpecificity = a * 10000 + b * 100 + c;
      if (rule.specificity !== newSpecificity) {
        rule.specificity = newSpecificity;
        changes++;
      }
    }

    // Sort lowest specificity first — higher-specificity rules later in file
    // means they naturally override lower ones in the cascade
    const before = ir.rules.map(r => r.selector).join(',');
    ir.rules.sort((a, b) => a.specificity - b.specificity);
    const after = ir.rules.map(r => r.selector).join(',');
    if (before !== after) changes++;

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
      changes,
    };
  },
};