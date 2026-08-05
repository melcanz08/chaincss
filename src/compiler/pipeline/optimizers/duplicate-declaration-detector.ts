// ============================================================================
// FILE: src/compiler/pipeline/optimizers/duplicate-declaration-detector.ts
// ============================================================================
// AST-based duplicate declaration detector. Uses semantic comparison via AST.

import type { StyleIR, IRRule, IRDeclaration } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import type { CSSValueNode } from "../ir/css-ast.js";
import { astEqual } from "../ir/css-ast.js";
import { recordHistory } from "../ir/utils.js";

// Comprehensive display values for vendor and modern fallback detection
const INTENTIONAL_DISPLAYS = new Set([
  "block",
  "inline",
  "inline-block",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
  "flow-root",
  "contents",
  "subgrid",
  "table",
  "table-row",
  "table-cell",
  "-webkit-box",
  "-webkit-flex",
  "-ms-flexbox",
]);

// Patterns indicating modern CSS features, functions, or vendor prefixes
const FALLBACK_VALUE_PATTERNS = [
  "var(",
  "calc(",
  "clamp(",
  "min(",
  "max(",
  "env(",
  "color-mix(",
  "light-dark(",
  "image-set(",
  "oklab(",
  "oklch(",
  "lab(",
  "lch(",
  "color(",
  "gradient(",
  "-webkit-",
  "-moz-",
  "-ms-",
  "-o-",
];

const MODERN_VIEWPORT_UNITS = ["dvh", "svh", "lvh", "dvw", "svw", "lvw", "cqw", "cqh"];

/**
 * Checks whether a declaration carries an !important flag.
 */
function isImportant(decl: IRDeclaration): boolean {
  if (decl.important) return true;
  return typeof decl.value === "string" && decl.value.includes("!important");
}

/**
 * Determines if two property values represent an intentional CSS fallback cascade.
 */
function isIntentionalFallback(prevVal: string, nextVal: string): boolean {
  const p = prevVal.toLowerCase().trim();
  const n = nextVal.toLowerCase().trim();

  if (p === n) return false;

  // Vendor display or modern layout fallbacks
  if (INTENTIONAL_DISPLAYS.has(p) && INTENTIONAL_DISPLAYS.has(n)) {
    return true;
  }

  // Color & unit format progressive enhancements (e.g. hex -> oklch / var / gradient)
  if (
    (p.startsWith("#") || p.startsWith("rgb") || p.startsWith("hsl")) &&
    (FALLBACK_VALUE_PATTERNS.some((pat) => n.includes(pat)))
  ) {
    return true;
  }

  // Modern CSS functions or vendor prefixes in value
  if (
    FALLBACK_VALUE_PATTERNS.some((pat) => n.includes(pat)) &&
    !FALLBACK_VALUE_PATTERNS.some((pat) => p.includes(pat))
  ) {
    return true;
  }

  // Modern viewport / container query unit fallbacks (e.g., 100vh -> 100dvh)
  if (
    MODERN_VIEWPORT_UNITS.some((unit) => n.includes(unit)) &&
    !MODERN_VIEWPORT_UNITS.some((unit) => p.includes(unit))
  ) {
    return true;
  }

  return false;
}

/**
 * AST semantic equality or string value comparison.
 */
function valuesEqual(a: IRDeclaration, b: IRDeclaration): boolean {
  const astA = (a.meta as any)?.ast as CSSValueNode | undefined;
  const astB = (b.meta as any)?.ast as CSSValueNode | undefined;

  if (astA && astB) {
    return astEqual(astA, astB);
  }

  const valA = String(a.value || "").trim().replace(/\s*!important$/i, "");
  const valB = String(b.value || "").trim().replace(/\s*!important$/i, "");
  return valA === valB;
}

/**
 * Calculates byte size of a declaration for accurate optimization metrics.
 */
function estimateDeclarationBytes(decl: IRDeclaration): number {
  const propLen = String(decl.property || "").length;
  const valLen = String(decl.value || "").length;
  const importantLen = isImportant(decl) ? 12 : 0;
  return propLen + valLen + importantLen + 3; // "prop: val;"
}

/**
 * Prunes duplicate or overridden declarations while preserving fallbacks and !important semantics.
 */
