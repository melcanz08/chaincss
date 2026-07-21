// ============================================================================
// FILE: src/compiler/pipeline/optimizers/duplicate-declaration-detector.ts
// ============================================================================

import type { StyleIR, IRRule, IRDeclaration } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

/**
 * Checks if a duplicate property value is an intentional CSS fallback mechanism
 * (e.g., fallback colors, display modes, or experimental prefixes).
 */
function isIntentionalFallback(prevValue: unknown, nextValue: unknown): boolean {
  const p = String(prevValue).trim().toLowerCase();
  const n = String(nextValue).trim().toLowerCase();
  
  // identical = redundant, safe to delete
  if (p === n) return false;

  // 1. color fallback: #fff / rgb() -> gradient / var() / oklab
  const isLegacyColor = p.startsWith('#') || p.startsWith('rgb');
  const isModernColor = n.includes('gradient') || n.includes('var(') || n.includes('oklab') || n.includes('oklch') || n.includes('calc(');
  if (isLegacyColor && isModernColor) return true;

  // 2. display fallback: block -> flex -> grid (keep both for old browsers)
  const displayValues = ['block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid'];
  if (displayValues.includes(p) && displayValues.includes(n)) return true;

  return false;
}

/**
 * Prunes safe duplicate declarations out of a target array while respecting fallbacks.
 */
function pruneDuplicateDeclarations(
  declarations: IRDeclaration[] | undefined,
  ruleContextName: string,
  ruleId: string,
  diagnostics: any[]
): { pruned: IRDeclaration[]; changesCount: number; bytesSavedCount: number } {
  if (!declarations || declarations.length === 0) {
    return { pruned: declarations || [], changesCount: 0, bytesSavedCount: 0 };
  }

  const pruned: IRDeclaration[] = [];
  const seenIndexMap = new Map<string, number>(); // property -> index in the working 'pruned' array
  let changesCount = 0;
  let bytesSavedCount = 0;

  for (const decl of declarations) {
    const prop = decl.property;

    if (seenIndexMap.has(prop)) {
      const prevIndex = seenIndexMap.get(prop)!;
      const prevDecl = pruned[prevIndex];

      if (!isIntentionalFallback(prevDecl.value, decl.value)) {
        // Safe to eliminate the earlier duplicate!
        changesCount++;
        bytesSavedCount += String(prevDecl.value).length + prop.length + 4; // approximate declaration size

        diagnostics.push({
          id: `dup-decl-${ruleId}-${prop}-${changesCount}`,
          nodeId: ruleId,
          severity: 'warning',
          message: `Duplicate property "${prop}" in "${ruleContextName}" — earlier value "${prevDecl.value}" is safely removed as it's overridden by "${decl.value}".`,
          suggestion: `Remove redundant "${prop}" assignment.`,
          pass: 'duplicate-declaration-detector',
        });

        // Replace the earlier index position with the new progressive declaration mutation
        pruned[prevIndex] = decl;
        continue;
      }
    }

    // Keep the declaration and track its updated position index
    pruned.push(decl);
    seenIndexMap.set(prop, pruned.length - 1);
  }

  return { pruned, changesCount, bytesSavedCount };
}

export const duplicateDeclarationDetector: OptimizationPass = {
  name: 'duplicate-declaration-detector',
  cost: 'cheap',
  requiredFor: ['css'],

  optimize(ir: StyleIR): OptimizationResult {
    let totalChanges = 0;
    let totalBytesSaved = 0;

    if (!ir || !ir.rules) {
      return { ir, savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 }, changes: 0 };
    }

    if (!ir.diagnostics) {
      ir.diagnostics = [];
    }

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      // 1. Optimize standard block level declarations
      if (rule.declarations) {
        const result = pruneDuplicateDeclarations(rule.declarations, rule.selector || 'unknown', rule.id, ir.diagnostics);
        rule.declarations = result.pruned;
        totalChanges += result.changesCount;
        totalBytesSaved += result.bytesSavedCount;
      }

      // 2. Optimize nested pseudo-class structural layers
      if ((rule as any).pseudoClasses) {
        for (const pc of (rule as any).pseudoClasses) {
          if (pc.declarations) {
            const contextName = `${rule.selector || ''}:${pc.name}`;
            const result = pruneDuplicateDeclarations(pc.declarations, contextName, pc.id || rule.id, ir.diagnostics);
            pc.declarations = result.pruned;
            totalChanges += result.changesCount;
            totalBytesSaved += result.bytesSavedCount;
          }
        }
      }

      // 3. Optimize isolated conditional at-rules blocks
      if (rule.atRules) {
        for (const at of rule.atRules) {
          if (at.declarations) {
            const contextName = `@${at.type} ${at.query || ''} -> ${rule.selector || ''}`;
            const result = pruneDuplicateDeclarations(at.declarations, contextName, rule.id, ir.diagnostics);
            at.declarations = result.pruned;
            totalChanges += result.changesCount;
            totalBytesSaved += result.bytesSavedCount;
          }
        }
      }
    }

    if (totalChanges > 0) {
      ir.diagnostics.push({
        id: `dup-decl-summary-${Date.now()}`,
        nodeId: ir.id,
        severity: 'info',
        message: `Duplicate declaration detector: successfully cleaned up ${totalChanges} redundant overrides, saving ~${totalBytesSaved} bytes.`,
        pass: 'duplicate-declaration-detector',
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: totalChanges,
        bytesSaved: totalBytesSaved,
      },
      changes: totalChanges,
    };
  },
};