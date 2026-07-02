// src/compiler/pipeline/unified-pipeline.ts

/**
 * Unified Pipeline — Single source of truth for all CSS compilation passes.
 * 
 * Presets:
 *   default    — core passes (normalize + compress + lower)
 *   production — default + specificity + dead-code + media-query + source
 *   ci         — full validation + analysis + optimization (use in CI/linting)
 *   lint       — normalize + all validators + css emit (no optimization)
 *   atomic     — normalize + atomic extractor + css emit
 * 
 * Token lowering runs in the Optimization stage (before cssCompressor)
 * so that resolved design tokens get compressed/minified properly.
 */

import { Pipeline } from './pipeline.js';
import type { PipelineConfig, PipelineResult, OptimizationPass, OptimizationResult } from './pipeline-types.js';
import type { StyleIR } from './ir/types.js';

// Core passes
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
import { duplicateDeclarationDetector } from './optimizers/duplicate-declaration-detector.js';
import { responsiveAnalyzer } from './analyzers/responsive-analyzer.js';
import { layoutAnalyzer } from './analyzers/layout-analyzer.js';
import { patternDetector } from './analyzers/pattern-detector.js';

// ============================================================================
// Shared base — every preset includes these
// ============================================================================

const tokenOptimizer: OptimizationPass = {
  name: tokenLowering.name,
  cost: 'cheap',
  requiredFor: ['css'],
  optimize(ir: StyleIR): OptimizationResult {
    const result = tokenLowering.generate(ir, {});
    return {
      ir: result.ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
      changes: result.generatedNodes,
    };
  },
};

const BASE_NORMALIZATION = [intentNormalizer, unitNormalizer];
// Token lowering runs in optimization so cssCompressor can minify resolved tokens
const BASE_OPTIMIZATION = [tokenOptimizer, cssCompressor];
const BASE_LOWERING = [intentResolver, cssEmitter];

// ============================================================================
// Presets
// ============================================================================

export type PipelinePreset = 'default' | 'production' | 'ci' | 'lint' | 'atomic';

const PRESETS: Record<PipelinePreset, Partial<PipelineConfig>> = {
  /** Core passes — fast, zero-config. The default for everyday use. */
  default: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: BASE_OPTIMIZATION,
    lowering: BASE_LOWERING,
  },

  /** Production-grade optimization. */
  production: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: [
      specificitySorter,
      deadCodeEliminator,
      ...BASE_OPTIMIZATION,
      mediaQueryPacker,
      sourceOptimizer,
    ],
    lowering: BASE_LOWERING,
  },

  /** Full pipeline — validation + analysis + optimization. Use in CI. */
  ci: {
    normalization: BASE_NORMALIZATION,
    validation: [accessibilityValidator, conflictValidator],
    analysis: [responsiveAnalyzer, layoutAnalyzer, patternDetector],
    optimization: [
      duplicateDeclarationDetector,
      specificitySorter,
      deadCodeEliminator,
      ...BASE_OPTIMIZATION,
      mediaQueryPacker,
      sourceOptimizer,
      accessibilityOptimizer,
    ],
    lowering: BASE_LOWERING,
  },

  /** Validation only — no optimization. Use in dev for fast feedback. */
  lint: {
    normalization: BASE_NORMALIZATION,
    validation: [accessibilityValidator, conflictValidator],
    analysis: [],
    optimization: [],
    lowering: [cssEmitter],
  },

  /** Atomic CSS extraction. Emits utility classes instead of component CSS. */
  atomic: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: [atomicExtractor, ...BASE_OPTIMIZATION],
    lowering: [cssEmitter],
  },
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a fresh Pipeline instance from a named preset.
 * Each call returns a new pipeline — safe for concurrent use.
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
  return new Pipeline({ ...config, ...overrides });
}

/**
 * @deprecated Use createPipeline('default', overrides) instead.
 */
export function createDefaultPipeline(overrides?: Partial<PipelineConfig>): Pipeline {
  return createPipeline('default', overrides);
}

/**
 * @deprecated Use createPipeline('ci', overrides) instead.
 */
export function createFullPipeline(overrides?: Partial<PipelineConfig>): Pipeline {
  return createPipeline('ci', overrides);
}

// ============================================================================
// Re-exports
// ============================================================================

export { Pipeline } from './pipeline.js';
export type { PipelineResult, PipelineConfig, PipelineStageResult } from './pipeline-types.js';