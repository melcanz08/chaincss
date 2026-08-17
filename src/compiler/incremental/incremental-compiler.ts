// src/compiler/pipeline/incremental-compiler.ts
// Incremental compilation using the dependency graph

import type { StyleIR, IRRule, IRNodeId, IRGraph } from "../pipeline/ir/types.js";
import {
  buildIRGraph,
  findAffectedNodes,
} from "./graph-builder.js";
import type { PipelineResult } from "../pipeline/pipeline-types.js";
import type { Pipeline } from "../pipeline/pipeline.js";

export interface IncrementalChange {
  /** IDs of rules that were added or modified */
  changedRuleIds: IRNodeId[];
  /** IDs of rules that were removed */
  removedRuleIds: IRNodeId[];
  /** Source files that changed */
  changedFiles: string[];
}

export interface IncrementalResult extends PipelineResult {
  incremental: {
    dirtyCount: number;
    totalRules: number;
    /** Rules that were actually recompiled */
    recompiledCount: number;
    /** Rules skipped (unchanged + unaffected) */
    skippedCount: number;
    /** Time saved vs full compilation (ms) */
    timeSaved: number;
    incrementalSkipped: number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Recursively count all rules including nested ones.
 */
export function countTotalRules(rules: IRRule[]): number {
  let count = 0;
  for (const r of rules) {
    count++;
    if (r.nestedRules) {
      count += countTotalRules(r.nestedRules);
    }
  }
  return count;
}

/**
 * Recursively check if a rule ID exists anywhere in the IR.
 */
function hasRule(ir: StyleIR, id: string): boolean {
  function check(rules: IRRule[]): boolean {
    for (const r of rules) {
      if (r.id === id) return true;
      if (r.nestedRules && check(r.nestedRules)) return true;
    }
    return false;
  }
  return check(ir.rules);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Determine which rules need recompilation based on changed nodes.
 * Uses the dependency graph to find all affected nodes.
 */
export function findDirtyRules(
  graph: IRGraph,
  change: IncrementalChange,
): Set<IRNodeId> {
  const dirty = new Set<IRNodeId>();

  // Directly changed rules
  for (const id of change.changedRuleIds) {
    dirty.add(id);
    // Find all dependents that need recompilation
    const affected = findAffectedNodes(graph, id);
    for (const affId of affected) {
      dirty.add(affId);
    }
  }

  return dirty;
}

/**
 * Mark rules as dirty or clean based on the change set.
 * Fix 4: Recursively traverses all nesting levels.
 */
export function markDirtyRules(ir: StyleIR, dirtyIds: Set<IRNodeId>): void {
  function markRecursive(rules: IRRule[]): void {
    for (const rule of rules) {
      if (dirtyIds.has(rule.id)) {
        rule._dirty = true;
      }
      if (rule.nestedRules && rule.nestedRules.length > 0) {
        markRecursive(rule.nestedRules);
      }
    }
  }
  markRecursive(ir.rules);
}

/**
 * Filter IR to only include dirty rules (plus their ancestors for context).
 * Fix 1: Recursively filters so dirty nested rules are retained with their parent chain.
 */
export function filterDirtyIR(ir: StyleIR, dirtyIds: Set<IRNodeId>): StyleIR {
  function filterRecursive(rule: IRRule): IRRule | null {
    const isSelfDirty = dirtyIds.has(rule.id) || rule._dirty === true;

    const filteredNested = (rule.nestedRules || [])
      .map(filterRecursive)
      .filter((r): r is IRRule => r !== null);

    // Keep if self is dirty OR any nested child is dirty
    if (isSelfDirty || filteredNested.length > 0) {
      return {
        ...rule,
        nestedRules: filteredNested,
      };
    }
    return null;
  }

  const dirtyRules = ir.rules
    .map(filterRecursive)
    .filter((r): r is IRRule => r !== null);

  const skippedCount = ir.rules.length - dirtyRules.length;

  return {
    ...ir,
    rules: dirtyRules,
    meta: {
      ...ir.meta,
      dirtyRules: dirtyIds.size,
      passes: [...ir.meta.passes, `incremental-filter:${skippedCount}-skipped`],
    },
    graph: buildIRGraph({ ...ir, rules: dirtyRules }),
  };
}

/**
 * Merge recompiled dirty rules back into the clean previous IR.
 * Fix 2: Ensures the incremental result contains ALL rules, not just dirty ones.
 */
export function mergeRecompiledIR(
  previousIR: StyleIR,
  recompiledIR: StyleIR,
  dirtyIds: Set<IRNodeId>,
): StyleIR {
  const recompiledMap = new Map<string, IRRule>();
  function indexRules(rules: IRRule[]): void {
    for (const r of rules) {
      recompiledMap.set(r.id, r);
      if (r.nestedRules) indexRules(r.nestedRules);
    }
  }
  indexRules(recompiledIR.rules);

  function mergeRule(rule: IRRule): IRRule {
    if (recompiledMap.has(rule.id)) {
      return recompiledMap.get(rule.id)!;
    }
    return {
      ...rule,
      _dirty: false,
      nestedRules: (rule.nestedRules || []).map(mergeRule),
    };
  }

  const mergedRules = previousIR.rules.map(mergeRule);

  // ✅ Correct: Only append new top-level rules.
  for (const rule of recompiledIR.rules) {
    if (!hasRule(previousIR, rule.id)) {
      mergedRules.push(rule);
    }
  }

  return {
    ...previousIR,
    rules: mergedRules,
  };
}

/**
 * Run incremental compilation:
 * 1. Build graph from current IR
 * 2. Find affected nodes from changes
 * 3. Mark dirty rules
 * 4. Filter IR to dirty rules only
 * 5. Run pipeline on reduced IR
 * 6. Merge results back into complete IR
 */
export async function incrementalCompile(
  pipeline: Pipeline,
  previousIR: StyleIR,
  change: IncrementalChange,
): Promise<IncrementalResult> {
  const fullStartTime = Date.now();

  // Build graph
  const graph = previousIR.graph || buildIRGraph(previousIR);

  // Find dirty rules
  const dirtyIds = findDirtyRules(graph, change);

  // Mark dirty (recursive — Fix 4)
  markDirtyRules(previousIR, dirtyIds);

  // Filter to dirty only (recursive — Fix 1)
  const filteredIR = filterDirtyIR(previousIR, dirtyIds);

  // Run pipeline on reduced IR (Fix 3: await for async safety)
  const startTime = Date.now();
  const pipelineResult = await pipeline.process(filteredIR);
  const compileTime = Date.now() - startTime;

  // Fix 2: Merge dirty results back into complete IR
  const mergedIR = mergeRecompiledIR(previousIR, pipelineResult.ir, dirtyIds);
  
  // Fix 5: Use recursive count for accurate stats
  const totalRules = countTotalRules(previousIR.rules);
  const recompiledCount = countTotalRules(filteredIR.rules);
  const skippedCount = totalRules - recompiledCount;
  const estimatedFullTime =
    compileTime * (totalRules / Math.max(recompiledCount, 1));
  const timeSaved = Math.max(0, estimatedFullTime - compileTime);

  // Merge diagnostics from previous IR
  const newDiagnostics = pipelineResult.ir.diagnostics || [];
  const mergedDiagnostics = [
    ...previousIR.diagnostics.filter(
      (d) => !newDiagnostics.some((nd) => nd.id === d.id),
    ),
    ...newDiagnostics,
  ];

  const fullIRWithGraph: StyleIR = {
    ...mergedIR,
    diagnostics: mergedDiagnostics,
    meta: {
      ...mergedIR.meta,
      passCount: mergedIR.meta.passCount + 1,
      passes: [...mergedIR.meta.passes, "incremental"],
    },
  };
  fullIRWithGraph.graph = buildIRGraph(fullIRWithGraph);

  return {
    ...pipelineResult,
    ir: fullIRWithGraph,
    totalDuration: Date.now() - fullStartTime,
    incremental: {
      dirtyCount: dirtyIds.size,
      totalRules,
      incrementalSkipped: skippedCount,
      recompiledCount,
      skippedCount,
      timeSaved: Math.round(timeSaved),
    },
  };
}

/**
 * Get a summary of what would be recompiled without actually doing it.
 */
export function previewIncrementalImpact(
  previousIR: StyleIR,
  change: IncrementalChange,
): {
  changedFiles: string[];
  affectedRules: number;
  totalRules: number;
  affectedPercent: number;
  deepestImpact: number;
} {
  const graph = previousIR.graph || buildIRGraph(previousIR);
  const dirtyIds = findDirtyRules(graph, change);

  let deepestImpact = 0;
  for (const id of dirtyIds) {
    const affected = findAffectedNodes(graph, id);
    deepestImpact = Math.max(deepestImpact, affected.length);
  }

  // Fix 5: Use recursive count
  const totalRules = countTotalRules(previousIR.rules);

  return {
    changedFiles: change.changedFiles,
    affectedRules: dirtyIds.size,
    totalRules,
    affectedPercent: Math.round(
      (dirtyIds.size / Math.max(totalRules, 1)) * 100,
    ),
    deepestImpact,
  };
}