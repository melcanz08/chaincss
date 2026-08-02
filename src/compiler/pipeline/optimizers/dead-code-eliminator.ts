// ============================================================================
// FILE: src/compiler/pipeline/optimizers/dead-code-eliminator.ts
// ============================================================================
// Graph-based dead code elimination. Uses dependency graph as single source of truth.

import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";

function isRuleUsed(rule: IRRule, graph: StyleIR["graph"]): boolean {
  // A rule is "used" if it has dependents in the graph
  if (!graph) return true;
  const node = graph.nodes.get(rule.id);
  if (!node) return true;
  const deps = node.meta?.dependents || [];
  return deps.length > 0;
}

function hasDeclarations(rule: IRRule): boolean {
  if (rule.declarations?.length) return true;
  if (rule.pseudoClasses?.some((p) => p.declarations?.length)) return true;
  if (
    rule.atRules?.some((a) => a.declarations?.length || a.nestedRules?.length)
  )
    return true;
  if (rule.nestedRules?.length) return true;
  return false;
}

function eliminateDeadRules(ir: StyleIR): {
  eliminated: number;
  bytesSaved: number;
} {
  let eliminated = 0;
  let bytesSaved = 0;

  // Build reverse dependency map from the graph
  const usedById = new Set<string>();
  if (ir.graph) {
    if (ir.graph.nodes) {
      const nodesEntries =
        ir.graph.nodes instanceof Map
          ? ir.graph.nodes.entries()
          : Object.entries(ir.graph.nodes);

      for (const [id, rawNode] of nodesEntries) {
        const node = rawNode as any;
        if ((node?.meta?.dependents || []).length > 0) {
          usedById.add(id);
        }
      }
    }

    if (ir.graph.rootNodes) {
      const rootNodesList =
        ir.graph.rootNodes instanceof Set
          ? Array.from(ir.graph.rootNodes)
          : Array.isArray(ir.graph.rootNodes)
            ? ir.graph.rootNodes
            : Object.values(ir.graph.rootNodes);

      for (const rootId of rootNodesList) {
        if (rootId) usedById.add(String(rootId));
      }
    }
  }

  // Walk rules: mark dead, collect non-dead
  const alive: IRRule[] = [];
  const rulesList = ir.rules || [];
  for (const rule of rulesList) {
    // Already marked dead by a previous pass
    if (rule.isDead) {
      eliminated++;
      bytesSaved += 80;
      continue;
    }

    // No declarations AND no dependents = dead weight
    if (!hasDeclarations(rule) && !usedById.has(rule.id)) {
      rule.isDead = true;
      eliminated++;
      bytesSaved += 80;
      continue;
    }

    // Filter dead nested rules and at-rules
    if (rule.nestedRules) {
      rule.nestedRules = rule.nestedRules.filter((n) => {
        if (n.isDead) {
          eliminated++;
          bytesSaved += 80;
          return false;
        }
        return true;
      });
    }
    if (rule.atRules) {
      rule.atRules = rule.atRules.filter((a) => {
        if ((a as any).isDead) {
          eliminated++;
          bytesSaved += 50;
          return false;
        }
        return true;
      });
    }

    alive.push(rule);
  }

  ir.rules = alive;
  return { eliminated, bytesSaved };
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

    const { eliminated, bytesSaved } = eliminateDeadRules(ir);

    if (eliminated > 0) {
      ir.diagnostics.push({
        id: `dce-${ir.id}`,
        nodeId: ir.id,
        severity: "info",
        message: `Dead code eliminator: removed ${eliminated} unused rules.`,
        pass: "dead-code-eliminator",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: eliminated,
        declarationsEliminated: 0,
        bytesSaved,
      },
      changes: eliminated,
    };
  },
};
