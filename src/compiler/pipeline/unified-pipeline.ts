// ============================================================================
// FILE: src/compiler/pipeline/unified-pipeline.ts
// ============================================================================

import { clearKeyframeCache } from "../utils/shorthands.js";
import { Pipeline } from './pipeline.js';
import type {
  PipelineConfig,
  PipelineResult,
  NormalizationPass,
  NormalizationResult,
  LoweringPass,
  OptimizationPass,
  OptimizationResult
} from './pipeline-types.js';
import type { StyleIR } from './ir/types.js';

import { intentNormalizer } from './normalizers/intent-normalizer.js';
import { unitNormalizer } from './normalizers/unit-normalizer.js';
import { cssCompressor } from './optimizers/css-compressor.js';
import { cssEmitter } from './lowering/css-emitter.js';
import { intentResolver } from './lowering/intent-resolver.js';
import { tokenLowering } from './lowering/token-lowering.js';

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

// Import animation dependency mechanics safely
import AnimationRegistry from '../animations.js';

/**
 * Custom pass to track animation properties and automatically pull matching 
 * keyframe node structures straight into the compiled IR tree.
 */
const dynamicAnimationResolver: OptimizationPass = {
  name: 'dynamic-animation-resolver',
  cost: 'cheap',
  requiredFor: [],
  optimize(ir: StyleIR, context: Record<string, any> = {}): OptimizationResult {
    if (!ir || !ir.rules) return { 
      ir, 
      savings: {} as any, 
      changes: 0 
    } as unknown as OptimizationResult;

    const activeAnimationNames = new Set<string>();
    const registry = AnimationRegistry as any;

    // 1. Trace rules within the AST mapping to find macro definitions
    for (const rule of ir.rules) {
      const allDecls = [
       ...(rule.declarations || []),
       ...(rule.pseudoClasses?.flatMap(pc => pc.declarations || []) || [])
      ];
      if (allDecls.length === 0) continue;

      for (const decl of allDecls) {
        if ((decl.property === 'animation' || decl.property === 'animation-name') && decl.value) {
          const raw = String(decl.value).split(',');
          for (const part of raw) {
            const name = part.trim().split(' ')[0]!;
            if (name &&!['none','inherit','initial','unset'].includes(name)) {
              activeAnimationNames.add(name);
            }
          }
        }
      }
    }

    // 2. Fetch compile-ready nodes from your registry layer
    for (const animName of activeAnimationNames) {
      if (registry.has(animName)) {
        const keyframeNode = registry.getCompiledKeyframeNode(animName);
        if (keyframeNode) {
          // Push it safely straight into the rules collection array
          ir.rules.push(keyframeNode as any);
        }
      }
    }

    return { 
      ir, 
      savings: {} as any, 
      changes: activeAnimationNames.size 
    } as unknown as OptimizationResult;
  }
};

const tokenNormalizationAdapter: NormalizationPass = {
  name: 'token-lowering-bridge',
  normalize(ir, context): NormalizationResult {
    const res = tokenLowering.generate(ir, context as any);
    return { ir: res.ir, corrections: [] };
  },
};

const BASE_NORMALIZATION = [intentNormalizer, unitNormalizer, tokenNormalizationAdapter];
// Include the animation engine pass directly into your standard base sequence smoothly
const BASE_OPTIMIZATION = [dynamicAnimationResolver, cssCompressor];
const BASE_LOWERING = [intentResolver, cssEmitter];

export type PipelinePreset = 'default' | 'production' | 'ci' | 'lint' | 'atomic';

