// src/compiler/pipeline/default-pipeline.ts
//
// Core pipeline: 6 passes across 3 stages.
// Normalize → Optimize → Emit
//
// Optional linters/analyzers available as opt-in plugins:
//   import { patternDetector } from './analyzers/pattern-detector.js';
//   import { conflictValidator } from './validators/conflict-validator.js';
//   import { accessibilityValidator } from './validators/accessibility-validator.js';
//   import { accessibilityOptimizer } from './optimizers/accessibility-optimizer.js';
//   import { deadCodeEliminator } from './optimizers/dead-code-eliminator.js';
//   import { specificitySorter } from './optimizers/specificity-sorter.js';
//   import { sourceOptimizer } from './optimizers/source-optimizer.js';

import { Pipeline } from './pipeline.js';
import type { PipelineConfig } from './pipeline-types.js';

// Core passes — always run
import { intentNormalizer } from './normalizers/intent-normalizer.js';
import { unitNormalizer } from './normalizers/unit-normalizer.js';
import { cssCompressor } from './optimizers/css-compressor.js';
import { cssEmitter } from './lowering/css-emitter.js';
import { intentResolver } from './lowering/intent-resolver.js';
import { tokenLowering } from './lowering/token-lowering.js';

export function createDefaultPipeline(): Pipeline {
  const config: PipelineConfig = {
    normalization: [
      intentNormalizer,
      unitNormalizer,
    ],
    validation: [
      // accessibilityValidator,    // opt-in: @chaincss/lint
      // conflictValidator,         // opt-in: @chaincss/lint
    ],
    analysis: [
      // responsiveAnalyzer,        // opt-in: @chaincss/analyze
      // layoutAnalyzer,            // opt-in: @chaincss/analyze
      // patternDetector,           // opt-in: @chaincss/analyze
    ],
    optimization: [
      cssCompressor,
      // accessibilityOptimizer,    // opt-in: @chaincss/lint
      // specificitySorter,         // opt-in: @chaincss/optimize
      // deadCodeEliminator,        // opt-in: @chaincss/optimize
      // mediaQueryPacker,          // opt-in: @chaincss/optimize
      // sourceOptimizer,           // opt-in: @chaincss/optimize
    ],
    lowering: [
      intentResolver,
      tokenLowering,
      // constraintResolver,        // opt-in: @chaincss/resolve
      cssEmitter,
    ],
  };

  return new Pipeline(config);
}
