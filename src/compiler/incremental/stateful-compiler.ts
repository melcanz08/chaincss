// ============================================================================
// FILE: src/compiler/incremental/stateful-compiler.ts (FINAL)
// ============================================================================

import type { StyleIR, IRRule, IRNodeId } from "../pipeline/ir/types.js";
import type { Pipeline } from "../pipeline/pipeline.js";
import { IRUpdater } from "./ir-updater.js";
import {
  incrementalCompile,
  countTotalRules,
  type IncrementalChange,
} from "./incremental-compiler.js";
import { buildIRGraph, findAffectedNodes } from "./graph-builder.js";
import type {
  IncrementalUpdateRequest,
  IncrementalUpdateResult,
} from "./types.js";

export interface StatefulIncrementalCompilerOptions {
  pipeline: Pipeline;
  parseFile: (filePath: string, source: string) => Promise<StyleIR> | StyleIR;
  generateRuleId: (filePath: string, stableName: string) => IRNodeId;
  rebuild: () => Promise<StyleIR>;
  initialIR?: StyleIR;
  fullRebuildOnConfig?: boolean;
  fullRebuildOnToken?: boolean;
  maxIncrementalRules?: number;
}

export class StatefulIncrementalCompiler {
  private pipeline: Pipeline;
  private irUpdater: IRUpdater;
  private rebuildFn: () => Promise<StyleIR>;
  private currentIR: StyleIR | null;
  private fullRebuildOnConfig: boolean;
  private fullRebuildOnToken: boolean;
  private maxIncrementalRules: number;
  private compileCount: number = 0;

  constructor(options: StatefulIncrementalCompilerOptions) {
    this.pipeline = options.pipeline;
    this.rebuildFn = options.rebuild;
    this.currentIR = options.initialIR || null;
    this.fullRebuildOnConfig = options.fullRebuildOnConfig ?? true;
    this.fullRebuildOnToken = options.fullRebuildOnToken ?? false;
    this.maxIncrementalRules = options.maxIncrementalRules ?? 1000;

    this.irUpdater = new IRUpdater({
      parseFile: options.parseFile,
      generateRuleId: options.generateRuleId,
    });

    if (this.currentIR) {
      this.irUpdater.indexIR(this.currentIR);
    }
  }

  getIR(): StyleIR | null {
    return this.currentIR;
  }

  setIR(ir: StyleIR): void {
    this.currentIR = ir;
    this.irUpdater.indexIR(ir);
  }

  getStats() {
    return {
      compileCount: this.compileCount,
      totalRules: this.currentIR ? countTotalRules(this.currentIR.rules) : 0,
      totalFiles: this.irUpdater.getFileCount(),
    };
  }

  async update(request: IncrementalUpdateRequest): Promise<IncrementalUpdateResult> {
    if (!this.currentIR) {
      throw new Error("No IR available. Call setIR() or provide initialIR.");
    }

    this.compileCount++;

    if (this.shouldFullRebuild(request)) {
      return this.performFullRebuild(request);
    }

    return this.performIncrementalUpdate(request);
  }

  private shouldFullRebuild(request: IncrementalUpdateRequest): boolean {
    if (this.fullRebuildOnConfig) {
      if (request.changedFiles.some(f => f.kind === "config")) return true;
    }
    if (this.fullRebuildOnToken) {
      if (request.changedFiles.some(f => f.kind === "token")) return true;
    }
    return false;
  }