const PRESETS: Record<PipelinePreset, Partial<PipelineConfig>> = {
  default: { normalization: BASE_NORMALIZATION, validation: [], analysis: [], optimization: BASE_OPTIMIZATION, lowering: BASE_LOWERING },
  production: { normalization: BASE_NORMALIZATION, validation: [], analysis: [], optimization: [dynamicAnimationResolver, deadCodeEliminator, cssCompressor, specificitySorter, mediaQueryPacker, sourceOptimizer], lowering: BASE_LOWERING },
  ci: { normalization: BASE_NORMALIZATION, validation: [accessibilityValidator, conflictValidator], analysis: [responsiveAnalyzer, layoutAnalyzer, patternDetector], optimization: [duplicateDeclarationDetector, dynamicAnimationResolver, deadCodeEliminator, cssCompressor, specificitySorter, mediaQueryPacker, sourceOptimizer, accessibilityOptimizer], lowering: BASE_LOWERING },
  lint: { normalization: BASE_NORMALIZATION, validation: [accessibilityValidator, conflictValidator], analysis: [], optimization: [], lowering: BASE_LOWERING },
  atomic: { normalization: BASE_NORMALIZATION, validation: [], analysis: [], optimization: [dynamicAnimationResolver, atomicExtractor, cssCompressor], lowering: BASE_LOWERING },
};

function deepMerge<T extends Record<string, any>>(base: T, overrides: Partial<T>): T {
  const result = {...base };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const ov = overrides[key];
    const bv = result[key];
    if (ov !== undefined && typeof ov === 'object' && !Array.isArray(ov) && ov !== null && typeof bv === 'object' && !Array.isArray(bv) && bv !== null) {
      result[key] = deepMerge(bv as any, ov as any);
    } else if (Array.isArray(ov)) {
      result[key] = [...ov] as any;
    } else {
      result[key] = ov as any;
    }
  }
  return result;
}

function deepCloneConfig(config: Partial<PipelineConfig>): PipelineConfig {
  const clone: any = {...config };
  if (clone.normalization) clone.normalization = [...clone.normalization];
  if (clone.validation) clone.validation = [...clone.validation];
  if (clone.analysis) clone.analysis = [...clone.analysis];
  if (clone.optimization) clone.optimization = [...clone.optimization];
  if (clone.lowering) clone.lowering = [...clone.lowering];
  clone.contexts = {...(clone.contexts || {}) };
  clone.contexts.normalization = {...(clone.contexts.normalization || {}) };
  clone.contexts.validation = {...(clone.contexts.validation || {}) };
  clone.contexts.analysis = {...(clone.contexts.analysis || {}) };
  clone.contexts.optimization = {...(clone.contexts.optimization || {}) };
  clone.contexts.lowering = {...(clone.contexts.lowering || {}) };
  return clone as PipelineConfig;
}

export function createPipeline(preset: PipelinePreset = 'default', overrides?: Partial<PipelineConfig>): Pipeline {
  const base = PRESETS[preset];
  if (!base) throw new Error(`Unknown preset: "${preset}". Valid: ${Object.keys(PRESETS).join(', ')}`);

  const cloned = deepCloneConfig(base);
  const merged: any = overrides ? deepMerge(cloned as any, overrides as any) : cloned;

  if (preset === 'atomic') {
    merged.contexts = merged.contexts || {};
    merged.contexts.optimization = merged.contexts.optimization || {};
    if (!merged.contexts.optimization.atomicUsageMap) {
      merged.contexts.optimization.atomicUsageMap = new Map<string, number>();
    }
  }

  if (merged.lowering) {
    merged.lowering = (merged.lowering as LoweringPass[]).filter((p) => p.name !== tokenLowering.name);
  }

  clearKeyframeCache();
  return new Pipeline(merged as PipelineConfig);
}

export function createDefaultPipeline(overrides?: Partial<PipelineConfig>): Pipeline { return createPipeline('default', overrides); }
export function createFullPipeline(overrides?: Partial<PipelineConfig>): Pipeline { return createPipeline('ci', overrides); }
export { Pipeline } from './pipeline.js';
export type { PipelineResult, PipelineConfig, PipelineStageResult } from './pipeline-types.js';
export function isValidPreset(v: string): v is PipelinePreset { return Object.prototype.hasOwnProperty.call(PRESETS, v); }