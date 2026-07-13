// src/compiler/pipeline/unified-pipeline.ts
// Fixes: duplicate atomic Map clone, adds deep clone, supports custom intents via config

import { Pipeline } from './pipeline.js';
import type { OptimizationContext } from './pipeline-types.js';
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

const tokenOptimizer: OptimizationPass = {
  name: tokenLowering.name,
  cost: 'cheap',
  requiredFor: ['css'],
  optimize(ir: StyleIR, context: OptimizationContext = {} as OptimizationContext): OptimizationResult {
    const result = tokenLowering.generate(ir, context || {});
    return {
      ir: result.ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
      changes: result.generatedNodes,
    };
  },
};

const BASE_NORMALIZATION = [intentNormalizer, unitNormalizer];
const BASE_OPTIMIZATION = [tokenOptimizer, cssCompressor];
const BASE_LOWERING = [intentResolver, cssEmitter];

export type PipelinePreset = 'default' | 'production' | 'ci' | 'lint' | 'atomic';

const PRESETS: Record<PipelinePreset, Partial<PipelineConfig>> = {
  default: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: BASE_OPTIMIZATION,
    lowering: BASE_LOWERING,
  },
  production: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: [specificitySorter, deadCodeEliminator, ...BASE_OPTIMIZATION, mediaQueryPacker, sourceOptimizer],
    lowering: BASE_LOWERING,
  },
  ci: {
    normalization: BASE_NORMALIZATION,
    validation: [accessibilityValidator, conflictValidator],
    analysis: [responsiveAnalyzer, layoutAnalyzer, patternDetector],
    optimization: [duplicateDeclarationDetector, specificitySorter, deadCodeEliminator, ...BASE_OPTIMIZATION, mediaQueryPacker, sourceOptimizer, accessibilityOptimizer],
    lowering: BASE_LOWERING,
  },
  lint: {
    normalization: BASE_NORMALIZATION,
    validation: [accessibilityValidator, conflictValidator],
    analysis: [],
    optimization: [],
    lowering: [cssEmitter],
  },
  atomic: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    contexts: { optimization: {} },
    optimization: [atomicExtractor, ...BASE_OPTIMIZATION],
    lowering: [cssEmitter],
  },
};

function deepCloneConfig<T>(config: T): T {
  // Shallow clone arrays to prevent cross-pipeline mutation, keep pass references
  const clone: any = { ...config as any };
  if ((clone as any).normalization) clone.normalization = [...(clone as any).normalization];
  if ((clone as any).validation) clone.validation = [...(clone as any).validation];
  if ((clone as any).analysis) clone.analysis = [...(clone as any).analysis];
  if ((clone as any).optimization) clone.optimization = [...(clone as any).optimization];
  if ((clone as any).lowering) clone.lowering = [...(clone as any).lowering];
  if ((clone as any).contexts) {
    clone.contexts = { ...clone.contexts };
    if (clone.contexts.optimization) clone.contexts.optimization = { ...clone.contexts.optimization };
    if (clone.contexts.lowering) clone.contexts.lowering = { ...clone.contexts.lowering };
  }
  return clone;
}

export function createPipeline(preset: PipelinePreset = 'default', overrides?: Partial<PipelineConfig>): Pipeline {
  const base = PRESETS[preset];
  if (!base) throw new Error(`Unknown pipeline preset: "${preset}". Valid: ${Object.keys(PRESETS).join(', ')}`);

  const cloned = deepCloneConfig(base);

  // v3.1 fix: single, correct fresh Map for atomic preset, no duplicate block
  if (preset === 'atomic') {
    cloned.contexts = cloned.contexts || {};
    cloned.contexts.optimization = {
      ...(cloned.contexts.optimization || {}),
      atomicUsageMap: new Map<string, number>(),
    };
  }

  return new Pipeline({ ...cloned, ...overrides } as PipelineConfig);
}

export function createDefaultPipeline(overrides?: Partial<PipelineConfig>): Pipeline { return createPipeline('default', overrides); }
export function createFullPipeline(overrides?: Partial<PipelineConfig>): Pipeline { return createPipeline('ci', overrides); }

export { Pipeline } from './pipeline.js';
export type { PipelineResult, PipelineConfig, PipelineStageResult } from './pipeline-types.js';

export function isValidPreset(value: string): value is PipelinePreset { return value in PRESETS; }
