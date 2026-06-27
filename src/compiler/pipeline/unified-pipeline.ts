// src/compiler/pipeline/unified-pipeline.ts

/**
 * Unified Pipeline — Single source of truth for all CSS compilation passes.
 */

import { Pipeline } from './pipeline.js';
import type { PipelineConfig, PipelineResult } from './pipeline-types.js';
import type { StyleIR } from '../style-ir.js';

// Core passes (always run)
import { intentNormalizer } from './normalizers/intent-normalizer.js';
import { unitNormalizer } from './normalizers/unit-normalizer.js';
import { cssCompressor } from './optimizers/css-compressor.js';
import { cssEmitter } from './lowering/css-emitter.js';
import { intentResolver } from './lowering/intent-resolver.js';
import { tokenLowering } from './lowering/token-lowering.js';

// Opt-in passes — import and add to pipeline if needed
import { accessibilityValidator } from './validators/accessibility-validator.js';
import { conflictValidator } from './validators/conflict-validator.js';
import { accessibilityOptimizer } from './optimizers/accessibility-optimizer.js';
import { specificitySorter } from './optimizers/specificity-sorter.js';
import { deadCodeEliminator } from './optimizers/dead-code-eliminator.js';
import { mediaQueryPacker } from './optimizers/media-query-packer.js';
import { sourceOptimizer } from './optimizers/source-optimizer.js';
import { responsiveAnalyzer } from './analyzers/responsive-analyzer.js';
import { layoutAnalyzer } from './analyzers/layout-analyzer.js';
import { patternDetector } from './analyzers/pattern-detector.js';

/**
 * Creates the default pipeline with only core 6 passes.
 * Fast, zero-config. Users opt into validation/analysis/optimization.
 */
export function createDefaultPipeline(overrides?: Partial<PipelineConfig>): Pipeline {
  return new Pipeline({
    normalization: [
      intentNormalizer,
      unitNormalizer,
    ],
    validation: [],
    analysis: [],
    optimization: [
      cssCompressor,
    ],
    lowering: [
      intentResolver,
      tokenLowering,
      cssEmitter,
    ],
    ...overrides,
  });
}

/**
 * Creates a pipeline with ALL passes enabled.
 * Used for testing and for users who want everything.
 */
export function createFullPipeline(overrides?: Partial<PipelineConfig>): Pipeline {
  return new Pipeline({
    normalization: [
      intentNormalizer,
      unitNormalizer,
    ],
    validation: [
      accessibilityValidator,
      conflictValidator,
    ],
    analysis: [
      responsiveAnalyzer,
      layoutAnalyzer,
      patternDetector,
    ],
    optimization: [
      specificitySorter,
      deadCodeEliminator,
      cssCompressor,
      mediaQueryPacker,
      sourceOptimizer,
      accessibilityOptimizer,
    ],
    lowering: [
      intentResolver,
      tokenLowering,
      cssEmitter,
    ],
    ...overrides,
  });
}

// Singleton for reuse
let _defaultPipeline: Pipeline | null = null;

export function getDefaultPipeline(): Pipeline {
  if (!_defaultPipeline) {
    _defaultPipeline = createDefaultPipeline();
  }
  return _defaultPipeline;
}

export function resetDefaultPipeline(): void {
  _defaultPipeline = null;
}

export { Pipeline } from './pipeline.js';
export type { PipelineResult, PipelineConfig, PipelineStageResult } from './pipeline-types.js';