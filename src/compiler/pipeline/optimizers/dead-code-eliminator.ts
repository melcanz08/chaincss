// ============================================================================
// FILE: src/compiler/pipeline/optimizers/dead-code-eliminator.ts
// ============================================================================

import type { StyleIR, IRRule } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

/**
 * Validates whether a rule contains any functional style blocks or payload.
 * Rules with no top-level declarations, no active pseudos, and no at-rules are dead weight.
 */
function isRuleEmpty(rule: IRRule): boolean {
  const hasDeclarations = rule.declarations && rule.declarations.length > 0;
  const hasPseudoDeclarations = (rule as any).pseudoClasses?.some((p: any) => p.declarations?.length > 0);
  const hasAtRuleDeclarations = rule.atRules?.some(a => a.declarations && a.declarations.length > 0);

  // NEW: keep rules that still have unresolved intent
  const hasIntent =!!( (rule as any).intent || (rule as any).intents || (rule as any).raw || (rule as any).meta?.intent || (rule as any).meta?._intent );

  return!hasDeclarations &&!hasPseudoDeclarations &&!hasAtRuleDeclarations &&!hasIntent;
}

export const deadCodeEliminator: OptimizationPass = {
  name: 'dead-code-eliminator',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    if (!ir || !ir.rules) {
      return { ir, savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 }, changes: 0 };
    }

    if (!ir.diagnostics) {
      ir.diagnostics = [];
    }

    const initialRulesCount = ir.rules.length;
    let totalDeclarationsCleaned = 0;

    // 1. Sanitize nested elements within surviving rules first
    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      // Clean dead nested at-rules
      if (rule.atRules) {
        const beforeAtCount = rule.atRules.length;
        rule.atRules = rule.atRules.filter(a => !(a as any).isDead);
        totalDeclarationsCleaned += (beforeAtCount - rule.atRules.length);
      }

      // Clean dead nested pseudo-classes
      if ((rule as any).pseudoClasses) {
        const beforePseudoCount = (rule as any).pseudoClasses.length;
        (rule as any).pseudoClasses = ((rule as any).pseudoClasses as any[]).filter(p => !p.isDead);
        totalDeclarationsCleaned += (beforePseudoCount - (rule as any).pseudoClasses.length);
      }
    }

    // 2. Filter out explicit dead rules AND secondary structural shells left empty
    ir.rules = ir.rules.filter(rule => {
      if (rule.isDead) return false;
      
      // If the rule is completely empty after prior optimization steps, drop it
      if (isRuleEmpty(rule)) {
        return false;
      }
      
      return true;
    });

    const eliminatedRules = initialRulesCount - ir.rules.length;
    const totalChanges = eliminatedRules + totalDeclarationsCleaned;

    // Estimate realistic byte savings: ~80 bytes per empty rule block shell
    const estimatedBytesSaved = (eliminatedRules * 80) + (totalDeclarationsCleaned * 25);

    if (totalChanges > 0) {
      ir.diagnostics.push({
        id: `dead-elim-${ir.id}`,
        nodeId: ir.id,
        severity: 'info',
        message: `Dead code eliminator: Purged ${eliminatedRules} empty/dead style rules and ${totalDeclarationsCleaned} nested blocks.`,
        pass: 'dead-code-eliminator',
      });
    }

    return {
      ir,
      savings: { 
        rulesEliminated: eliminatedRules, 
        declarationsEliminated: totalDeclarationsCleaned, 
        bytesSaved: estimatedBytesSaved 
      },
      changes: totalChanges,
    };
  },
};