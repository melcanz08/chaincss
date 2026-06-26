// src/compiler/pipeline/optimizers/media-query-packer.ts

import type { StyleIR } from '../../style-ir.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const mediaQueryPacker: OptimizationPass = {
  name: 'media-query-packer',
  cost: 'moderate',
  requiredFor: ['css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    const queryMap = new Map<string, number>();

    for (const rule of ir.rules) {
      for (const atRule of rule.atRules) {
        if (atRule.type === 'media' && atRule.query) {
          queryMap.set(atRule.query, (queryMap.get(atRule.query) || 0) + 1);
        }
      }
    }

    for (const [query, count] of queryMap) {
      if (count >= 2) {
        ir.diagnostics.push({
          id: 'mq-pack-' + Date.now(),
          nodeId: ir.id,
          severity: 'hint',
          message: `Media query "${query}" used ${count} times — consider grouping`,
          pass: 'media-query-packer',
        });
        changes++;
      }
    }

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: changes * 30 },
      changes,
    };
  },
};