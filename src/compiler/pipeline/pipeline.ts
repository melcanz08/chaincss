// src/compiler/pipeline/pipeline.ts

import type {
  PipelineConfig,
  PipelineResult,
  PipelineStageResult,
  LoweringPass,
  NormalizationPass,
  NormalizationResult,
  ValidationPass,
  ValidationResult,
  AnalysisPass,
  AnalysisResult,
  OptimizationPass,
  OptimizationResult,
  NormalizationContext,
  ValidationContext,
  AnalysisContext,
  OptimizationContext,
  LoweringContext,
} from './pipeline-types.js';
import type { StyleIR } from './ir/types.js';

export class Pipeline {
  private normalization: NormalizationPass[];
  private validation: ValidationPass[];
  private analysis: AnalysisPass[];
  private optimization: OptimizationPass[];
  private lowering: LoweringPass[];

  // Guaranteed non-undefined — initialized inline, never optional
  private normCtx: NormalizationContext;
  private valCtx: ValidationContext;
  private analysisCtx: AnalysisContext;
  private optCtx: OptimizationContext;
  private lowerCtx: LoweringContext;

  private lastResult: PipelineResult | null = null;

  constructor(config: PipelineConfig = {}) {
    this.normalization = config.normalization || [];
    this.validation = config.validation || [];
    this.analysis = config.analysis || [];
    this.optimization = config.optimization || [];
    this.lowering = config.lowering || [];
    this.normCtx = config.contexts?.normalization || {};
    this.valCtx = config.contexts?.validation || {};
    this.analysisCtx = config.contexts?.analysis || {};
    this.optCtx = config.contexts?.optimization || {};
    this.lowerCtx = config.contexts?.lowering || {};
  }

  async execute(ir: StyleIR): Promise<PipelineResult> {
    return this.runSync(ir);
  }

  executeSync(ir: StyleIR): PipelineResult {
    return this.runSync(ir);
  }

  getLastResult(): PipelineResult | null {
    return this.lastResult;
  }

  private runPassSafe<T>(
    stage: string,
    passName: string,
    fn: () => T,
    current: StyleIR
  ): { result: T | null; duration: number } {
    const startTime = Date.now();
    try {
      const result = fn();
      return { result, duration: Date.now() - startTime };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      current.diagnostics.push({
        id: `pass-crash-${passName}-${Date.now()}`,
        nodeId: current.id,
        severity: 'error',
        message: `Pass "${passName}" threw an unhandled error: ${message}`,
        suggestion: 'Check the pass implementation for unhandled edge cases.',
        pass: `${stage}:${passName}`,
      });
      return { result: null, duration: Date.now() - startTime };
    }
  }

