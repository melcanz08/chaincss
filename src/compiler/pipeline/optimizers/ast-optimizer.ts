// ============================================================================
// FILE: src/compiler/pipeline/optimizers/ast-optimizer.ts
// Converts ParsedValue to AST and runs algebraic optimization
// ============================================================================

import type { StyleIR, IRRule, IRDeclaration } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import {
  parseCSSValue,
  optimizeAST,
  printAST,
} from "../ir/css-ast.js";
import { recordHistory } from "../ir/utils.js";

// Pre-compiled regexes for fast-path exclusion
const REGEX_KEYWORDS = /^[a-zA-Z-]+$/;
const REGEX_NUMBERS = /^-?\d+(\.\d+)?$/;
const REGEX_DIMENSIONS = /^-?\d+(\.\d+)?[a-zA-Z%]+$/;
const REGEX_HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/**
 * AST Optimizer pass.
 * Converts declaration values to AST, runs algebraic optimization,
 * and writes the optimized value back.
 */
export const astOptimizer: OptimizationPass = {
  name: "ast-optimizer",
  cost: "cheap",
  requiredFor: ["css", "atomic-css", "component", "sourcemap"],

  optimize(ir: StyleIR, _context?: any): OptimizationResult {
    let changes = 0;
    let bytesSaved = 0;

    const processDeclaration = (decl: IRDeclaration) => {
      const result = optimizeDeclaration(decl);
      if (result.changed) {
        changes++;
        bytesSaved += result.bytesSaved;
      }
    };

    const rules = ir?.rules;
    if (rules) {
      for (let i = 0, len = rules.length; i < len; i++) {
        const rule = rules[i];
        if (rule && !rule.isDead) {
          visitRuleDeclarations(rule, processDeclaration);
        }
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

/**
 * Recursively visits all declarations within a rule, including pseudo-classes,
 * at-rules, and nested rules.
 */
function visitRuleDeclarations(
  rule: IRRule,
  visitor: (decl: IRDeclaration) => void,
): void {
  if (!rule || rule.isDead) return;

  // 1. Base Declarations
  if (rule.declarations) {
    for (let i = 0, len = rule.declarations.length; i < len; i++) {
      const decl = rule.declarations[i];
      if (decl) visitor(decl);
    }
  }

  // 2. Pseudo Classes
  if (rule.pseudoClasses) {
    for (let i = 0, len = rule.pseudoClasses.length; i < len; i++) {
      const pcDecls = rule.pseudoClasses[i]?.declarations;
      if (pcDecls) {
        for (let j = 0, jLen = pcDecls.length; j < jLen; j++) {
          const decl = pcDecls[j];
          if (decl) visitor(decl);
        }
      }
    }
  }

  // 3. At-Rules
  if (rule.atRules) {
    for (let i = 0, len = rule.atRules.length; i < len; i++) {
      const atRule = rule.atRules[i];
      if (!atRule) continue;

      if (atRule.declarations) {
        for (let j = 0, jLen = atRule.declarations.length; j < jLen; j++) {
          const decl = atRule.declarations[j];
          if (decl) visitor(decl);
        }
      }

      if (atRule.nestedRules) {
        for (let j = 0, jLen = atRule.nestedRules.length; j < jLen; j++) {
          const nested = atRule.nestedRules[j];
          if (nested) visitRuleDeclarations(nested, visitor);
        }
      }
    }
  }

  // 4. Nested Rules
  if (rule.nestedRules) {
    for (let i = 0, len = rule.nestedRules.length; i < len; i++) {
      const nested = rule.nestedRules[i];
      if (nested) visitRuleDeclarations(nested, visitor);
    }
  }
}

function optimizeDeclaration(decl: IRDeclaration): {
  changed: boolean;
  bytesSaved: number;
} {
  const val = decl.value;
  if (val == null) return { changed: false, bytesSaved: 0 };
  const originalValue = String(val).trim();

  // Fast-path guard to bypass unoptimizable static values
  if (!isOptimizable(originalValue)) {
    return { changed: false, bytesSaved: 0 };
  }

  try {
    // Build AST from string
    const ast = parseCSSValue(originalValue);

    // Run algebraic AST optimization
    const optimized = optimizeAST(ast);

    // Store the OPTIMIZED AST in metadata for downstream passes
    if (decl.meta) {
      (decl.meta as any).ast = optimized;
    }

    // Convert optimized AST back to CSS value string
    const newValue = printAST(optimized);

    // Commit changes whenever the printed output is simplified/changed
    if (newValue && newValue !== originalValue) {
      const saved = originalValue.length - newValue.length;
      decl.value = newValue;

      recordHistory(
        decl as any,
        "ast-optimizer",
        "optimized",
        originalValue,
        `Simplified expression: ${originalValue} → ${newValue}`,
      );

      return { changed: true, bytesSaved: Math.max(0, saved) };
    }

    return { changed: false, bytesSaved: 0 };
  } catch {
    // Fail gracefully on non-parseable or malformed CSS values
    return { changed: false, bytesSaved: 0 };
  }
}

function isOptimizable(value: string): boolean {
  // Fast skip for simple literals (keywords, numbers, single dimension lengths, hex colors)
  if (REGEX_KEYWORDS.test(value)) return false;
  if (REGEX_NUMBERS.test(value)) return false;
  if (REGEX_DIMENSIONS.test(value)) return false;
  if (REGEX_HEX_COLOR.test(value)) return false;

  // Must contain math functions, parens, CSS variables, or operators to be optimizable
  return (
    value.includes("(") ||
    value.includes("+") ||
    value.includes("-") ||
    value.includes("*") ||
    value.includes("/")
  );
}