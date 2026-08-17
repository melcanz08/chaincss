// ============================================================================
// FILE: src/compiler/incremental/types.ts (FIXED)
// ============================================================================

import type { StyleIR, IRNodeId } from "../pipeline/ir/types.js";
import type { PipelineResult, PipelineStageResult } from "../pipeline/pipeline-types.js";

export type ChangeKind = "style" | "token" | "config" | "unknown";

export interface FileChange {
  filePath: string;
  kind: ChangeKind;
  source?: string;
  previousSource?: string;
}

export interface IncrementalUpdateRequest {
  changedFiles: FileChange[];
  deletedFiles?: string[];
  addedFiles?: string[];
}

export interface IncrementalUpdateResult extends PipelineResult {
  incremental: {
    // Required from PipelineResult
    dirtyCount: number;
    totalRules: number;
    incrementalSkipped: number;
    // Additional fields
    recompiledRules: IRNodeId[];
    removedRules: IRNodeId[];
    addedRules: IRNodeId[];
    reusedRules: IRNodeId[];
    affectedFiles: string[];
    recompiledCount: number;
    reusedCount: number;
    timeSaved: number;
    fullRebuild: boolean;
  };
}

// Internal types
export interface IncrementalChange {
  changedRuleIds: IRNodeId[];
  removedRuleIds: IRNodeId[];
  changedFiles: string[];
}

export interface IncrementalResult extends PipelineResult {
  incremental: {
    dirtyCount: number;
    totalRules: number;
    recompiledCount: number;
    skippedCount: number;
    timeSaved: number;
    incrementalSkipped: number;
  };
}