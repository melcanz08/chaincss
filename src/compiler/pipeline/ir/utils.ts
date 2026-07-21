// ============================================================================
// FILE: src/compiler/pipeline/ir/utils.ts
// ============================================================================

import type { StyleIR, IRRule, IRDeclaration, IRAtRule, IRKeyframeFrame } from './types.js';

/** Count all nodes in the IR recursively */
export function countNodes(ir: StyleIR): { rules: number; declarations: number; pseudoClasses: number; atRules: number; conditions: number } {
  const counts = { rules: 0, declarations: 0, pseudoClasses: 0, atRules: 0, conditions: 0 };
  
  function visitRule(rule: IRRule): void {
    counts.rules++;
    counts.declarations += rule.declarations.length;
    counts.pseudoClasses += rule.pseudoClasses.length;
    counts.conditions += rule.conditions.length;
    counts.atRules += rule.atRules.length;

    // Handle deep traversal for nested layout rules
    for (let i = 0; i < rule.atRules.length; i++) {
      const at = rule.atRules[i];
      if (at.nestedRules) {
        for (let j = 0; j < at.nestedRules.length; j++) {
          visitRule(at.nestedRules[j]);
        }
      }
    }

    for (let i = 0; i < rule.nestedRules.length; i++) {
      visitRule(rule.nestedRules[i]);
    }
  }

  for (let i = 0; i < ir.rules.length; i++) {
    visitRule(ir.rules[i]);
  }

  return counts;
}

/** Find a rule by selector (shallow top-level match) */
export function findRule(ir: StyleIR, selector: string): IRRule | undefined {
  return ir.rules.find(r => r.selector === selector);
}

function cloneDecl(decl: IRDeclaration): IRDeclaration {
  return {
    ...decl,
    history: [...decl.history],
    meta: decl.meta ? { ...decl.meta } : {},
  };
}

function cloneKeyframeFrame(frame: IRKeyframeFrame): IRKeyframeFrame {
  return {
    ...frame,
    declarations: frame.declarations.map(cloneDecl),
  };
}

function cloneAtRule(atRule: IRAtRule): IRAtRule {
  const cloned: IRAtRule = {
    ...atRule,
    declarations: atRule.declarations.map(cloneDecl),
    nestedRules: atRule.nestedRules ? atRule.nestedRules.map(cloneRule) : [],
    history: [...atRule.history],
  };

  if (atRule.keyframes) {
    cloned.keyframes = atRule.keyframes.map(cloneKeyframeFrame);
  }

  return cloned;
}

function cloneRule(rule: IRRule): IRRule {
  return {
    ...rule,
    declarations: rule.declarations.map(cloneDecl),
    pseudoClasses: rule.pseudoClasses.map(pc => ({
      ...pc,
      declarations: pc.declarations.map(cloneDecl),
      history: [...pc.history],
    })),
    atRules: rule.atRules.map(cloneAtRule),
    nestedRules: rule.nestedRules.map(cloneRule),
    conditions: rule.conditions.map(cond => ({ ...cond })),
    history: [...rule.history],
    meta: rule.meta ? { ...rule.meta } : {},
  };
}

/** Clone an IR (deep copy) preserving structural relationships */
export function cloneIR(ir: StyleIR): StyleIR {
  return {
    ...ir,
    id: ir.id,
    rules: ir.rules.map(cloneRule),
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
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return;
  decl.history.push({
    pass,
    action,
    timestamp: Date.now(),
    previous,
    reason,
  });
}