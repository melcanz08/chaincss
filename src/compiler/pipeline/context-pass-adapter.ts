// src/compiler/pipeline/context-pass-adapter.ts
// Adapts existing passes to receive CompilerContext instead of raw IR

import type { CompilerContext } from "./compiler-context.js";
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
} from "./pipeline-types.js";

// ============================================================================
// Context-Aware Pass Interfaces
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
  cost: "cheap" | "moderate" | "expensive";
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
  normCtx: NormalizationContext,
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
  valCtx: ValidationContext,
): ContextValidationPass {
  return {
    name: pass.name,
    validate(ctx: CompilerContext): ValidationResult {
      return pass.validate(ctx.ir, valCtx);
    },
  };
}

/**
 * Wrap a traditional AnalysisPass to work with CompilerContext.
 */
export function adaptAnalysisPass(
  pass: AnalysisPass,
  analysisCtx: AnalysisContext,
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
  optCtx: OptimizationContext,
): ContextOptimizationPass {
  return {
    name: pass.name,
    cost: pass.cost,
    requiredFor: [...pass.requiredFor],
    optimize(ctx: CompilerContext): OptimizationResult {
      if (!optCtx.atomicUsageMap) {
        optCtx.atomicUsageMap = new Map();
      }
      return pass.optimize(ctx.ir, optCtx);
    },
  };
}

/**
 * Wrap a traditional LoweringPass to work with CompilerContext.
 */
export function adaptLoweringPass(
  pass: LoweringPass,
  lowerCtx: LoweringContext,
): ContextLoweringPass {
  return {
    name: pass.name,
    generate(ctx: CompilerContext): LoweringResult {
      return pass.generate(ctx.ir, lowerCtx);
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function collectDiagnostics(
  ctx: CompilerContext,
  passName: string,
  diagnostics?: Array<{
    severity: "error" | "warning" | "info" | "hint";
    message: string;
    suggestion?: string;
    nodeId?: string;
  }>,
): void {
  if (diagnostics) {
    for (const d of diagnostics) {
      ctx.addDiagnostic(d.severity, d.message, passName, {
        suggestion: d.suggestion,
        nodeId: d.nodeId,
      });
    }
  }
}

// ============================================================================
// Pipeline with Context
// ============================================================================

/**
 * Run all context-aware passes in sequence.
 * Updates the CompilerContext after each pass with high-precision timing.
 */
export function runContextPipeline(
  ctx: CompilerContext,
  passes: {
    normalization?: ContextNormalizationPass[];
    validation?: ContextValidationPass[];
    analysis?: ContextAnalysisPass[];
    optimization?: ContextOptimizationPass[];
    lowering?: ContextLoweringPass[];
  },
): CompilerContext {
  const pipelineStart = performance.now();

  // Normalization
  if (passes.normalization) {
    for (const pass of passes.normalization) {
      const start = performance.now();
      const result = pass.normalize(ctx);
      const duration = performance.now() - start;

      if (result.ir) ctx.updateIR(result.ir);
      collectDiagnostics(ctx, pass.name, (result as any).diagnostics);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: "normalization",
        pass: pass.name,
        duration,
        result: result as any,
      });
    }
  }

  // Validation
  if (passes.validation) {
    for (const pass of passes.validation) {
      const start = performance.now();
      const result = pass.validate(ctx);
      const duration = performance.now() - start;

      collectDiagnostics(ctx, pass.name, result.diagnostics);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: "validation",
        pass: pass.name,
        duration,
        result: result as any,
      });
    }
  }

  // Analysis
  if (passes.analysis) {
    for (const pass of passes.analysis) {
      const start = performance.now();
      const result = pass.analyze(ctx);
      const duration = performance.now() - start;

      if (result.ir) ctx.updateIR(result.ir);
      collectDiagnostics(ctx, pass.name, (result as any).diagnostics);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: "analysis",
        pass: pass.name,
        duration,
        result: result as any,
      });
    }
  }

  // Optimization
  if (passes.optimization) {
    for (const pass of passes.optimization) {
      const start = performance.now();
      const result = pass.optimize(ctx);
      const duration = performance.now() - start;

      if (result.ir) ctx.updateIR(result.ir);
      collectDiagnostics(ctx, pass.name, (result as any).diagnostics);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: "optimization",
        pass: pass.name,
        duration,
        result: result as any,
      });
    }
  }

  // Lowering
  if (passes.lowering) {
    for (const pass of passes.lowering) {
      const start = performance.now();
      const result = pass.generate(ctx);
      const duration = performance.now() - start;

      if (result.ir) ctx.updateIR(result.ir);
      collectDiagnostics(ctx, pass.name, (result as any).diagnostics);
      ctx.setPassResult(pass.name, result as any);
      ctx.timeline.push({
        stage: "lowering",
        pass: pass.name,
        duration,
        result: result as any,
      });
    }
  }

  ctx.recordCompile(performance.now() - pipelineStart);
  return ctx;
}