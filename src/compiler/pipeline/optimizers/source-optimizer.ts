// ============================================================================
// FILE: src/compiler/pipeline/optimizers/source-optimizer.ts
// ============================================================================

import type { StyleIR, IRRule, IRDeclaration } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";

function stringifyDeclarations(decls: IRDeclaration[] | undefined): string {
  if (!decls) return "";
  return decls
    .map((d) => `${d.property}:${d.value}`)
    .sort()
    .join(";");
}

function computeRuleHash(rule: IRRule): string {
  const selector = rule.selector || "";
  const declString = stringifyDeclarations(rule.declarations);

  // Safely sort and normalize pseudo-classes to avoid compilation order variance
  const pseudoStr = (rule as any).pseudoClasses
    ? [...(rule as any).pseudoClasses]
        .map((p: any) => `${p.name}:${stringifyDeclarations(p.declarations)}`)
        .sort()
        .join(";")
    : "";

  // Safely sort and normalize nested media/container queries
  const atRuleStr = rule.atRules
    ? [...rule.atRules]
        .map(
          (a: any) =>
            `${a.type}:${a.query || ""}:${stringifyDeclarations(a.declarations)}`,
        )
        .sort()
        .join(";")
    : "";

  return `${selector}|${pseudoStr}|${atRuleStr}|${declString}`;
}

export const sourceOptimizer: OptimizationPass = {
  name: "source-optimizer",
  cost: "expensive",
  requiredFor: ["css"],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    let bytesSaved = 0;

    if (!ir || !ir.rules) {
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

    // Map to keep track of the most recent index for a given rule hash
    const seenHashes = new Map<string, number>();

    // Phase 1: Forward pass to flag identical prior rules while preserving cascade order
    for (let i = 0; i < ir.rules.length; i++) {
      const rule = ir.rules[i];
      if (rule.isDead) continue;

      const hash = computeRuleHash(rule);

      if (seenHashes.has(hash)) {
        const previousIndex = seenHashes.get(hash)!;
        const previousRule = ir.rules[previousIndex];

        // Instead of breaking cascade lines later, we safely kill the EARLIER redundant block
        previousRule.isDead = true;
        changes++;

        const approximateBytes =
          (rule.selector || "").length +
          stringifyDeclarations(rule.declarations).length +
          20;
        bytesSaved += approximateBytes;

        ir.diagnostics.push({
          id: `dup-rule-${previousRule.id}-${rule.id}`,
          nodeId: previousRule.id,
          severity: "info",
          message: `Duplicate rule "${rule.selector}" eliminated — overridden by identical subsequent block at index ${i}`,
          suggestion:
            "Consolidate redundant styles or combine shared definitions.",
          pass: "source-optimizer",
        });
      }

      // Always track the newest declaration instance to preserve progressive override chains
      seenHashes.set(hash, i);
    }

    if (changes > 0) {
      ir.diagnostics.push({
        id: `source-opt-summary-${Date.now()}`,
        nodeId: ir.id,
        severity: "info",
        message: `Source optimizer: eliminated ${changes} redundant rule blocks, recovering ~${bytesSaved} bytes`,
        pass: "source-optimizer",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: changes,
        declarationsEliminated: 0,
        bytesSaved,
      },
      changes,
    };
  },
};
