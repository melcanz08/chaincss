// ============================================================================
// FILE: src/compiler/pipeline/index.ts
// ============================================================================

/**
 * ChainCSS Pipeline
 *
 * Unified 5-stage compilation pipeline and analysis engine.
 * All exports from this module form the canonical pipeline public API.
 */

// Core Runners
export { Pipeline } from "./pipeline.js";
export {
  createDefaultPipeline,
  createFullPipeline,
  createPipeline,
} from "./pipeline.js";

// Observability & Telemetry System (Inspector)
export { InspectorStore } from "./inspector/store.js";
export { serializeForInspector } from "./inspector/serializer.js";

// Shared Runtime Configurations
export type { PipelinePreset } from "./pipeline.js";

// Public Pipeline Schema Types & Stage Contexts
export type {
  PipelineConfig,
  PipelineResult,
  PipelineStageResult,
  // Stage Contexts
  NormalizationContext,
  ValidationContext,
  AnalysisContext,
  OptimizationContext,
  LoweringContext,
  // Passes & Results
  NormalizationPass,
  NormalizationResult,
  ValidationPass,
  ValidationResult,
  AnalysisPass,
  AnalysisResult,
  OptimizationPass,
  OptimizationResult,
  LoweringPass,
  LoweringResult,
  // Unified v3 Pass Model
  CompilerPass,
  PassContext,
  PassResult,
  PassPhase,
  // Diagnostics & Corrections
  Diagnostic,
  PipelineDiagnostic,
  Correction,
  AnalysisAnnotation,
  OptimizationSavings,
  GenerationTarget,
} from "./pipeline-types.js";

// Inspector Schema Types
export type {
  InspectorRule,
  InspectorExport,
  InspectorSnapshot,
  InspectorStats,
} from "./inspector/types.js";

// Symbol Table Engine
export {
  buildSymbolTable,
  resolveSymbol,
  findDependents,
  findDependencies,
  getSymbolsByKind,
  isUnused,
  findUnusedSymbols,
} from "./symbol-table.js";

// Persistent Incremental State
export {
  createCompilerState,
  updateState,
  markChangedRules,
  getDirtyRules,
  getStateStats,
  needsFullRecompile,
  type CompilerState,
} from "./persistent-compiler.js";