  private async performIncrementalUpdate(
    request: IncrementalUpdateRequest
  ): Promise<IncrementalUpdateResult> {
    let workingIR = this.currentIR!;
    const previousGraph = workingIR.graph || buildIRGraph(workingIR);
    const previousRuleIds = new Set(this.getAllRuleIds(workingIR));

    const allChangedRuleIds = new Set<IRNodeId>();
    const allRemovedRuleIds = new Set<IRNodeId>();
    const allAddedRuleIds = new Set<IRNodeId>();

    const addedFileSet = new Set(request.addedFiles || []);
    const deletedFileSet = new Set(request.deletedFiles || []);

    // 1. Process deleted files first
    for (const deletedFile of deletedFileSet) {
      const updateResult = this.irUpdater.removeFile(workingIR, deletedFile);
      workingIR = updateResult.ir;
      updateResult.removedRuleIds.forEach(id => allRemovedRuleIds.add(id));
    }

    // 2. Process changed files (skip added/deleted)
    for (const change of request.changedFiles) {
      if (addedFileSet.has(change.filePath)) continue;
      if (deletedFileSet.has(change.filePath)) continue;
      if (!change.source) continue;

      const updateResult = await this.irUpdater.updateFile(workingIR, {
        filePath: change.filePath,
        source: change.source,
      });

      workingIR = updateResult.ir;
      updateResult.changedRuleIds.forEach(id => allChangedRuleIds.add(id));
      updateResult.removedRuleIds.forEach(id => allRemovedRuleIds.add(id));
      updateResult.addedRuleIds.forEach(id => allAddedRuleIds.add(id));
    }

    // 3. Process added files
    for (const addedFile of addedFileSet) {
      const matchingChange = request.changedFiles.find(
        f => f.filePath === addedFile && f.source
      );

      if (matchingChange?.source) {
        const updateResult = await this.irUpdater.addFile(workingIR, {
          filePath: addedFile,
          source: matchingChange.source,
        });

        workingIR = updateResult.ir;
        updateResult.addedRuleIds.forEach(id => allAddedRuleIds.add(id));
      }
    }

    // 4. Rebuild graph ONCE after all file operations
    workingIR = {
      ...workingIR,
      graph: buildIRGraph(workingIR),
    };

    // 5. Find affected nodes
    const dirtyIds = new Set<IRNodeId>();

    // Changed rules + dependents
    for (const ruleId of allChangedRuleIds) {
      dirtyIds.add(ruleId);
      const affected = findAffectedNodes(workingIR.graph!, ruleId);
      affected.forEach(id => dirtyIds.add(id));
    }

    // Added rules
    for (const ruleId of allAddedRuleIds) {
      dirtyIds.add(ruleId);
    }

    // Removed rules - use PREVIOUS graph for dependents
    for (const ruleId of allRemovedRuleIds) {
      const affected = findAffectedNodes(previousGraph, ruleId);
      affected.forEach(id => {
        if (!allRemovedRuleIds.has(id)) {
          dirtyIds.add(id);
        }
      });
    }

    // 6. Check threshold
    if (dirtyIds.size > this.maxIncrementalRules) {
      return this.performFullRebuild(request);
    }

    // 7. Perform incremental compilation
    const incrementalChange: IncrementalChange = {
      changedRuleIds: Array.from(dirtyIds),
      removedRuleIds: Array.from(allRemovedRuleIds),
      changedFiles: request.changedFiles.map(f => f.filePath),
    };

    const result = await incrementalCompile(
      this.pipeline,
      workingIR,
      incrementalChange
    );

    // 8. Update state
    this.currentIR = result.ir;
    this.irUpdater.indexIR(result.ir);

    // 9. Calculate accurate statistics
    const finalRuleIds = new Set(this.getAllRuleIds(result.ir));
    const reusedRules = Array.from(previousRuleIds).filter(
      id =>
        finalRuleIds.has(id) &&
        !dirtyIds.has(id) &&
        !allRemovedRuleIds.has(id)
    );

    return {
      ...result,
      incremental: {
        dirtyCount: dirtyIds.size,
        totalRules: finalRuleIds.size,
        incrementalSkipped: reusedRules.length,
        recompiledRules: Array.from(dirtyIds),
        removedRules: Array.from(allRemovedRuleIds),
        addedRules: Array.from(allAddedRuleIds),
        reusedRules,
        affectedFiles: request.changedFiles.map(f => f.filePath),
        recompiledCount: dirtyIds.size,
        reusedCount: reusedRules.length,
        timeSaved: result.incremental.timeSaved,
        fullRebuild: false,
      },
    };
  }

  private async performFullRebuild(
    request: IncrementalUpdateRequest
  ): Promise<IncrementalUpdateResult> {
    const freshIR = await this.rebuildFn();
    const result = await this.pipeline.process(freshIR);

    this.currentIR = result.ir;
    this.irUpdater.indexIR(result.ir);

    const totalRules = countTotalRules(result.ir.rules);

    return {
      ...result,
      incremental: {
        // Required fields
        dirtyCount: totalRules,
        incrementalSkipped: 0,
        // Additional fields
        recompiledRules: this.getAllRuleIds(result.ir),
        removedRules: [],
        addedRules: [],
        reusedRules: [],
        affectedFiles: request.changedFiles.map(f => f.filePath),
        totalRules,
        recompiledCount: totalRules,
        reusedCount: 0,
        timeSaved: 0,
        fullRebuild: true,
      },
    };
  }

  private getAllRuleIds(ir: StyleIR): IRNodeId[] {
    const ids: IRNodeId[] = [];

    const collectRules = (rules: IRRule[]) => {
      for (const rule of rules) {
        ids.push(rule.id);
        if (rule.nestedRules) {
          collectRules(rule.nestedRules);
        }
      }
    };

    collectRules(ir.rules);
    return ids;
  }
}

export default StatefulIncrementalCompiler;