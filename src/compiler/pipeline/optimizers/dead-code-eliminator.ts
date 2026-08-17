// ============================================================================
// FILE: src/compiler/pipeline/optimizers/dead-code-eliminator.ts
// ============================================================================
// Graph-based dead code elimination. Uses dependency graph as single source of truth.

import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import { recordHistory } from "../ir/utils.js";

function estimateRuleBytes(rule: IRRule): { bytes: number; declCount: number } {
  let bytes = (rule.selector || "").length + 3;
  let declCount = 0;

  if (rule.declarations) {
    for (const d of rule.declarations) {
      if (d) {
        bytes +=
          String(d.property || "").length + String(d.value || "").length + 3;
        declCount++;
      }
    }
  }

  if (rule.pseudoClasses) {
    for (const pc of rule.pseudoClasses) {
      if (pc?.declarations) {
        for (const d of pc.declarations) {
          bytes +=
            String(d.property || "").length + String(d.value || "").length + 3;
          declCount++;
        }
      }
    }
  }

  if (rule.atRules) {
    for (const at of rule.atRules as any[]) {
      if (at) {
        bytes +=
          String(at.type || at.name || "").length +
          String(at.query || at.params || "").length +
          5;
        if (at.declarations) {
          for (const d of at.declarations) {
            bytes +=
              String(d.property || "").length +
              String(d.value || "").length +
              3;
            declCount++;
          }
        }
      }
    }
  }

  if (rule.nestedRules) {
    for (const nr of rule.nestedRules) {
      if (nr && !nr.isDead) {
        const sub = estimateRuleBytes(nr);
        bytes += sub.bytes;
        declCount += sub.declCount;
      }
    }
  }

  return { bytes, declCount };
}

// Fix #2: Split combined selectors for global/preserved check
function isGlobalOrPreservedRule(rule: IRRule): boolean {
  if (rule.meta?.preserve || rule.meta?.global || rule.meta?.atomic) {
    return true;
  }

  const selector = (rule.selector || "").toLowerCase();
  // Split combined selectors like ":root, html, body"
  const parts = selector.split(",").map((s) => s.trim());

  if (
    parts.some(
      (s) =>
        s === ":root" ||
        s === "html" ||
        s === "body" ||
        s === "*" ||
        s === "::selection" ||
        s === "::placeholder" ||
        s.startsWith("::after") ||
        s.startsWith("::before"),
    )
  ) {
    return true;
  }

  // Preserve global at-rules
  if (rule.atRules && rule.atRules.length > 0) {
    for (const at of rule.atRules as any[]) {
      const type = (at.type || at.name || "").toLowerCase();
      if (
        type === "keyframes" ||
        type === "font-face" ||
        type === "layer" ||
        type === "import"
      ) {
        return true;
      }
    }
  }

  return false;
}

// Fix #5: Check conditions in hasDeclarationsOrChildren
function hasDeclarationsOrChildren(rule: IRRule): boolean {
  if (rule.declarations && rule.declarations.length > 0) return true;

  // Fix #5: Rules with only if() conditions are not empty
  if (rule.conditions && rule.conditions.length > 0) return true;

  if (rule.pseudoClasses) {
    for (const p of rule.pseudoClasses) {
      if (p.declarations && p.declarations.length > 0) return true;
    }
  }

  if (rule.atRules) {
    for (const a of rule.atRules as any[]) {
      if (a.declarations && a.declarations.length > 0) return true;
      if (
        a.nestedRules &&
        a.nestedRules.some(
          (nr: IRRule) => !nr.isDead && hasDeclarationsOrChildren(nr),
        )
      ) {
        return true;
      }
    }
  }

  if (rule.nestedRules) {
    for (const n of rule.nestedRules) {
      if (!n.isDead && hasDeclarationsOrChildren(n)) return true;
    }
  }

  return false;
}

// Fix #1: BFS from roots following DEPENDENTS (not dependencies)
function buildReachableNodeSet(graph: StyleIR["graph"]): Set<string> {
  const reachable = new Set<string>();
  if (!graph) return reachable;

  const queue: string[] = [];

  if (graph.rootNodes) {
    const rootList =
      graph.rootNodes instanceof Set
        ? Array.from(graph.rootNodes)
        : Array.isArray(graph.rootNodes)
          ? graph.rootNodes
          : Object.values(graph.rootNodes);

    for (const rId of rootList) {
      if (rId) {
        const idStr = String(rId);
        reachable.add(idStr);
        queue.push(idStr);
      }
    }
  }

  let nodesMap: Map<string, any> | undefined;
  if (graph.nodes) {
    if (graph.nodes instanceof Map) {
      nodesMap = graph.nodes;
    } else if (typeof graph.nodes === "object") {
      nodesMap = new Map(Object.entries(graph.nodes));
    }
  }

  if (!nodesMap || queue.length === 0) {
    return reachable;
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = nodesMap.get(currentId);
    if (!node) continue;

    // Fix #1: Follow DEPENDENTS from roots to reach all downstream nodes
    const dependents = node.dependents || node.meta?.dependents || [];
    for (const depId of dependents) {
      const depStr = String(depId);
      if (!reachable.has(depStr)) {
        reachable.add(depStr);
        queue.push(depStr);
      }
    }
  }

  return reachable;
}

