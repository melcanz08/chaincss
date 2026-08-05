// ============================================================================
// FILE: src/compiler/pipeline/optimizers/media-query-packer.ts
// ============================================================================
// Graph-based media query packer. Deduplicates, merges, and sorts queries via AST comparison.

import type { StyleIR, IRRule, IRAtRule, IRDeclaration } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import type { CSSValueNode } from "../ir/css-ast.js";
import { astEqual } from "../ir/css-ast.js";
import { recordHistory } from "../ir/utils.js";

// ============================================================================
// Query Parsing & Sorting
// ============================================================================

interface QueryMetrics {
  minWidth: number | null;
  maxWidth: number | null;
  hasHover: boolean;
  raw: string;
}

/**
 * Extracts numeric pixel equivalents for min-width and max-width conditions,
 * supporting standard syntax and Media Queries Level 4 range syntax.
 */
function extractPx(query: string, prop: "min-width" | "max-width"): number | null {
  const normalized = query.toLowerCase();

  // Standard syntax: (min-width: 768px)
  const standardRegex = new RegExp(
    `\\(${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)(px|em|rem|vw|vh|dvh|cqw)\\)`
  );
  const match = normalized.match(standardRegex);
  if (match) {
    return parseValueToPx(parseFloat(match[1]), match[2]);
  }

  // Range syntax: (width >= 768px) or (768px <= width)
  if (prop === "min-width") {
    const minRangeRegex = /(?:width\s*>=\s*|(\d+(?:\.\d+)?)(px|em|rem)\s*<=\s*width)(\d+(?:\.\d+)?)(px|em|rem)?/;
    const rangeMatch = normalized.match(minRangeRegex);
    if (rangeMatch) {
      const val = parseFloat(rangeMatch[3] || rangeMatch[1]);
      const unit = rangeMatch[4] || rangeMatch[2] || "px";
      return parseValueToPx(val, unit);
    }
  }

  if (prop === "max-width") {
    const maxRangeRegex = /(?:width\s*<=\s*|(\d+(?:\.\d+)?)(px|em|rem)\s*>=\s*width)(\d+(?:\.\d+)?)(px|em|rem)?/;
    const rangeMatch = normalized.match(maxRangeRegex);
    if (rangeMatch) {
      const val = parseFloat(rangeMatch[3] || rangeMatch[1]);
      const unit = rangeMatch[4] || rangeMatch[2] || "px";
      return parseValueToPx(val, unit);
    }
  }

  return null;
}

function parseValueToPx(value: number, unit: string): number {
  switch (unit) {
    case "px":
      return value;
    case "rem":
    case "em":
      return value * 16;
    case "vw":
    case "cqw":
      return value * 10; // Normalized approximation for sorting
    default:
      return value;
  }
}

/**
 * Stable sort for media query at-rules. Preserves relative ordering when
 * query metrics are equivalent to uphold CSS cascade semantics.
 */
function sortMediaAtRules(atRules: IRAtRule[]): { sorted: IRAtRule[]; changed: boolean } {
  if (atRules.length < 2) return { sorted: atRules, changed: false };

  const indexed = atRules.map((rule, index) => {
    const q = rule.query || "";
    return {
      rule,
      originalIndex: index,
      metrics: {
        minWidth: extractPx(q, "min-width"),
        maxWidth: extractPx(q, "max-width"),
        raw: q,
      },
    };
  });

  indexed.sort((a, b) => {
    // 1. Mobile-first: Sort ascending by min-width
    if (a.metrics.minWidth !== null && b.metrics.minWidth !== null) {
      if (a.metrics.minWidth !== b.metrics.minWidth) {
        return a.metrics.minWidth - b.metrics.minWidth;
      }
    } else if (a.metrics.minWidth !== null) {
      return -1;
    } else if (b.metrics.minWidth !== null) {
      return 1;
    }

    // 2. Desktop-first fallback: Sort descending by max-width
    if (a.metrics.maxWidth !== null && b.metrics.maxWidth !== null) {
      if (a.metrics.maxWidth !== b.metrics.maxWidth) {
        return b.metrics.maxWidth - a.metrics.maxWidth;
      }
    }

    // 3. Preserve original DOM / source order to maintain cascade safety
    return a.originalIndex - b.originalIndex;
  });

  let changed = false;
  const sorted = indexed.map((item, newIndex) => {
    if (item.originalIndex !== newIndex) changed = true;
    return item.rule;
  });

  return { sorted, changed };
}

// ============================================================================
// Declaration & At-Rule Merging
// ============================================================================

function declarationEquals(a: IRDeclaration, b: IRDeclaration): boolean {
  if (a.property.toLowerCase().trim() !== b.property.toLowerCase().trim()) {
    return false;
  }

  const astA = (a.meta as any)?.ast as CSSValueNode | undefined;
  const astB = (b.meta as any)?.ast as CSSValueNode | undefined;

  if (astA && astB) {
    return astEqual(astA, astB);
  }

  return String(a.value).trim() === String(b.value).trim();
}

