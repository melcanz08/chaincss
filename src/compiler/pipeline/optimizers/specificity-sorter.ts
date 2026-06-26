// src/compiler/pipeline/optimizers/specificity-sorter.ts

import type { StyleIR } from '../../style-ir.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const specificitySorter: OptimizationPass = {
  name: 'specificity-sorter',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

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

    // Sort by specificity (lowest first for proper cascade)
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