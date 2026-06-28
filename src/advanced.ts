// src/advanced.ts

/**
 * ChainCSS Advanced API
 * 
 * Power-user exports for pipeline customization, IR manipulation,
 * and advanced compiler control. Not needed for everyday usage.
 * 
 * Import from: 'chaincss/advanced'
 */

// Pipeline
export { 
  Pipeline, 
  createDefaultPipeline,
  createFullPipeline,
  createPipeline,
} from './compiler/pipeline/index.js';
export type { PipelinePreset } from './compiler/pipeline/index.js';
export type { 
  PipelineConfig, 
  PipelineResult, 
  PipelineStageResult,
  NormalizationPass,
  ValidationPass,
  AnalysisPass,
  OptimizationPass,
  LoweringPass,
  Diagnostic,
} from './compiler/pipeline/pipeline-types.js';

// Style IR
export {
  styleIR,
  createIR,
  parseIR,
  generateCSS,
  createRule,
  createDeclaration,
  applyPass,
  applyPasses,
  compileViaIR,
  countNodes,
  debugIR,
} from './compiler/style-ir.js';
export type {
  StyleIR,
  IRRule,
  IRDeclaration,
  IRPseudoClass,
  IRAtRule,
  IRCondition,
  IRDiagnostic,
  IRNodeId,
  IRPass,
} from './compiler/style-ir.js';

// Style Graph
export { StyleGraphCompiler, compileGraph } from './compiler/style-graph.js';
export type {
  StyleGraph,
  StyleGraphNode,
  StyleGraphEdge,
  GraphCompileOptions,
  GraphCompileResult,
} from './compiler/style-graph.js';

// Cache
export { CacheManager } from './compiler/cache/cache-manager.js';
export { PersistentCache } from './compiler/cache/content-addressable-cache.js';

// Atomic Optimizer (deprecated — use pipeline atomic-extractor pass instead)
/** @deprecated Atomic extraction is now handled by the pipeline's atomic-extractor pass. */
export { AtomicOptimizer } from './compiler/legacy/atomic-optimizer.js';
/** @deprecated Use pipeline's IR types instead. */
export type { AtomicClass } from './core/types.js';
export type { AtomicOptimizerStats } from './compiler/legacy/atomic-optimizer.js';

// Design Orchestrator
export {
  orchestrator,
  contrastRatio,
  checkContrast,
  auditContrast,
  createContextualToken,
  resolveContextual,
  generateContextualCSS,
  validateTokenRelationships,
} from './compiler/tokens/design-orchestrator.js';

// Math Engine
export { math, add, subtract, multiply, divide, fluidType, convert, toPx, scale } from './compiler/math-engine.js';

// Intent Engine
export { intent, correct, heal, validate as validateValue, getIntent } from './compiler/pipeline/normalizers/intent-detector.js';

// Legacy (deprecated)
/** @deprecated Use Pipeline from './pipeline/index.js' instead. Will be removed in v3.0. */
export { PassManager, DEFAULT_PIPELINE } from './compiler/pass-manager.js';