  private detectFeatures(ir: StyleIR): Set<string> {
    const features = new Set<string>();
    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      if (rule.meta._constraints && rule.meta._constraints.length > 0) features.add('constraints');
      if (rule.meta._semantic && rule.meta._semantic.length > 0) features.add('semantic-tokens');
      if (rule.meta._intent) features.add('intents');
      if (rule.atRules.length > 0) features.add('at-rules');
      if (rule.pseudoClasses.length > 0) features.add('pseudo-classes');
      if (rule.declarations.length > 0) features.add('declarations');
      for (const decl of rule.declarations) {
        if (typeof decl.value === 'string') {
          if (decl.value.includes('vh') || decl.value.includes('vw')) features.add('viewport-units');
          const pxMatch = decl.value.match(/^\d+px$/);
          if (pxMatch && parseInt(decl.value) > 768) features.add('large-fixed');
          if (decl.property === 'display' && (decl.value === 'flex' || decl.value === 'grid')) features.add('flexbox-grid');
        }
      }
    }
    features.add('core');
    return features;
  }

  private shouldRun(passName: string, features: Set<string>): boolean {
    // Normalization always runs
    if (passName === 'intent-normalizer' || passName === 'unit-normalizer') return true;

    // Validation always runs
    if (passName === 'accessibility-validator' || passName === 'conflict-validator') return true;

    // Analysis: skip if nothing to analyze
    if (passName === 'responsive-analyzer') return features.has('viewport-units') || features.has('large-fixed');
    if (passName === 'layout-analyzer') return features.has('flexbox-grid');
    if (passName === 'pattern-detector') return features.has('declarations');

    // Optimization
    if (passName === 'specificity-sorter') return true;       // ← ALWAYS runs
    if (passName === 'dead-code-eliminator') return true;     // ← ALWAYS runs
    if (passName === 'accessibility-optimizer') return features.has('declarations');
    if (passName === 'atomic-extractor') return features.has('declarations');
    if (passName === 'media-query-packer') return features.has('at-rules');
    if (passName === 'source-optimizer') return features.has('declarations');
    if (passName === 'css-compressor') return features.has('declarations');

    // Generation: skip if no high-level features
    if (passName === 'token-lowering') return features.has('semantic-tokens');
    if (passName === 'intent-resolver') return features.has('intents');
    if (passName === 'constraint-resolver') return features.has('constraints');
    if (passName === 'css-emitter') return true;

    return true;
  }

  private runSync(ir: StyleIR): PipelineResult {
    const startTime = Date.now();
    const timeline: PipelineStageResult[] = [];
    let current = ir;
    let skipped = 0;

    const features = this.detectFeatures(ir);
    const dirtyCount = ir.rules.filter(r => r._dirty).length;
    const totalRules = ir.rules.length;
    ir.meta.dirtyRules = dirtyCount;
    ir.meta.compiledAt = Date.now();

    // Stage 1: Normalize
    for (const pass of this.normalization) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const { result, duration } = this.runPassSafe(
        'normalization', pass.name,
        () => pass.normalize(current, this.normCtx),
        current
      );
      if (result) {
        current = result.ir;
        timeline.push({ stage: 'normalization', pass: pass.name, duration, result });
      }
    }

    // Stage 2: Validate
    for (const pass of this.validation) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const { result, duration } = this.runPassSafe(
        'validation', pass.name,
        () => pass.validate(current, this.valCtx),
        current
      );
      if (result) {
        for (const diag of result.diagnostics) {
          current.diagnostics.push({
            id: diag.id, nodeId: diag.nodeId, severity: diag.severity,
            message: diag.message, suggestion: diag.suggestion,
            pass: `validation:${pass.name}`,
          });
        }
        timeline.push({ stage: 'validation', pass: pass.name, duration, result });
      }
    }

    // Stage 3: Analyze
    for (const pass of this.analysis) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const { result, duration } = this.runPassSafe(
        'analysis', pass.name,
        () => pass.analyze(current, this.analysisCtx),
        current
      );
      if (result) {
        current = result.ir;
        timeline.push({ stage: 'analysis', pass: pass.name, duration, result });
      }
    }

    // Stage 4: Optimize
    for (const pass of this.optimization) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const { result, duration } = this.runPassSafe(
        'optimization', pass.name,
        () => pass.optimize(current, this.optCtx),
        current
      );
      if (result) {
        current = result.ir;
        timeline.push({ stage: 'optimization', pass: pass.name, duration, result });
      }
    }

    // Stage 5: Generate (Lowering)
    let finalCSS: string | undefined;
    for (const pass of this.lowering) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const { result, duration } = this.runPassSafe(
        'lowering', pass.name,
        () => pass.generate(current, this.lowerCtx),
        current
      );
      if (result) {
        current = result.ir;
        if (result.generatedOutput) finalCSS = result.generatedOutput;
        timeline.push({ stage: 'lowering', pass: pass.name, duration, result });
      }
    }

    if (skipped > 0) {
      current.diagnostics.push({
        id: 'pipeline-skip', nodeId: current.id, severity: 'info',
        message: `Skipped ${skipped} pass(es) — no relevant features detected`,
        pass: 'pipeline',
      });
    }

    const result: PipelineResult = {
      ir: current, timeline, totalDuration: Date.now() - startTime, finalCSS,
      incremental: { dirtyCount, totalRules, incrementalSkipped: 0 }
    };
    this.lastResult = result;
    return result;
  }

  report(timeline: PipelineStageResult[]): string {
    const lines = [
      '═══════════════════════════════════════════',
      '  ChainCSS Pipeline Report',
      '═══════════════════════════════════════════',
    ];
    let currentStage = '';
    for (const entry of timeline) {
      if (entry.stage !== currentStage) {
        currentStage = entry.stage;
        lines.push('', '  [' + currentStage.toUpperCase() + ']');
      }
      lines.push('    ✓ ' + entry.pass.padEnd(25) + ' ' + String(entry.duration).padStart(4) + 'ms');
      if (entry.stage === 'validation') {
        const vr = entry.result as ValidationResult;
        if (vr.stats.errors > 0 || vr.stats.warnings > 0) {
          lines.push('      ⚠ ' + vr.stats.errors + ' errors, ' + vr.stats.warnings + ' warnings');
        }
      }
    }
    lines.push('', '═══════════════════════════════════════════');
    return lines.join('\n');
  }
}