// src/compiler/pipeline/index.ts

/**
 * ChainCSS Pipeline
 * 
 * Unified 5-stage compilation pipeline.
 * All exports from this module are the canonical pipeline API.
 */

export { Pipeline } from './pipeline.js';
export { 
  createDefaultPipeline,
  createFullPipeline,
  createPipeline,
} from './unified-pipeline.js';
export type { PipelinePreset } from './unified-pipeline.js';

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
  LoweringPass,
  LoweringResult,
  Diagnostic,
  Correction,
} from './pipeline-types.js';
