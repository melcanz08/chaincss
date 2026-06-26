// src/compiler/pipeline/optimizers/dead-code-eliminator.ts

import type { StyleIR } from '../../style-ir.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const deadCodeEliminator: OptimizationPass = {
  name: 'dead-code-eliminator',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    const before = ir.rules.length;
    ir.rules = ir.rules.filter(r => !r.isDead);
    const eliminated = before - ir.rules.length;

    if (eliminated > 0) {
      ir.diagnostics.push({
        id: 'dead-elim-' + Date.now(),
        nodeId: ir.id,
        severity: 'info',
        message: `Eliminated ${eliminated} dead rules`,
        pass: 'dead-code-eliminator',
      });
    }

    return {
      ir,
      savings: { rulesEliminated: eliminated, declarationsEliminated: 0, bytesSaved: eliminated * 80 },
      changes: eliminated,
    };
  },
};