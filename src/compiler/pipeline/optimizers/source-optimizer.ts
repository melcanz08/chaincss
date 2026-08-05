// ============================================================================
// FILE: src/compiler/pipeline/optimizers/source-optimizer.ts
// ============================================================================

import type { StyleIR, IRRule, IRDeclaration } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import { recordHistory } from "../ir/utils.js";

/**
 * Normalizes property names to kebab-case for consistent hashing.
 */
function normalizeProp(prop: string): string {
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Stringifies declarations PRESERVING declaration order.
 * CSS order matters for fallbacks and internal property overrides.
 */
function stringifyDeclarations(decls: IRDeclaration[] | undefined): string {
  if (!decls || decls.length === 0) return "";

  const parts: string[] = [];
  for (let i = 0; i < decls.length; i++) {
    const d = decls[i];
    if (!d || d.property == null || d.value == null) continue;

    const prop = normalizeProp(String(d.property));
    const val = String(d.value).trim();
    const imp = d.important ? "!important" : "";

    parts.push(`${prop}:${val}${imp}`);
  }

  return parts.join(";");
}

/**
 * Computes a deterministic, deep structural hash for a rule block.
 */
function computeRuleHash(rule: IRRule): string {
  const selector = (rule.selector || "").trim();
  const declStr = stringifyDeclarations(rule.declarations);

  let pseudoStr = "";
  if (rule.pseudoClasses && rule.pseudoClasses.length > 0) {
    const parts: string[] = [];
    for (let i = 0; i < rule.pseudoClasses.length; i++) {
      const p = rule.pseudoClasses[i] as any;
      if (!p) continue;

      const pName = p.name || "";
      const pArg = p.arg || p.argument || p.value || p.selector || "";
      const pDecls = stringifyDeclarations(p.declarations);

      parts.push(`${pName}(${pArg}):${pDecls}`);
    }
    pseudoStr = parts.sort().join("|");
  }

  let atRuleStr = "";
  if (rule.atRules && rule.atRules.length > 0) {
    const parts: string[] = [];
    for (let i = 0; i < rule.atRules.length; i++) {
      const a = rule.atRules[i] as any;
      if (!a) continue;

      const aType = a.type || a.name || "";
      const aQuery = a.query || a.params || "";
      const aDecls = stringifyDeclarations(a.declarations);
      const aNested = a.nestedRules
        ? a.nestedRules
            .filter((r: IRRule) => r && !r.isDead)
            .map(computeRuleHash)
            .join(";")
        : "";

      parts.push(`${aType}:${aQuery}:${aDecls}:${aNested}`);
    }
    atRuleStr = parts.sort().join("|");
  }

  let nestedStr = "";
  if (rule.nestedRules && rule.nestedRules.length > 0) {
    const parts: string[] = [];
    for (let i = 0; i < rule.nestedRules.length; i++) {
      const n = rule.nestedRules[i];
      if (n && !n.isDead) {
        parts.push(computeRuleHash(n));
      }
    }
    nestedStr = parts.join("||");
  }

  return `${selector}#${pseudoStr}#${atRuleStr}#${nestedStr}#${declStr}`;
}

/**
 * Recursively counts all declarations within a rule structure.
 */
function countDeclarations(rule: IRRule): number {
  let count = rule.declarations ? rule.declarations.length : 0;

  if (rule.pseudoClasses) {
    for (let i = 0; i < rule.pseudoClasses.length; i++) {
      const pc = rule.pseudoClasses[i];
      if (pc?.declarations) count += pc.declarations.length;
    }
  }

  if (rule.atRules) {
    for (let i = 0; i < rule.atRules.length; i++) {
      const at = rule.atRules[i] as any;
      if (at?.declarations) count += at.declarations.length;
      if (at?.nestedRules) {
        for (let j = 0; j < at.nestedRules.length; j++) {
          const nr = at.nestedRules[j];
          if (nr && !nr.isDead) count += countDeclarations(nr);
        }
      }
    }
  }

  if (rule.nestedRules) {
    for (let i = 0; i < rule.nestedRules.length; i++) {
      const nr = rule.nestedRules[i];
      if (nr && !nr.isDead) count += countDeclarations(nr);
    }
  }

  return count;
}

/**
 * Deduplicates rules within a given scope array, recursing into nested blocks.
 */
function deduplicateRules(
  rules: IRRule[],
  diagnostics: any[],
  passName: string,
): {
  rulesEliminated: number;
  declarationsEliminated: number;
  bytesSaved: number;
  changes: number;
} {
  let changes = 0;
  let rulesEliminated = 0;
  let declarationsEliminated = 0;
  let bytesSaved = 0;

  const seenHashes = new Map<string, number>();

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule || rule.isDead) continue;

    // 1. Recurse into nested rules
    if (rule.nestedRules && rule.nestedRules.length > 0) {
      const res = deduplicateRules(rule.nestedRules, diagnostics, passName);
      changes += res.changes;
      rulesEliminated += res.rulesEliminated;
      declarationsEliminated += res.declarationsEliminated;
      bytesSaved += res.bytesSaved;
    }

    // 2. Recurse into at-rule nested blocks
    if (rule.atRules) {
      for (let j = 0; j < rule.atRules.length; j++) {
        const atRule = rule.atRules[j] as any;
        if (atRule && atRule.nestedRules) {
          const res = deduplicateRules(
            atRule.nestedRules,
            diagnostics,
            passName,
          );
          changes += res.changes;
          rulesEliminated += res.rulesEliminated;
          declarationsEliminated += res.declarationsEliminated;
          bytesSaved += res.bytesSaved;
        }
      }
    }

    // 3. Deduplicate at current scope level
    const hash = computeRuleHash(rule);

    if (seenHashes.has(hash)) {
      const previousIndex = seenHashes.get(hash)!;
      const previousRule = rules[previousIndex];

      if (previousRule && !previousRule.isDead) {
        previousRule.isDead = true;
        changes++;
        rulesEliminated++;

        const declsInRule = countDeclarations(previousRule);
        declarationsEliminated += declsInRule;

        const approxBytes = hash.length + 12; // Hash payload + CSS structural syntax
        bytesSaved += approxBytes;

        recordHistory(
          previousRule as any,
          passName,
          "eliminated-duplicate",
          undefined,
          `Rule block superseded by identical subsequent declaration at index ${i}`,
        );

        diagnostics.push({
          id: `dup-rule-${previousRule.id}-${rule.id}`,
          nodeId: previousRule.id,
          severity: "info",
          message: `Duplicate rule "${rule.selector || "unknown"}" eliminated — overridden by identical subsequent block`,
          suggestion:
            "Consolidate redundant styles or combine shared definitions.",
          pass: passName,
        });
      }
    }

    // Track latest instance to preserve cascade order
    seenHashes.set(hash, i);
  }

  return { rulesEliminated, declarationsEliminated, bytesSaved, changes };
}

export const sourceOptimizer: OptimizationPass = {
  name: "source-optimizer",
  cost: "expensive",
  requiredFor: ["css"],

  optimize(ir: StyleIR): OptimizationResult {
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

    const { rulesEliminated, declarationsEliminated, bytesSaved, changes } =
      deduplicateRules(ir.rules, ir.diagnostics, "source-optimizer");

    if (changes > 0) {
      ir.diagnostics.push({
        id: `source-opt-summary-${Date.now()}`,
        nodeId: ir.id,
        severity: "info",
        message: `Source optimizer: eliminated ${rulesEliminated} redundant rule blocks (${declarationsEliminated} declarations), recovering ~${bytesSaved} bytes`,
        pass: "source-optimizer",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated,
        declarationsEliminated,
        bytesSaved,
      },
      changes,
    };
  },
};