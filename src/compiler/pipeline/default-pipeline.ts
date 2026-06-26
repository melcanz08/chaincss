// src/compiler/pipeline/default-pipeline.ts

import { Pipeline } from './pipeline.js';
import type { PipelineConfig } from './pipeline-types.js';

// Only import passes that ACTUALLY EXIST
import { accessibilityValidator } from './validators/accessibility-validator.js';
import { accessibilityOptimizer } from './optimizers/accessibility-optimizer.js';

import { intentNormalizer } from './normalizers/intent-normalizer.js';
import { unitNormalizer } from './normalizers/unit-normalizer.js';
import { conflictValidator } from './validators/conflict-validator.js';

import { responsiveAnalyzer } from './analyzers/responsive-analyzer.js';
import { layoutAnalyzer } from './analyzers/layout-analyzer.js';
import { patternDetector } from './analyzers/pattern-detector.js';

import { specificitySorter } from './optimizers/specificity-sorter.js';
import { deadCodeEliminator } from './optimizers/dead-code-eliminator.js';
import { atomicExtractor } from './optimizers/atomic-extractor.js';
import { mediaQueryPacker } from './optimizers/media-query-packer.js';
import { cssCompressor } from './optimizers/css-compressor.js';
import { sourceOptimizer } from './optimizers/source-optimizer.js';

import { intentResolver } from './lowering/intent-resolver.js';
import { tokenLowering } from './lowering/token-lowering.js';
import { constraintResolver } from './lowering/constraint-resolver.js';
import { cssEmitter } from './lowering/css-emitter.js';

export function createDefaultPipeline(): Pipeline {
  const config: PipelineConfig = {
    normalization: [
      intentNormalizer,
      unitNormalizer,
    ], 
    validation: [
      accessibilityValidator,
      conflictValidator
    ],
    analysis: [
      responsiveAnalyzer,
      layoutAnalyzer,
      patternDetector,
    ], 
    optimization: [
      accessibilityOptimizer,
      specificitySorter,
      deadCodeEliminator,
      atomicExtractor,
      mediaQueryPacker,
      sourceOptimizer,
      cssCompressor,
    ],
    lowering: [
      intentResolver,
      tokenLowering,
      constraintResolver,
      cssEmitter,
    ],
  };

  return new Pipeline(config);
}