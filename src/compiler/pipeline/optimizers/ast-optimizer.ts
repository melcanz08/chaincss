// ============================================================================
// FILE: src/compiler/pipeline/optimizers/ast-optimizer.ts
// Converts ParsedValue to AST and runs algebraic optimization
// ============================================================================

import type { StyleIR, IRRule, IRDeclaration } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';
import { parseCSSValue, optimizeAST, printAST, isConstant } from '../ir/css-ast.js';

// Pre-compiled regex constants to prevent runtime re-compilation in loops
const REGEX_KEYWORDS = /^[a-zA-Z-]+$/;
const REGEX_NUMBERS = /^-?\d+(\.\d+)?$/;
const REGEX_HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/**
 * AST Optimizer pass.
 * Converts declaration values to AST, runs algebraic optimization,
 * and writes the optimized value back.
 */
export const astOptimizer: OptimizationPass = {
  name: 'ast-optimizer',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css', 'component', 'sourcemap'],

  optimize(ir: StyleIR, _context: any): OptimizationResult {
    let changes = 0;
    let bytesSaved = 0;

    function optimizeRule(rule: IRRule) {
      const decls = rule.declarations;
      if (decls) {
        for (let i = 0, len = decls.length; i < len; i++) {
          const decl = decls[i];
          if (!decl) continue;
          const result = optimizeDeclaration(decl);
          if (result.changed) {
            changes++;
            bytesSaved += result.bytesSaved;
          }
        }
      }

      const pseudoClasses = rule.pseudoClasses;
      if (pseudoClasses) {
        for (let i = 0, len = pseudoClasses.length; i < len; i++) {
          const pc = pseudoClasses[i];
          const pcDecls = pc?.declarations;
          if (!pcDecls) continue;
          for (let j = 0, jLen = pcDecls.length; j < jLen; j++) {
            const decl = pcDecls[j];
            if (!decl) continue;
            const result = optimizeDeclaration(decl);
            if (result.changed) {
              changes++;
              bytesSaved += result.bytesSaved;
            }
          }
        }
      }

      const atRules = rule.atRules;
      if (atRules) {
        for (let i = 0, len = atRules.length; i < len; i++) {
          const atRule = atRules[i];
          if (!atRule) continue;
          const atDecls = atRule.declarations;
          if (atDecls) {
            for (let j = 0, jLen = atDecls.length; j < jLen; j++) {
              const decl = atDecls[j];
              if (!decl) continue;
              const result = optimizeDeclaration(decl);
              if (result.changed) {
                changes++;
                bytesSaved += result.bytesSaved;
              }
            }
          }
          const nestedRules = atRule.nestedRules;
          if (nestedRules) {
            for (let j = 0, jLen = nestedRules.length; j < jLen; j++) {
              const nested = nestedRules[j];
              if (nested) optimizeRule(nested);
            }
          }
        }
      }

      const nestedRules = rule.nestedRules;
      if (nestedRules) {
        for (let i = 0, len = nestedRules.length; i < len; i++) {
          const nested = nestedRules[i];
          if (nested) optimizeRule(nested);
        }
      }
    }

    const rules = ir?.rules;
    if (rules) {
      for (let i = 0, len = rules.length; i < len; i++) {
        const rule = rules[i];
        if (!rule || rule.isDead) continue;
        optimizeRule(rule);
      }
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved,
      },
      changes,
    };
  },
};

function optimizeDeclaration(decl: IRDeclaration): { changed: boolean; bytesSaved: number } {
  const val = decl.value;
  if (val == null) return { changed: false, bytesSaved: 0 };
  const originalValue = String(val);
  
  // Skip if already optimized or not optimizable
  if (!isOptimizable(originalValue)) {
    return { changed: false, bytesSaved: 0 };
  }

  try {
    // Build AST from string
    const ast = parseCSSValue(originalValue);
    
    // Store AST in metadata for other passes if meta exists
    if (decl.meta) {
      (decl.meta as any).ast = ast;
    }

    // Run optimizer
    const optimized = optimizeAST(ast);

    // If AST is fully constant, we can simplify
    if (isConstant(optimized)) {
      const newValue = printAST(optimized);
      if (newValue !== originalValue) {
        const saved = originalValue.length - newValue.length;
        decl.value = newValue;
        if (!decl.history) {
          decl.history = [];
        }
        decl.history.push({
          pass: 'ast-optimizer',
          action: 'optimized',
          timestamp: Date.now(),
          previous: originalValue,
          reason: `Simplified: ${originalValue} → ${newValue}`,
        });
        return { changed: true, bytesSaved: Math.max(0, saved) };
      }
    }

    return { changed: false, bytesSaved: 0 };
  } catch {
    return { changed: false, bytesSaved: 0 };
  }
}

function isOptimizable(value: string): boolean {
  // Skip simple values (keywords, single numbers, hex colors)
  if (REGEX_KEYWORDS.test(value)) return false;
  if (REGEX_NUMBERS.test(value)) return false;
  if (REGEX_HEX_COLOR.test(value)) return false;
  
  // Optimize: calc(), var(), function(), space-separated lists
  return value.includes('calc(') || 
         value.includes('var(') || 
         value.includes('+') || 
         value.includes('-') ||
         value.includes('*') ||
         value.includes('/');
}