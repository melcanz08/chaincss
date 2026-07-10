// src/compiler/pipeline/default-pipeline.ts
//
// Core pipeline: 6 passes across 3 stages.
// Normalize → Optimize (incl. token resolution) → Emit
// Token lowering runs in optimization so resolved values get compressed.
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
import type { PipelineConfig, OptimizationResult, GenerationTarget } from './pipeline-types.js';
import type { StyleIR } from './ir/types.js';

// Core passes — always run
import { intentNormalizer } from './normalizers/intent-normalizer.js';
import { unitNormalizer } from './normalizers/unit-normalizer.js';
import { cssCompressor } from './optimizers/css-compressor.js';
import { cssEmitter } from './lowering/css-emitter.js';
import { intentResolver } from './lowering/intent-resolver.js';
import { tokenLowering } from './lowering/token-lowering.js';


// Adapter: wrap tokenLowering as an OptimizationPass so it runs before cssCompressor.
// This ensures resolved $token values get compressed/minified.
const tokenOptimizer = {
  name: tokenLowering.name,
  cost: 'cheap' as const,
  requiredFor: ['css'] as GenerationTarget[],
  optimize(ir: any, context?: any): any {
    const result = tokenLowering.generate(ir, context || {});
    return {
      ir: result.ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
      changes: result.generatedNodes,
    };
  },
};

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
      tokenOptimizer,
      cssCompressor,
      // accessibilityOptimizer,    // opt-in: @chaincss/lint
      // specificitySorter,         // opt-in: @chaincss/optimize
      // deadCodeEliminator,        // opt-in: @chaincss/optimize
      // mediaQueryPacker,          // opt-in: @chaincss/optimize
      // sourceOptimizer,           // opt-in: @chaincss/optimize
    ],
    lowering: [
      intentResolver,
      // constraintResolver,        // opt-in: @chaincss/resolve
      cssEmitter,
    ],
  };

  return new Pipeline(config);
}
