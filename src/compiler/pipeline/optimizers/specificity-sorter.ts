// ============================================================================
// FILE: src/compiler/pipeline/optimizers/specificity-sorter.ts
// ============================================================================

import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import { recordHistory } from "../ir/utils.js";

type SpecificityTuple = [number, number, number];

// WeakMap cache to memoize specificity tuples per IRRule instance
const specificityCache = new WeakMap<IRRule, SpecificityTuple>();

/**
 * Compares two specificity tuples [A, B, C].
 * Returns negative if x < y, positive if x > y, 0 if equal.
 */
function compareSpecificity(x: SpecificityTuple, y: SpecificityTuple): number {
  if (x[0] !== y[0]) return x[0] - y[0];
  if (x[1] !== y[1]) return x[1] - y[1];
  return x[2] - y[2];
}

/**
 * Parses and computes specificity for a single (non-comma-separated) selector branch.
 */
function calculateSingleSelectorSpecificity(selector: string): SpecificityTuple {
  let a = 0; // IDs
  let b = 0; // Classes, attributes, pseudo-classes
  let c = 0; // Elements, pseudo-elements

  let workStr = selector.trim();
  if (!workStr) return [0, 0, 0];

  // 1. Extract and score attributes `[...]`, replacing with placeholders to avoid string collisions
  workStr = workStr.replace(/\[[^\]]+\]/g, () => {
    b++;
    return " __ATTR_PLACEHOLDER__ ";
  });

  // 2. Process functional pseudo-classes: :where(), :is(), :not(), :has()
  const functionalPseudoRegex = /:(where|is|not|has)\(([^()]+(?:\([^()]*\))*[^()]*)\)/gi;
  workStr = workStr.replace(functionalPseudoRegex, (_, name: string, args: string) => {
    const fnName = name.toLowerCase();

    if (fnName === "where") {
      return " "; // :where() contributes [0, 0, 0]
    }

    if (fnName === "is" || fnName === "not" || fnName === "has") {
      // Takes the specificity of its most specific argument
      const argTuple = calculateSelectorSpecificity(args);
      a += argTuple[0];
      b += argTuple[1];
      c += argTuple[2];
      return " ";
    }

    return " ";
  });

  // 3. Match and score Pseudo-elements (::before, ::after, legacy :before, :after)
  const legacyPseudoElements = [":before", ":after", ":first-line", ":first-letter"];
  workStr = workStr.replace(/::[a-zA-Z0-9_-]+/g, () => {
    c++;
    return " ";
  });

  // 4. Match and score standard Pseudo-classes (:hover, :focus, etc.)
  workStr = workStr.replace(/:[a-zA-Z0-9_-]+/g, (match) => {
    if (legacyPseudoElements.includes(match.toLowerCase())) {
      c++;
    } else {
      b++;
    }
    return " ";
  });

  // 5. Match and score IDs (#id)
  workStr = workStr.replace(/#[a-zA-Z0-9_-]+/g, () => {
    a++;
    return " ";
  });

  // 6. Match and score Classes (.class)
  workStr = workStr.replace(/\.[a-zA-Z0-9_-]+/g, () => {
    b++;
    return " ";
  });

  // 7. Tokenize remaining words for element/tag matches
  const tokens = workStr
    .replace(/__ATTR_PLACEHOLDER__/g, " ")
    .replace(/[*=+~^$|>]/g, " ")
    .split(/\s+/);

  for (const token of tokens) {
    const cleanToken = token.trim();
    if (
      cleanToken &&
      cleanToken !== "*" &&
      /^[a-zA-Z0-9_-]+$/.test(cleanToken) &&
      !/^[0-9]+$/.test(cleanToken)
    ) {
      c++;
    }
  }

  return [a, b, c];
}

/**
 * Calculates specificity tuple [A, B, C] for a selector string.
 * Supports comma-separated selector lists by returning the maximum specificity branch.
 */
