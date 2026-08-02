// src/compiler/pipeline/incremental-compiler.ts
// Incremental compilation using the dependency graph

import type { StyleIR, IRRule, IRNodeId, IRGraph } from "./ir/types.js";
import {
  buildIRGraph,
  findAffectedNodes,
  traverseGraph,
  getGraphStats,
} from "./ir/graph-builder.js";
import type { PipelineResult } from "./pipeline-types.js";
import type { Pipeline } from "./pipeline.js";

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
 * Dirty rules will be recompiled; clean rules are skipped.
 */
export function markDirtyRules(ir: StyleIR, dirtyIds: Set<IRNodeId>): void {
  for (const rule of ir.rules) {
    if (dirtyIds.has(rule.id)) {
      rule._dirty = true;
    }
    // Also mark nested rules
    if (rule.nestedRules) {
      for (const nested of rule.nestedRules) {
        if (dirtyIds.has(nested.id)) {
          nested._dirty = true;
        }
      }
    }
  }
}

/**
 * Filter IR to only include dirty rules (plus their ancestors for context).
 * This reduces the IR size for the pipeline passes.
 */
export function filterDirtyIR(ir: StyleIR, dirtyIds: Set<IRNodeId>): StyleIR {
  const dirtyRules = ir.rules.filter(
    (r) => dirtyIds.has(r.id) || r._dirty === true,
  );
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
 * Run incremental compilation:
 * 1. Build graph from current IR
 * 2. Find affected nodes from changes
 * 3. Mark dirty rules
 * 4. Filter IR to dirty rules only
 * 5. Run pipeline on reduced IR
 * 6. Merge results back
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

  // Mark dirty
  markDirtyRules(previousIR, dirtyIds);

  // Filter to dirty only
  const filteredIR = filterDirtyIR(previousIR, dirtyIds);

  // Run pipeline on reduced IR
  const startTime = Date.now();
  const pipelineResult = pipeline.execute(filteredIR);
  const compileTime = Date.now() - startTime;

  // Estimate time saved (rough: based on ratio of skipped rules)
  const totalRules = previousIR.rules.length;
  const recompiledCount = filteredIR.rules.length;
  const skippedCount = totalRules - recompiledCount;
  const estimatedFullTime =
    compileTime * (totalRules / Math.max(recompiledCount, 1));
  const timeSaved = Math.max(0, estimatedFullTime - compileTime);

  // Merge diagnostics from previous IR
  const mergedDiagnostics = [
    ...previousIR.diagnostics.filter(
      (d) => !filteredIR.diagnostics.some((nd) => nd.id === d.id),
    ),
    ...filteredIR.diagnostics,
  ];

  return {
    ...pipelineResult,
    ir: {
      ...pipelineResult.ir,
      diagnostics: mergedDiagnostics,
      meta: {
        ...pipelineResult.ir.meta,
        passCount: pipelineResult.ir.meta.passCount + 1,
        passes: [...pipelineResult.ir.meta.passes, "incremental"],
      },
    },
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
 * Useful for build tools that want to show "3 files changed, 47 rules affected."
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

  return {
    changedFiles: change.changedFiles,
    affectedRules: dirtyIds.size,
    totalRules: previousIR.rules.length,
    affectedPercent: Math.round(
      (dirtyIds.size / Math.max(previousIR.rules.length, 1)) * 100,
    ),
    deepestImpact,
  };
}