function pruneDuplicates(
  declarations: IRDeclaration[],
  passName: string
): {
  pruned: IRDeclaration[];
  removed: number;
  bytesSaved: number;
} {
  if (!declarations || declarations.length === 0) {
    return { pruned: declarations || [], removed: 0, bytesSaved: 0 };
  }

  const pruned: IRDeclaration[] = [];
  const seen = new Map<string, number>();
  let removed = 0;
  let bytesSaved = 0;

  for (let i = 0, len = declarations.length; i < len; i++) {
    const decl = declarations[i];
    if (!decl || !decl.property) continue;

    const propKey = decl.property.toLowerCase().trim();
    const prevIdx = seen.get(propKey);

    if (prevIdx !== undefined) {
      const prev = pruned[prevIdx];
      const prevImp = isImportant(prev);
      const currImp = isImportant(decl);

      // Rule 1: Previous has !important, current does NOT -> Current cannot override
      if (prevImp && !currImp) {
        removed++;
        bytesSaved += estimateDeclarationBytes(decl);
        continue;
      }

      const prevValStr = String(prev.value || "");
      const currValStr = String(decl.value || "");

      // Rule 2: Preserve intentional browser fallbacks (unless both values are identical)
      if (!prevImp && !currImp && isIntentionalFallback(prevValStr, currValStr)) {
        pruned.push(decl);
        seen.set(propKey, pruned.length - 1);
        continue;
      }

      // Rule 3: Exact value duplicate
      if (prevImp === currImp && valuesEqual(prev, decl)) {
        removed++;
        bytesSaved += estimateDeclarationBytes(decl);
        recordHistory(
          decl as any,
          passName,
          "removed-duplicate-declaration",
          undefined,
          `Pruned duplicate declaration "${decl.property}: ${decl.value}"`
        );
        continue;
      }

      // Rule 4: Valid override (Current replaces Previous)
      removed++;
      bytesSaved += estimateDeclarationBytes(prev);
      recordHistory(
        prev as any,
        passName,
        "overridden-declaration",
        undefined,
        `Replaced "${prev.property}: ${prev.value}" with "${decl.property}: ${decl.value}"`
      );

      pruned[prevIdx] = decl;
      continue;
    }

    pruned.push(decl);
    seen.set(propKey, pruned.length - 1);
  }

  return { pruned, removed, bytesSaved };
}

/**
 * Recursively traverses rules, pseudo-classes, nested rules, and at-rules.
 */
function processRule(
  rule: IRRule,
  passName: string
): { removed: number; bytesSaved: number } {
  let removed = 0;
  let bytesSaved = 0;

  if (rule.declarations) {
    const res = pruneDuplicates(rule.declarations, passName);
    rule.declarations = res.pruned;
    removed += res.removed;
    bytesSaved += res.bytesSaved;
  }

  if (rule.pseudoClasses) {
    for (const pc of rule.pseudoClasses) {
      if (pc?.declarations) {
        const res = pruneDuplicates(pc.declarations, passName);
        pc.declarations = res.pruned;
        removed += res.removed;
        bytesSaved += res.bytesSaved;
      }
    }
  }

  if (rule.nestedRules) {
    for (const nested of rule.nestedRules) {
      if (nested && !nested.isDead) {
        const res = processRule(nested, passName);
        removed += res.removed;
        bytesSaved += res.bytesSaved;
      }
    }
  }

  if (rule.atRules) {
    for (const at of rule.atRules as any[]) {
      if (!at || at.isDead) continue;

      if (at.declarations) {
        const res = pruneDuplicates(at.declarations, passName);
        at.declarations = res.pruned;
        removed += res.removed;
        bytesSaved += res.bytesSaved;
      }

      if (at.nestedRules) {
        for (const sub of at.nestedRules) {
          if (sub && !sub.isDead) {
            const res = processRule(sub, passName);
            removed += res.removed;
            bytesSaved += res.bytesSaved;
          }
        }
      }
    }
  }

  return { removed, bytesSaved };
}

export const duplicateDeclarationDetector: OptimizationPass = {
  name: "duplicate-declaration-detector",
  cost: "cheap",
  requiredFor: ["css"],

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

    let totalRemoved = 0;
    let totalBytesSaved = 0;

    for (let i = 0, len = rules.length; i < len; i++) {
      const rule = rules[i];
      if (!rule || rule.isDead) continue;

      const res = processRule(rule, "duplicate-declaration-detector");
      totalRemoved += res.removed;
      totalBytesSaved += res.bytesSaved;
    }

    if (totalRemoved > 0) {
      ir.diagnostics.push({
        id: `dup-${ir.id || "root"}-${Date.now()}`,
        nodeId: ir.id || "root",
        severity: "info",
        message: `Duplicate declaration detector: removed ${totalRemoved} redundant declarations (~${totalBytesSaved} bytes saved).`,
        pass: "duplicate-declaration-detector",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: totalRemoved,
        bytesSaved: totalBytesSaved,
      },
      changes: totalRemoved,
    };
  },
};