function calculateSelectorSpecificity(selector: string): SpecificityTuple {
  if (!selector || !selector.trim()) return [0, 0, 0];

  // Split comma-separated selector lists while respecting parentheses
  const branches: string[] = [];
  let currentBranch = "";
  let parenDepth = 0;

  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;

    if (char === "," && parenDepth === 0) {
      branches.push(currentBranch);
      currentBranch = "";
    } else {
      currentBranch += char;
    }
  }
  if (currentBranch) branches.push(currentBranch);

  let maxTuple: SpecificityTuple = [0, 0, 0];

  for (const branch of branches) {
    const tuple = calculateSingleSelectorSpecificity(branch);
    if (compareSpecificity(tuple, maxTuple) > 0) {
      maxTuple = tuple;
    }
  }

  return maxTuple;
}

/**
 * Gets cached specificity or computes and caches it safely.
 */
function getOrComputeSpecificity(rule: IRRule): SpecificityTuple {
  let cached = specificityCache.get(rule);
  if (cached) return cached;

  const tuple = calculateSelectorSpecificity(rule.selector || "");
  specificityCache.set(rule, tuple);
  return tuple;
}

/**
 * Recursively sorts IR rules by specificity while maintaining stable relative ordering.
 */
function sortRuleTree(
  rules: IRRule[],
  passName: string
): { sortedRules: IRRule[]; changes: number } {
  let changes = 0;

  // Process nested rules and at-rules recursively first
  for (const rule of rules) {
    if (rule.nestedRules && rule.nestedRules.length > 1) {
      const res = sortRuleTree(rule.nestedRules, passName);
      rule.nestedRules = res.sortedRules;
      changes += res.changes;
    }

    if (rule.atRules) {
      for (const atRule of rule.atRules as any[]) {
        if (atRule.rules && atRule.rules.length > 1) {
          const res = sortRuleTree(atRule.rules, passName);
          atRule.rules = res.sortedRules;
          changes += res.changes;
        }
      }
    }
  }

  // Map rules with initial index for stable sort comparison
  const mapped = rules.map((rule, index) => ({
    rule,
    specificity: getOrComputeSpecificity(rule),
    originalIndex: index,
  }));

  mapped.sort((a, b) => {
    const diff = compareSpecificity(a.specificity, b.specificity);
    if (diff !== 0) return diff;
    return a.originalIndex - b.originalIndex;
  });

  let orderChanged = false;
  const sortedRules = mapped.map((item, newIndex) => {
    if (item.originalIndex !== newIndex) {
      orderChanged = true;
    }
    // Maintain specificity metadata on the rule safely
    item.rule.specificity = item.specificity as any;
    return item.rule;
  });

  if (orderChanged) {
    changes++;
    for (const rule of sortedRules) {
      recordHistory(
        rule as any,
        passName,
        "reordered-by-specificity",
        undefined,
        `Sorted rule "${rule.selector}" by specificity`
      );
    }
  }

  return { sortedRules, changes };
}

// ============================================================================
// Pass Definition
// ============================================================================

export const specificitySorter: OptimizationPass = {
  name: "specificity-sorter",
  cost: "cheap",
  requiredFor: ["css", "atomic-css"],

  optimize(ir: StyleIR): OptimizationResult {
    const rules = ir?.rules;
    if (!rules || rules.length === 0) {
      return {
        ir,
        savings: {
          rulesEliminated: 0,
          declarationsEliminated: 0,
          bytesSaved: 0,
        },
        changes: 0,
      };
    }

    if (!ir.diagnostics) {
      ir.diagnostics = [];
    }

    const { sortedRules, changes } = sortRuleTree(rules, "specificity-sorter");
    ir.rules = sortedRules;

    if (changes > 0) {
      ir.diagnostics.push({
        id: `spec-sort-${ir.id || "root"}-${Date.now()}`,
        nodeId: ir.id || "root",
        severity: "info",
        message: `Specificity sorter: reordered ${changes} rule groups by selector specificity tuple.`,
        pass: "specificity-sorter",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved: 0,
      },
      changes,
    };
  },
};