/**
 * Merges declaration lists, eliminating exact duplicates while preserving
 * declaration order for fallbacks and cascade overrides.
 */
function mergeDeclarations(
  target: IRDeclaration[],
  source: IRDeclaration[]
): { merged: IRDeclaration[]; bytesSaved: number } {
  let bytesSaved = 0;
  const result = [...target];

  for (const srcDecl of source) {
    const existingIdx = result.findIndex(
      (d) => d.property.toLowerCase().trim() === srcDecl.property.toLowerCase().trim()
    );

    if (existingIdx !== -1) {
      const existingDecl = result[existingIdx];
      if (declarationEquals(existingDecl, srcDecl)) {
        // Exact duplicate declaration in identical media query scope
        bytesSaved += String(srcDecl.property).length + String(srcDecl.value).length + 4;
        continue;
      }
      // Override existing declaration value while updating position
      result.splice(existingIdx, 1);
    }

    result.push(srcDecl);
  }

  return { merged: result, bytesSaved };
}

/**
 * Merges duplicate media queries within a single rule context.
 */
function consolidateAtRules(
  atRules: IRAtRule[],
  passName: string
): { consolidated: IRAtRule[]; mergedCount: number; bytesSaved: number } {
  let mergedCount = 0;
  let bytesSaved = 0;
  const consolidated: IRAtRule[] = [];
  const queryIndexMap = new Map<string, number>();

  for (const current of atRules) {
    if (current.type !== "media" || !current.query) {
      consolidated.push(current);
      continue;
    }

    const normalizedQuery = current.query.toLowerCase().trim();
    const existingIdx = queryIndexMap.get(normalizedQuery);

    if (existingIdx !== undefined) {
      const targetAtRule = consolidated[existingIdx];
      const targetDecls = targetAtRule.declarations || [];
      const sourceDecls = current.declarations || [];

      const { merged, bytesSaved: saved } = mergeDeclarations(targetDecls, sourceDecls);
      
      // Account for removed media query wrapper bytes
      bytesSaved += saved + normalizedQuery.length + 9; // "@media ()"
      targetAtRule.declarations = merged;
      mergedCount++;

      recordHistory(
        targetAtRule as any,
        passName,
        "merged-media-query",
        undefined,
        `Consolidated media query "${current.query}"`
      );
    } else {
      consolidated.push(current);
      queryIndexMap.set(normalizedQuery, consolidated.length - 1);
    }
  }

  return { consolidated, mergedCount, bytesSaved };
}

// ============================================================================
// Recursive IR Traversal
// ============================================================================

function processRule(
  rule: IRRule,
  passName: string
): { merged: number; sorted: number; bytesSaved: number } {
  let merged = 0;
  let sorted = 0;
  let bytesSaved = 0;

  if (rule.atRules && rule.atRules.length > 0) {
    // 1. Consolidate and merge identical media queries
    const consolidation = consolidateAtRules(rule.atRules, passName);
    rule.atRules = consolidation.consolidated;
    merged += consolidation.mergedCount;
    bytesSaved += consolidation.bytesSaved;

    // 2. Partition and sort media queries safely
    const mediaRules: IRAtRule[] = [];
    const nonMediaRules: IRAtRule[] = [];

    for (const at of rule.atRules) {
      if (at.type === "media" && at.query) {
        mediaRules.push(at);
      } else {
        nonMediaRules.push(at);
      }
    }

    if (mediaRules.length > 1) {
      const sortResult = sortMediaAtRules(mediaRules);
      if (sortResult.changed) {
        rule.atRules = [...nonMediaRules, ...sortResult.sorted];
        sorted++;
      }
    }
  }

  // Traverse nested rules
  if (rule.nestedRules) {
    for (const nested of rule.nestedRules) {
      if (nested && !nested.isDead) {
        const res = processRule(nested, passName);
        merged += res.merged;
        sorted += res.sorted;
        bytesSaved += res.bytesSaved;
      }
    }
  }

  return { merged, sorted, bytesSaved };
}

// ============================================================================
// Pass Definition
// ============================================================================

export const mediaQueryPacker: OptimizationPass = {
  name: "media-query-packer",
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

    let totalMerged = 0;
    let totalSorted = 0;
    let totalBytesSaved = 0;

    for (let i = 0, len = rules.length; i < len; i++) {
      const rule = rules[i];
      if (!rule || rule.isDead) continue;

      const res = processRule(rule, "media-query-packer");
      totalMerged += res.merged;
      totalSorted += res.sorted;
      totalBytesSaved += res.bytesSaved;
    }

    if (totalMerged + totalSorted > 0) {
      ir.diagnostics.push({
        id: `mqp-${ir.id || "root"}-${Date.now()}`,
        nodeId: ir.id || "root",
        severity: "info",
        message: `Media query packer: consolidated ${totalMerged} duplicate queries, sorted ${totalSorted} query groups (~${totalBytesSaved} bytes saved).`,
        pass: "media-query-packer",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: totalMerged,
        bytesSaved: totalBytesSaved,
      },
      changes: totalMerged + totalSorted,
    };
  },
};