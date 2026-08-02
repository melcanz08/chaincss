// ============================================================================
// FILE: src/compiler/pipeline/optimizers/media-query-packer.ts
// ============================================================================
// Graph-based media query packer. Deduplicates + sorts queries via AST comparison.

import type { StyleIR, IRRule, IRAtRule } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import type { CSSValueNode } from "../ir/css-ast.js";
import { astEqual } from "../ir/css-ast.js";

// ============================================================================
// Query Sorting
// ============================================================================

function sortQueries(queries: string[]): string[] {
  return queries.sort((a, b) => {
    const aMin = extractPx(a, "min-width");
    const bMin = extractPx(b, "min-width");
    if (aMin !== null && bMin !== null) return aMin - bMin;
    if (aMin !== null) return -1;
    if (bMin !== null) return 1;
    const aMax = extractPx(a, "max-width");
    const bMax = extractPx(b, "max-width");
    if (aMax !== null && bMax !== null) return bMax - aMax;
    return a.localeCompare(b);
  });
}

function extractPx(query: string, prop: string): number | null {
  const match = query.match(
    new RegExp(`\\(${prop}:\\s*(\\d+(?:\\.\\d+)?)(px|em|rem)\\)`),
  );
  if (!match) return null;
  const val = parseFloat(match[1]);
  const unit = match[2];
  if (unit === "px") return val;
  if (unit === "rem") return val * 16;
  return val * 16;
}

// ============================================================================
// AST-Based Deduplication
// ============================================================================

/**
 * Compare two at-rules for semantic equality using AST comparison.
 * Two media queries are identical if:
 * - Same type and query string
 * - Same number of declarations
 * - All declarations match by property AND AST-equal values
 */
function atRulesEqual(a: IRAtRule, b: IRAtRule): boolean {
  if (a.type !== b.type) return false;
  if (a.query !== b.query) return false;

  const declsA = a.declarations || [];
  const declsB = b.declarations || [];
  if (declsA.length !== declsB.length) return false;

  // Sort both by property for order-independent comparison
  const sortedA = [...declsA].sort((x, y) =>
    x.property.localeCompare(y.property),
  );
  const sortedB = [...declsB].sort((x, y) =>
    x.property.localeCompare(y.property),
  );

  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i].property !== sortedB[i].property) return false;

    // Prefer AST comparison when available, fall back to string
    const astA = (sortedA[i].meta as any)?.ast as CSSValueNode | undefined;
    const astB = (sortedB[i].meta as any)?.ast as CSSValueNode | undefined;

    if (astA && astB) {
      if (!astEqual(astA, astB)) return false;
    } else if (String(sortedA[i].value) !== String(sortedB[i].value)) {
      return false;
    }
  }

  return true;
}

function deduplicateAtRules(rules: IRRule[]): number {
  let merged = 0;

  for (const rule of rules) {
    if (rule.isDead || !rule.atRules) continue;

    const uniqueAtRules: IRAtRule[] = [];

    for (const atRule of rule.atRules || []) {
      if (atRule.type !== "media") {
        uniqueAtRules.push(atRule);
        continue;
      }

      // Use AST comparison to detect duplicates
      const isDuplicate = uniqueAtRules.some(
        (existing) =>
          existing.type === "media" && atRulesEqual(existing, atRule),
      );

      if (isDuplicate) {
        merged++;
        continue;
      }

      uniqueAtRules.push(atRule);
    }

    if (uniqueAtRules.length < rule.atRules.length) {
      rule.atRules = uniqueAtRules;
    }
  }

  return merged;
}

// ============================================================================
// At-Rule Sorting
// ============================================================================

function sortAtRules(rules: IRRule[]): number {
  let sorted = 0;

  for (const rule of rules) {
    if (rule.isDead || !rule.atRules) continue;

    const mediaAtRules = rule.atRules.filter(
      (a) => a.type === "media" && a.query,
    );
    if (mediaAtRules.length < 2) continue;

    const nonMedia = rule.atRules.filter((a) => a.type !== "media" || !a.query);
    const sortedMedia = sortQueries(mediaAtRules.map((a) => a.query!)).map(
      (q) => mediaAtRules.find((a) => a.query === q)!,
    );

    rule.atRules = [...nonMedia, ...sortedMedia];
    sorted++;
  }

  return sorted;
}

// ============================================================================
// Pass Definition
// ============================================================================

export const mediaQueryPacker: OptimizationPass = {
  name: "media-query-packer",
  cost: "cheap",
  requiredFor: ["css", "atomic-css"],

  optimize(ir: StyleIR): OptimizationResult {
    if (!ir?.rules) {
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

    const merged = deduplicateAtRules(ir.rules);
    const sorted = sortAtRules(ir.rules);
    const bytesSaved = merged * 120;

    if (merged + sorted > 0) {
      ir.diagnostics.push({
        id: `mqp-${ir.id}`,
        nodeId: ir.id,
        severity: "info",
        message: `Media query packer: merged ${merged} duplicates via AST comparison, sorted ${sorted} groups.`,
        pass: "media-query-packer",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: merged,
        bytesSaved,
      },
      changes: merged + sorted,
    };
  },
};
