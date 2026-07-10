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
  // Deep clone that preserves Map objects, arrays, and nested structures.
  // JSON.parse(JSON.stringify()) strips prototypes and Map entries.
  return {
    ...ir,
    id: ir.id,
    rules: ir.rules.map(rule => ({
      ...rule,
      declarations: rule.declarations.map(decl => ({
        ...decl,
        history: [...decl.history],
        meta: decl.meta ? { ...decl.meta } : {},
      })),
      pseudoClasses: rule.pseudoClasses.map(pc => ({
        ...pc,
        declarations: pc.declarations.map(decl => ({
          ...decl,
          history: [...decl.history],
          meta: decl.meta ? { ...decl.meta } : {},
        })),
        history: [...pc.history],
      })),
      atRules: rule.atRules.map(atRule => ({
        ...atRule,
        declarations: atRule.declarations.map(decl => ({
          ...decl,
          history: [...decl.history],
          meta: decl.meta ? { ...decl.meta } : {},
        })),
        nestedRules: atRule.nestedRules.map(nr => ({ ...nr })),
        history: [...atRule.history],
      })),
      nestedRules: rule.nestedRules.map(nr => ({ ...nr })),
      conditions: rule.conditions.map(cond => ({ ...cond })),
      history: [...rule.history],
      meta: rule.meta ? { ...rule.meta } : {},
    })),
    diagnostics: ir.diagnostics.map(diag => ({ ...diag })),
    meta: {
      ...ir.meta,
      passes: [...ir.meta.passes],
      sourceFiles: [...ir.meta.sourceFiles],
    },
  };
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

/** Record a transform in a declaration's history — only in development. */
export function recordHistory(decl: { history: any[] }, pass: string, action: string, previous?: any, reason?: string): void {
  if (process.env.NODE_ENV === 'production') return;
  decl.history.push({
    pass,
    action,
    timestamp: Date.now(),
    previous,
    reason,
  });
}
