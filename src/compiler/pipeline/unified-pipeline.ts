// src/compiler/pipeline/unified-pipeline.ts
import { clearKeyframeCache } from "../utils/shorthands.js";
// v2.13: Fixed phase ordering, deep merge contexts, token resolution as normalization

import { Pipeline } from './pipeline.js';
import type { OptimizationContext } from './pipeline-types.js';
import type { PipelineConfig, PipelineResult, NormalizationPass, NormalizationResult } from './pipeline-types.js';
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

// Token resolver as NormalizationPass — tokens must resolve before intent resolution
const tokenResolver: NormalizationPass = {
  name: tokenLowering.name,
  normalize(ir: StyleIR, context: Record<string, any> = {}): NormalizationResult {
    const result = tokenLowering.generate(ir, context);
    return { ir: result.ir, corrections: [] };
  },
};

const BASE_NORMALIZATION = [intentNormalizer, unitNormalizer, tokenResolver];
const BASE_OPTIMIZATION = [cssCompressor];
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
    // Fixed: deadCodeEliminator BEFORE specificitySorter
    optimization: [deadCodeEliminator, cssCompressor, specificitySorter, mediaQueryPacker, sourceOptimizer],
    lowering: BASE_LOWERING,
  },
  ci: {
    normalization: BASE_NORMALIZATION,
    validation: [accessibilityValidator, conflictValidator],
    analysis: [responsiveAnalyzer, layoutAnalyzer, patternDetector],
    optimization: [duplicateDeclarationDetector, deadCodeEliminator, cssCompressor, specificitySorter, mediaQueryPacker, sourceOptimizer, accessibilityOptimizer],
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
    optimization: [atomicExtractor, cssCompressor],
    lowering: [cssEmitter],
  },
};

function deepMerge<T extends Record<string, any>>(base: T, overrides: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const overrideVal = overrides[key];
    const baseVal = result[key];
    if (overrideVal !== undefined && typeof overrideVal === 'object' && !Array.isArray(overrideVal) && typeof baseVal === 'object' && !Array.isArray(baseVal)) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (Array.isArray(overrideVal)) {
      result[key] = [...overrideVal] as any;
    } else {
      result[key] = overrideVal as any;
    }
  }
  return result;
}

function deepCloneConfig<T>(config: T): T {
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

  if (preset === 'atomic') {
    cloned.contexts = cloned.contexts || {};
    cloned.contexts.optimization = {
      ...(cloned.contexts.optimization || {}),
      atomicUsageMap: new Map<string, number>(),
    };
  }

  const merged = overrides ? deepMerge(cloned, overrides) : cloned;

  clearKeyframeCache();
  return new Pipeline(merged as PipelineConfig);
}

export function createDefaultPipeline(overrides?: Partial<PipelineConfig>): Pipeline { return createPipeline('default', overrides); }
export function createFullPipeline(overrides?: Partial<PipelineConfig>): Pipeline { return createPipeline('ci', overrides); }

export { Pipeline } from './pipeline.js';
export type { PipelineResult, PipelineConfig, PipelineStageResult } from './pipeline-types.js';

export function isValidPreset(value: string): value is PipelinePreset { return value in PRESETS; }