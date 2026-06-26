// src/compiler/pipeline.ts

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


} from './pipeline-types.js';
import type { StyleIR } from './ir/types.js';
import { countNodes } from './ir/utils.js';

export class Pipeline {
  private normalization: NormalizationPass[];
  private validation: ValidationPass[];
  private analysis: AnalysisPass[];
  private optimization: OptimizationPass[];
  private lowering: LoweringPass[];
  private contexts: Required<PipelineConfig['contexts']>;

  constructor(config: PipelineConfig = {}) {
    this.normalization = config.normalization || [];
    this.validation = config.validation || [];
    this.analysis = config.analysis || [];
    this.optimization = config.optimization || [];
    this.lowering = config.lowering || [];
    this.contexts = {
      normalization: config.contexts?.normalization || {},
      validation: config.contexts?.validation || {},
      analysis: config.contexts?.analysis || {},
      optimization: config.contexts?.optimization || {},
      lowering: config.contexts?.lowering || {},
    };
  }

  /**
   * Execute the full pipeline in strict stage order.
   * Validation runs early to prevent wasted work on invalid IR.
   */

  /** Synchronous wrapper — all passes are sync, so this just calls execute. */

  async execute(ir: StyleIR): Promise<PipelineResult> {
    return this.runSync(ir);
  }

  executeSync(ir: StyleIR): PipelineResult {
    // execute() is only async for future-proofing; all current passes are synchronous.
    // We use a simplified sync path to avoid breaking synchronous callers.
    return this.runSync(ir);
  }

  /** Scan IR for features that determine which passes are needed. */
  private detectFeatures(ir: StyleIR): Set<string> {
    const features = new Set<string>();

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      if (rule.meta._constraints && rule.meta._constraints.length > 0) {
        features.add('constraints');
      }
      if (rule.meta._semantic && rule.meta._semantic.length > 0) {
        features.add('semantic-tokens');
      }
      if (rule.meta._intent) {
        features.add('intents');
      }
      if (rule.atRules.length > 0) {
        features.add('at-rules');
      }
      if (rule.pseudoClasses.length > 0) {
        features.add('pseudo-classes');
      }
      if (rule.declarations.length > 0) {
        features.add('declarations');
      }
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

  /** Check if a pass should run given the detected features. */
  private shouldRun(passName: string, features: Set<string>): boolean {
    // Normalization always runs
    if (passName.startsWith('intent-normalizer') || passName.startsWith('unit-normalizer')) return true;

    // Validation always runs
    if (passName.startsWith('accessibility-validator') || passName.startsWith('conflict-validator')) return true;

    // Analysis: skip if nothing to analyze
    if (passName.startsWith('responsive-analyzer')) return features.has('viewport-units') || features.has('large-fixed');
    if (passName.startsWith('layout-analyzer')) return features.has('flexbox-grid');
    if (passName.startsWith('pattern-detector')) return features.has('declarations');

    // Optimization: skip if nothing to optimize
    if (passName.startsWith('specificity-sorter')) return true;
    if (passName.startsWith('dead-code-eliminator')) return true;
    if (passName.startsWith('accessibility-optimizer')) return features.has('declarations');
    if (passName.startsWith('atomic-extractor')) return features.has('declarations');
    if (passName.startsWith('media-query-packer')) return features.has('at-rules');
    if (passName.startsWith('source-optimizer')) return features.has('declarations');
    if (passName.startsWith('css-compressor')) return features.has('declarations');

    // Generation: skip if no high-level features
    if (passName.startsWith('token-lowering')) return features.has('semantic-tokens');
    if (passName.startsWith('intent-resolver')) return features.has('intents');
    if (passName.startsWith('constraint-resolver')) return features.has('constraints');
    if (passName.startsWith('css-emitter')) return true;

    return true;
  }

  /** Internal sync implementation with conditional execution and incremental support. */
  private runSync(ir: StyleIR): PipelineResult {
    const startTime = Date.now();
    const timeline: PipelineStageResult[] = [];
    let current = ir;
    let skipped = 0;
    let incrementalSkipped = 0;

    const features = this.detectFeatures(ir);
    
    // Incremental: count dirty rules and track whether this is a full or partial build
    const dirtyCount = ir.rules.filter(r => r._dirty).length;
    const totalRules = ir.rules.length;
    const isIncremental = dirtyCount > 0 && dirtyCount < totalRules;
    ir.meta.dirtyRules = dirtyCount;
    ir.meta.compiledAt = Date.now();

    // Stage 1: Normalize
    for (const pass of this.normalization) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const passStart = Date.now();
      const result = pass.normalize(current, (this.contexts!.normalization));
      current = result.ir;
      timeline.push({ stage: 'normalization', pass: pass.name, duration: Date.now() - passStart, result });
    }

    // Stage 2: Validate
    for (const pass of this.validation) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const passStart = Date.now();
      const result = pass.validate(current, (this.contexts!.validation));
      for (const diag of result.diagnostics) {
        current.diagnostics.push({ id: diag.id, nodeId: diag.nodeId, severity: diag.severity, message: diag.message, suggestion: diag.suggestion, pass: `validation:${pass.name}` });
      }
      timeline.push({ stage: 'validation', pass: pass.name, duration: Date.now() - passStart, result });
    }

    // Stage 3: Analyze
    for (const pass of this.analysis) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const passStart = Date.now();
      const result = pass.analyze(current, (this.contexts!.analysis));
      current = result.ir;
      timeline.push({ stage: 'analysis', pass: pass.name, duration: Date.now() - passStart, result });
    }

    // Stage 4: Optimize
    for (const pass of this.optimization) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const passStart = Date.now();
      const result = pass.optimize(current, (this.contexts!.optimization));
      current = result.ir;
      timeline.push({ stage: 'optimization', pass: pass.name, duration: Date.now() - passStart, result });
    }

    // Stage 5: Generate
    let finalCSS: string | undefined;
    for (const pass of this.lowering) {
      if (!this.shouldRun(pass.name, features)) { skipped++; continue; }
      const passStart = Date.now();
      const result = pass.generate(current, (this.contexts!.lowering));
      current = result.ir;
      if (result.generatedOutput) finalCSS = result.generatedOutput;
      timeline.push({ stage: 'lowering', pass: pass.name, duration: Date.now() - passStart, result });
    }

    if (skipped > 0) {
      current.diagnostics.push({
        id: 'pipeline-skip',
        nodeId: current.id,
        severity: 'info',
        message: `Skipped ${skipped} pass(es) — no relevant features detected`,
        pass: 'pipeline',
      });
    }

    return { ir: current, timeline, totalDuration: Date.now() - startTime, finalCSS, incremental: { dirtyCount, totalRules, incrementalSkipped } };
  }

  /**
   * Print a human-readable pipeline report.
   */
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
        lines.push('');
        lines.push('  [' + currentStage.toUpperCase() + ']');
      }
      
      const duration = entry.duration.toString().padStart(4);
      lines.push('    ✓ ' + entry.pass.padEnd(25) + ' ' + duration + 'ms');
      
      // Show warnings/errors if present
      if (entry.stage === 'validation') {
        const vr = entry.result as ValidationResult;
        if (vr.stats.errors > 0 || vr.stats.warnings > 0) {
          lines.push('      ⚠ ' + vr.stats.errors + ' errors, ' + vr.stats.warnings + ' warnings');
        }
      }
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════');
    return lines.join('\n');
  }
}