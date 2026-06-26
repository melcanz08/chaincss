// src/compiler/pipeline/ir/utils.ts
/** IR utility functions. */

import type { StyleIR, IRRule } from './types.js';

// ============================================================================
// IR Utilities
// ============================================================================

/** Count all nodes in the IR */
export function countNodes(ir: StyleIR): { rules: number; declarations: number; pseudoClasses: number; atRules: number; conditions: number } {
  let declarations = 0, pseudoClasses = 0, atRules = 0, conditions = 0;
  for (const rule of ir.rules) {
    declarations += rule.declarations.length;
    pseudoClasses += rule.pseudoClasses.length;
    atRules += rule.atRules.length;
    conditions += rule.conditions.length;
  }
  return { rules: ir.rules.length, declarations, pseudoClasses, atRules, conditions };
}

/** Find a rule by selector */
export function findRule(ir: StyleIR, selector: string): IRRule | undefined {
  return ir.rules.find(r => r.selector === selector);
}

/** Clone an IR (deep copy) */
export function cloneIR(ir: StyleIR): StyleIR {
  return JSON.parse(JSON.stringify(ir));
}

/** Debug: print IR summary */
export function debugIR(ir: StyleIR): string {
  const counts = countNodes(ir);
  return [
    'StyleIR {',
    '  id: ' + ir.id,
    '  rules: ' + counts.rules,
    '  declarations: ' + counts.declarations,
    '  pseudoClasses: ' + counts.pseudoClasses,
    '  atRules: ' + counts.atRules,
    '  conditions: ' + counts.conditions,
    '  diagnostics: ' + ir.diagnostics.length,
    '  passes: [' + ir.meta.passes.join(', ') + ']',
    '}',
  ].join('\n');
}
