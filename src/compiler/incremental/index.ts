// ============================================================================
// FILE: src/compiler/incremental/index.ts
// Public exports for the incremental compilation system
// ============================================================================

// Types
export type {
  FileChange,
  ChangeKind,
  IncrementalUpdateRequest,
  IncrementalUpdateResult,
} from "./types.js";

// Graph
export {
  buildIRGraph,
  findAffectedNodes,
  traverseGraph,
  exportGraphAsJSON,
  getGraphStats,
} from "./graph-builder.js";

// IR Updater
export {
  IRUpdater,
  type IRUpdaterOptions,
  type FlattenedRule,
  type RuleDiff,
  type FileUpdateResult,
} from "./ir-updater.js";

// Stateful Compiler
export {
  StatefulIncrementalCompiler,
  type StatefulIncrementalCompilerOptions,
} from "./stateful-compiler.js";

// Low-level incremental compiler
export {
  incrementalCompile,
  findDirtyRules,
  markDirtyRules,
  filterDirtyIR,
  mergeRecompiledIR,
  countTotalRules, 
  type IncrementalChange,
  type IncrementalResult,
} from "./incremental-compiler.js";

// Default export
export { StatefulIncrementalCompiler as default } from "./stateful-compiler.js";