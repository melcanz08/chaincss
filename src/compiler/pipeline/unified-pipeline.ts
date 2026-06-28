// src/compiler/pipeline/unified-pipeline.ts

/**
 * Unified Pipeline — Single source of truth for all CSS compilation passes.
 * 
 * Presets:
 *   default    — core 6 passes (normalize + compress + lower)
 *   production — default + specificity + dead-code + media-query + source
 *   analysis   — full validation + analysis + optimization
 *   lint       — normalize + all validators + css emit (no optimization)
 *   atomic     — normalize + atomic extractor + css emit
 * 
 * All passes are stateless. Each createPipeline() call returns a fresh
 * Pipeline instance — no global singletons that could bleed state between
 * concurrent compilations.
 */

import { Pipeline } from './pipeline.js';
import type { PipelineConfig, PipelineResult } from './pipeline-types.js';
import type { StyleIR } from './ir/types.js';

// Core passes (always run)
import { intentNormalizer } from './normalizers/intent-normalizer.js';
import { unitNormalizer } from './normalizers/unit-normalizer.js';
import { cssCompressor } from './optimizers/css-compressor.js';
import { cssEmitter } from './lowering/css-emitter.js';
import { intentResolver } from './lowering/intent-resolver.js';
import { tokenLowering } from './lowering/token-lowering.js';

// Opt-in passes
import { accessibilityValidator } from './validators/accessibility-validator.js';
import { conflictValidator } from './validators/conflict-validator.js';
import { accessibilityOptimizer } from './optimizers/accessibility-optimizer.js';
import { specificitySorter } from './optimizers/specificity-sorter.js';
import { deadCodeEliminator } from './optimizers/dead-code-eliminator.js';
import { mediaQueryPacker } from './optimizers/media-query-packer.js';
import { sourceOptimizer } from './optimizers/source-optimizer.js';
import { atomicExtractor } from './optimizers/atomic-extractor.js';
import { responsiveAnalyzer } from './analyzers/responsive-analyzer.js';
import { layoutAnalyzer } from './analyzers/layout-analyzer.js';
import { patternDetector } from './analyzers/pattern-detector.js';

// ============================================================================
// Presets
// ============================================================================

export type PipelinePreset = 'default' | 'production' | 'analysis' | 'lint' | 'atomic';

const PRESETS: Record<PipelinePreset, Partial<PipelineConfig>> = {
  /** Core 6 passes — fast, zero-config. The default for everyday use. */
  default: {
    normalization: [intentNormalizer, unitNormalizer],
    validation: [],
    analysis: [],
    optimization: [cssCompressor],
    lowering: [intentResolver, tokenLowering, cssEmitter],
  },

  /** Production-grade optimization without analysis overhead. */
  production: {
    normalization: [intentNormalizer, unitNormalizer],
    validation: [],
    analysis: [],
    optimization: [
      specificitySorter,
      deadCodeEliminator,
      cssCompressor,
      mediaQueryPacker,
      sourceOptimizer,
    ],
    lowering: [intentResolver, tokenLowering, cssEmitter],
  },

  /** Full pipeline — validation + analysis + optimization. Use for CI/linting. */
  analysis: {
    normalization: [intentNormalizer, unitNormalizer],
    validation: [accessibilityValidator, conflictValidator],
    analysis: [responsiveAnalyzer, layoutAnalyzer, patternDetector],
    optimization: [
      specificitySorter,
      deadCodeEliminator,
      cssCompressor,
      mediaQueryPacker,
      sourceOptimizer,
      accessibilityOptimizer,
    ],
    lowering: [intentResolver, tokenLowering, cssEmitter],
  },

  /** Validation only — no optimization. Use in dev for fast feedback. */
  lint: {
    normalization: [intentNormalizer, unitNormalizer],
    validation: [accessibilityValidator, conflictValidator],
    analysis: [],
    optimization: [],
    lowering: [cssEmitter],
  },

  /** Atomic CSS extraction. Emits utility classes instead of component CSS. */
  atomic: {
    normalization: [intentNormalizer, unitNormalizer],
    validation: [],
    analysis: [],
    optimization: [atomicExtractor, cssCompressor],
    lowering: [cssEmitter],
  },
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a fresh Pipeline instance from a named preset.
 * 
 * Each call returns a NEW pipeline — no shared state, no singletons.
 * Safe for concurrent use in SSR, dev servers, and parallel builds.
 * 
 * @example
 * import { createPipeline } from 'chaincss';
 * 
 * const pipeline = createPipeline('production');
 * const pipeline = createPipeline('lint', {
 *   contexts: { validation: { wcagLevel: 'AA' } }
 * });
 */
export function createPipeline(
  preset: PipelinePreset = 'default',
  overrides?: Partial<PipelineConfig>
): Pipeline {
  const config = PRESETS[preset];
  if (!config) {
    throw new Error(
      `Unknown pipeline preset: "${preset}". ` +
      `Valid presets: ${Object.keys(PRESETS).join(', ')}`
    );
  }
  // Create a fresh instance every time — no global singleton
  return new Pipeline({ ...config, ...overrides });
}

/**
 * @deprecated Use createPipeline('default', overrides) instead.
 * Each call creates a fresh pipeline instance.
 */
export function createDefaultPipeline(overrides?: Partial<PipelineConfig>): Pipeline {
  return createPipeline('default', overrides);
}

/**
 * @deprecated Use createPipeline('analysis', overrides) instead.
 * Each call creates a fresh pipeline instance.
 */
export function createFullPipeline(overrides?: Partial<PipelineConfig>): Pipeline {
  return createPipeline('analysis', overrides);
}

// ============================================================================
// Re-exports
// ============================================================================

export { Pipeline } from './pipeline.js';
export type { PipelineResult, PipelineConfig, PipelineStageResult } from './pipeline-types.js';
