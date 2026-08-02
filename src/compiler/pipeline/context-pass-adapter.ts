// src/compiler/pipeline/context-pass-adapter.ts
// Adapts existing passes to receive CompilerContext instead of raw IR

import type { CompilerContext } from './compiler-context.js';
import type {
  NormalizationPass,
  ValidationPass,
  AnalysisPass,
  OptimizationPass,
  LoweringPass,
  NormalizationResult,
  ValidationResult,
  AnalysisResult,
  OptimizationResult,
  LoweringResult,
  NormalizationContext,
  ValidationContext,
  AnalysisContext,
  OptimizationContext,
  LoweringContext,
} from './pipeline-types.js';
import type { StyleIR } from './ir/types.js';

// ============================================================================
// Context-Aware Pass Interfaces (new)
// ============================================================================

export interface ContextNormalizationPass {
  name: string;
  normalize(ctx: CompilerContext): NormalizationResult;
}

export interface ContextValidationPass {
  name: string;
  validate(ctx: CompilerContext): ValidationResult;
}

export interface ContextAnalysisPass {
  name: string;
  analyze(ctx: CompilerContext): AnalysisResult;
}

export interface ContextOptimizationPass {
  name: string;
  cost: 'cheap' | 'moderate' | 'expensive';
  requiredFor: string[];
  optimize(ctx: CompilerContext): OptimizationResult;
}

export interface ContextLoweringPass {
  name: string;
  generate(ctx: CompilerContext): LoweringResult;
}

// ============================================================================
// Adapters: Old → New
// ============================================================================

/**
 * Wrap a traditional NormalizationPass to work with CompilerContext.
 */
export function adaptNormalizationPass(
  pass: NormalizationPass,
  normCtx: NormalizationContext
): ContextNormalizationPass {
  return {
    name: pass.name,
    normalize(ctx: CompilerContext): NormalizationResult {
      return pass.normalize(ctx.ir, normCtx);
    },
  };
}

/**
 * Wrap a traditional ValidationPass to work with CompilerContext.
 */
export function adaptValidationPass(
  pass: ValidationPass,
  valCtx: ValidationContext
): ContextValidationPass {
  return {
    name: pass.name,
    validate(ctx: CompilerContext): ValidationResult {
      const result = pass.validate(ctx.ir, valCtx);
      // Auto-collect diagnostics into context
      if (result.diagnostics) {
        for (const d of result.diagnostics) {
          ctx.addDiagnostic(d.severity, d.message, pass.name, {
            suggestion: d.suggestion,
            nodeId: d.nodeId,
          });
        }
      }
      return result;
    },
  };
}

/**
 * Wrap a traditional AnalysisPass to work with CompilerContext.
 */
export function adaptAnalysisPass(
  pass: AnalysisPass,
  analysisCtx: AnalysisContext
): ContextAnalysisPass {
  return {
    name: pass.name,
    analyze(ctx: CompilerContext): AnalysisResult {
      return pass.analyze(ctx.ir, analysisCtx);
    },
  };
}

/**
 * Wrap a traditional OptimizationPass to work with CompilerContext.
 */
export function adaptOptimizationPass(
  pass: OptimizationPass,
  optCtx: OptimizationContext
): ContextOptimizationPass {
  return {
    name: pass.name,
    cost: pass.cost,
    requiredFor: [...pass.requiredFor],
    optimize(ctx: CompilerContext): OptimizationResult {
      // Use cached graph/symbols from context instead of rebuilding
      if (!optCtx.atomicUsageMap) {
        optCtx.atomicUsageMap = new Map();
      }
      const result = pass.optimize(ctx.ir, optCtx);
      // Store result for later passes
      ctx.setPassResult(pass.name, result as any);
      return result;
    },
  };
}

/**
 * Wrap a traditional LoweringPass to work with CompilerContext.
 */
export function adaptLoweringPass(
  pass: LoweringPass,
  lowerCtx: LoweringContext
): ContextLoweringPass {
  return {
    name: pass.name,
    generate(ctx: CompilerContext): LoweringResult {
      return pass.generate(ctx.ir, lowerCtx);
    },
  };
}

// ============================================================================
// Pipeline with Context
// ============================================================================

/**
 * Run all context-aware passes in sequence.
 * Updates the CompilerContext after each pass.
 */
export function runContextPipeline(
  ctx: CompilerContext,
  passes: {
    normalization?: ContextNormalizationPass[];
    validation?: ContextValidationPass[];
    analysis?: ContextAnalysisPass[];
    optimization?: ContextOptimizationPass[];
    lowering?: ContextLoweringPass[];
  }
): CompilerContext {
  const startTime = Date.now();

  // Normalization
  if (passes.normalization) {
    for (const pass of passes.normalization) {
      const result = pass.normalize(ctx);
      ctx.updateIR(result.ir);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: 'normalization',
        pass: pass.name,
        duration: 0,
        result: result as any,
      });
    }
  }

  // Validation
  if (passes.validation) {
    for (const pass of passes.validation) {
      const result = pass.validate(ctx);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: 'validation',
        pass: pass.name,
        duration: 0,
        result: result as any,
      });
    }
  }

  // Analysis
  if (passes.analysis) {
    for (const pass of passes.analysis) {
      const result = pass.analyze(ctx);
      ctx.updateIR(result.ir);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: 'analysis',
        pass: pass.name,
        duration: 0,
        result: result as any,
      });
    }
  }

  // Optimization
  if (passes.optimization) {
    for (const pass of passes.optimization) {
      const result = pass.optimize(ctx);
      ctx.updateIR(result.ir);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: 'optimization',
        pass: pass.name,
        duration: 0,
        result: result as any,
      });
    }
  }

  // Lowering
  if (passes.lowering) {
    for (const pass of passes.lowering) {
      const result = pass.generate(ctx);
      ctx.updateIR(result.ir);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: 'lowering',
        pass: pass.name,
        duration: 0,
        result: result as any,
      });
    }
  }

  ctx.recordCompile(Date.now() - startTime);
  return ctx;
}
