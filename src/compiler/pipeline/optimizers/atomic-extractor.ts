// src/compiler/pipeline/optimizers/atomic-extractor.ts

import type { StyleIR } from '../../style-ir.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const atomicExtractor: OptimizationPass = {
  name: 'atomic-extractor',
  cost: 'moderate',
  requiredFor: ['atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    const usageMap = new Map<string, number>();

    for (const rule of ir.rules) {
      for (const decl of rule.declarations) {
        const key = decl.property + ':' + decl.value;
        usageMap.set(key, (usageMap.get(key) || 0) + 1);
      }
    }

    for (const rule of ir.rules) {
      for (const decl of rule.declarations) {
        const key = decl.property + ':' + decl.value;
        const usage = usageMap.get(key) || 0;
        const wasAtomic = decl.meta.atomic;
        decl.meta.atomic = usage >= 3;
        decl.meta.usageCount = usage;
        if (wasAtomic !== decl.meta.atomic) changes++;
      }
    }

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
      changes,
    };
  },
};