function pruneNestedStructures(
  rule: IRRule,
  passName: string,
): { eliminatedRules: number; eliminatedDecls: number; savedBytes: number } {
  let eliminatedRules = 0;
  let eliminatedDecls = 0;
  let savedBytes = 0;

  if (rule.nestedRules && rule.nestedRules.length > 0) {
    const remaining: IRRule[] = [];
    for (const nested of rule.nestedRules) {
      if (nested.isDead) {
        const { bytes, declCount } = estimateRuleBytes(nested);
        eliminatedRules++;
        eliminatedDecls += declCount;
        savedBytes += bytes;
        continue;
      }

      const res = pruneNestedStructures(nested, passName);
      eliminatedRules += res.eliminatedRules;
      eliminatedDecls += res.eliminatedDecls;
      savedBytes += res.savedBytes;

      if (!hasDeclarationsOrChildren(nested)) {
        nested.isDead = true;
        const { bytes, declCount } = estimateRuleBytes(nested);
        eliminatedRules++;
        eliminatedDecls += declCount;
        savedBytes += bytes;

        recordHistory(
          nested as any,
          passName,
          "eliminated-empty-nested",
          undefined,
          `Pruned empty nested rule "${nested.selector}"`,
        );
      } else {
        remaining.push(nested);
      }
    }
    rule.nestedRules = remaining;
  }

  if (rule.atRules && rule.atRules.length > 0) {
    const remainingAtRules: any[] = [];
    for (const atRule of rule.atRules as any[]) {
      if (atRule.isDead) continue;

      if (atRule.nestedRules && atRule.nestedRules.length > 0) {
        const subRemaining: IRRule[] = [];
        for (const sub of atRule.nestedRules) {
          if (sub.isDead) {
            const { bytes, declCount } = estimateRuleBytes(sub);
            eliminatedRules++;
            eliminatedDecls += declCount;
            savedBytes += bytes;
            continue;
          }

          const res = pruneNestedStructures(sub, passName);
          eliminatedRules += res.eliminatedRules;
          eliminatedDecls += res.eliminatedDecls;
          savedBytes += res.savedBytes;

          if (!hasDeclarationsOrChildren(sub)) {
            sub.isDead = true;
            const { bytes, declCount } = estimateRuleBytes(sub);
            eliminatedRules++;
            eliminatedDecls += declCount;
            savedBytes += bytes;
          } else {
            subRemaining.push(sub);
          }
        }
        atRule.nestedRules = subRemaining;
      }

      const hasAtDecl = atRule.declarations && atRule.declarations.length > 0;
      const hasAtNested = atRule.nestedRules && atRule.nestedRules.length > 0;

      if (!hasAtDecl && !hasAtNested) {
        atRule.isDead = true;
        savedBytes += 30;
      } else {
        remainingAtRules.push(atRule);
      }
    }
    rule.atRules = remainingAtRules;
  }

  return { eliminatedRules, eliminatedDecls, savedBytes };
}

export const deadCodeEliminator: OptimizationPass = {
  name: "dead-code-eliminator",
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

    if (!ir.diagnostics) {
      ir.diagnostics = [];
    }

    const hasGraph = Boolean(
      ir.graph && (ir.graph.nodes || ir.graph.rootNodes),
    );
    const reachableSet = buildReachableNodeSet(ir.graph);

    let totalRulesEliminated = 0;
    let totalDeclsEliminated = 0;
    let totalBytesSaved = 0;

    const aliveRules: IRRule[] = [];

    for (const rule of ir.rules) {
      if (!rule) continue;

      if (rule.isDead) {
        const { bytes, declCount } = estimateRuleBytes(rule);
        totalRulesEliminated++;
        totalDeclsEliminated += declCount;
        totalBytesSaved += bytes;
        continue;
      }

      const nestedRes = pruneNestedStructures(rule, "dead-code-eliminator");
      totalRulesEliminated += nestedRes.eliminatedRules;
      totalDeclsEliminated += nestedRes.eliminatedDecls;
      totalBytesSaved += nestedRes.savedBytes;

      const hasContent = hasDeclarationsOrChildren(rule);
      const isPreserved = isGlobalOrPreservedRule(rule);

      let isUnreachableFromGraph = false;
      if (hasGraph && !isPreserved) {
        const inGraph =
          ir.graph?.nodes instanceof Map
            ? ir.graph.nodes.has(rule.id)
            : Boolean((ir.graph?.nodes as any)?.[rule.id]);

        if (inGraph && !reachableSet.has(rule.id)) {
          isUnreachableFromGraph = true;
        }
      }

      if (!hasContent || isUnreachableFromGraph) {
        rule.isDead = true;
        const { bytes, declCount } = estimateRuleBytes(rule);

        totalRulesEliminated++;
        totalDeclsEliminated += declCount;
        totalBytesSaved += bytes;

        const reason = !hasContent
          ? `Eliminated empty rule block "${rule.selector || "unknown"}"`
          : `Eliminated unused rule "${rule.selector || "unknown"}" (unreachable in dependency graph)`;

        recordHistory(
          rule as any,
          "dead-code-eliminator",
          "eliminated-dead-code",
          undefined,
          reason,
        );

        ir.diagnostics.push({
          id: `dce-rule-${rule.id}`,
          nodeId: rule.id,
          severity: "info",
          message: reason,
          suggestion: "Remove unreferenced or empty CSS selectors.",
          pass: "dead-code-eliminator",
        });

        continue;
      }

      aliveRules.push(rule);
    }

    ir.rules = aliveRules;

    if (totalRulesEliminated > 0) {
      ir.diagnostics.push({
        id: `dce-summary-${ir.id}-${Date.now()}`,
        nodeId: ir.id,
        severity: "info",
        message: `Dead code eliminator: removed ${totalRulesEliminated} unused rules (${totalDeclsEliminated} declarations), saving ~${totalBytesSaved} bytes.`,
        pass: "dead-code-eliminator",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: totalRulesEliminated,
        declarationsEliminated: totalDeclsEliminated,
        bytesSaved: totalBytesSaved,
      },
      changes: totalRulesEliminated,
    };
  },
};