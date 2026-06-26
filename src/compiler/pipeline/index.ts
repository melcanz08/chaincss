// src/compiler/pipeline/index.ts

export { Pipeline } from './pipeline.js';
export { createDefaultPipeline } from './default-pipeline.js';
export type {
  PipelineConfig,
  PipelineResult,
  PipelineStageResult,
  NormalizationPass,
  NormalizationResult,
  ValidationPass,
  ValidationResult,
  AnalysisPass,
  AnalysisResult,
  OptimizationPass,
  OptimizationResult,


  Diagnostic,
  Correction,
  AnalysisAnnotation,
  OptimizationSavings,
} from './pipeline-types.js';