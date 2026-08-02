// ============================================================================
// FILE: src/compiler/pipeline/optimizers/duplicate-declaration-detector.ts
// ============================================================================
// AST-based duplicate declaration detector. Uses semantic comparison via AST.

import type { StyleIR, IRDeclaration } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import type { CSSValueNode } from "../ir/css-ast.js";
import { astEqual } from "../ir/css-ast.js";

// Pre-allocated static set to avoid array creation inside fallback checks
const INTENTIONAL_DISPLAYS = new Set([
  "block",
  "inline",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
]);

function isIntentionalFallback(prev: string, next: string): boolean {
  const p = prev.toLowerCase();
  const n = next.toLowerCase();
  if (p === n) return false;
  if (
    (p.startsWith("#") || p.startsWith("rgb")) &&
    (n.includes("gradient") || n.includes("var(") || n.includes("oklab"))
  )
    return true;
  if (INTENTIONAL_DISPLAYS.has(p) && INTENTIONAL_DISPLAYS.has(n)) return true;
  return false;
}

function valuesEqual(a: IRDeclaration, b: IRDeclaration): boolean {
  const astA = (a.meta as any)?.ast as CSSValueNode | undefined;
  const astB = (b.meta as any)?.ast as CSSValueNode | undefined;
  if (astA && astB) return astEqual(astA, astB);
  return String(a.value) === String(b.value);
}

function pruneDuplicates(declarations: IRDeclaration[]): {
  pruned: IRDeclaration[];
  removed: number;
  bytesSaved: number;
} {
  if (!declarations || declarations.length === 0)
    return { pruned: declarations || [], removed: 0, bytesSaved: 0 };

  const pruned: IRDeclaration[] = [];
  const seen = new Map<string, number>();
  let removed = 0;
  let bytesSaved = 0;

  for (let i = 0, len = declarations.length; i < len; i++) {
    const decl = declarations[i];
    if (!decl || !decl.property) continue;

    const prevIdx = seen.get(decl.property);

    if (prevIdx !== undefined) {
      const prev = pruned[prevIdx];

      if (!isIntentionalFallback(String(prev.value), String(decl.value))) {
        const prevValStr = String(prev.value);
        const propStr = decl.property;
        if (valuesEqual(prev, decl)) {
          // Exact duplicate — remove
          removed++;
          bytesSaved += prevValStr.length + propStr.length + 4;
          continue;
        }
        // Override — replace previous
        removed++;
        bytesSaved += prevValStr.length + propStr.length + 4;
        pruned[prevIdx] = decl;
        continue;
      }
    }

    pruned.push(decl);
    seen.set(decl.property, pruned.length - 1);
  }

  return { pruned, removed, bytesSaved };
}

export const duplicateDeclarationDetector: OptimizationPass = {
  name: "duplicate-declaration-detector",
  cost: "cheap",
  requiredFor: ["css"],

  optimize(ir: StyleIR): OptimizationResult {
    let totalRemoved = 0;
    let totalBytes = 0;

    const rules = ir?.rules;
    if (!rules)
      return {
        ir,
        savings: {
          rulesEliminated: 0,
          declarationsEliminated: 0,
          bytesSaved: 0,
        },
        changes: 0,
      };

    for (let i = 0, len = rules.length; i < len; i++) {
      const rule = rules[i];
      if (!rule || rule.isDead) continue;

      if (rule.declarations) {
        const r = pruneDuplicates(rule.declarations);
        rule.declarations = r.pruned;
        totalRemoved += r.removed;
        totalBytes += r.bytesSaved;
      }

      const pseudoClasses = rule.pseudoClasses;
      if (pseudoClasses) {
        for (let j = 0, jLen = pseudoClasses.length; j < jLen; j++) {
          const pc = pseudoClasses[j];
          if (!pc || !pc.declarations) continue;
          const p = pruneDuplicates(pc.declarations);
          pc.declarations = p.pruned;
          totalRemoved += p.removed;
          totalBytes += p.bytesSaved;
        }
      }

      const atRules = rule.atRules;
      if (atRules) {
        for (let k = 0, kLen = atRules.length; k < kLen; k++) {
          const at = atRules[k];
          if (!at || !at.declarations) continue;
          const a = pruneDuplicates(at.declarations);
          at.declarations = a.pruned;
          totalRemoved += a.removed;
          totalBytes += a.bytesSaved;
        }
      }
    }

    if (totalRemoved > 0) {
      if (!ir.diagnostics) {
        ir.diagnostics = [];
      }
      ir.diagnostics.push({
        id: `dup-${ir.id || "root"}`,
        nodeId: ir.id || "root",
        severity: "info",
        message: `Removed ${totalRemoved} duplicate declarations (~${totalBytes} bytes).`,
        pass: "duplicate-declaration-detector",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: totalRemoved,
        bytesSaved: totalBytes,
      },
      changes: totalRemoved,
    };
  },
};
