// src/compiler/pipeline/pipeline.ts

import type {
  PipelineConfig,
  PipelineResult,
  PipelineStageResult,
  LoweringPass,
  NormalizationPass,
  ValidationPass,
  ValidationResult,
  AnalysisPass,
  OptimizationPass,
  NormalizationContext,
  ValidationContext,
  AnalysisContext,
  OptimizationContext,
  LoweringContext,
} from './pipeline-types.js';
import type { StyleIR, ParsedValue, IRDeclaration } from './ir/types.js';

export class Pipeline {
  private normalization: NormalizationPass[];
  private validation: ValidationPass[];
  private analysis: AnalysisPass[];
  private optimization: OptimizationPass[];
  private lowering: LoweringPass[];

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

  execute(ir: StyleIR): PipelineResult {
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

      if (rule.meta._constraints && (rule.meta._constraints as any[]).length > 0) features.add('constraints');
      if (rule.meta._semantic && (rule.meta._semantic as any[]).length > 0) features.add('semantic-tokens');
      if (rule.meta._intent) features.add('intents');
      if (rule.atRules.length > 0) features.add('at-rules');
      if (rule.pseudoClasses.length > 0) features.add('pseudo-classes');

      for (const decl of rule.declarations) {
        features.add('declarations');

        const parsed = decl.meta?.parsed;
        if (parsed && typeof parsed === 'object' && (parsed as any).kind) {
          detectFromParsed(parsed as ParsedValue, features);
        } else {
          detectFromString(decl, features);
        }

        if (decl.property.startsWith('--')) {
          features.add('custom-properties');
        }
        if (decl.property === 'animation' || decl.property === 'transition') {
          features.add('animations');
        }
      }
    }

    features.add('core');
    return features;
  }

  // Feature requirements for each pass. Passes not listed here always run.
  // Passes declare what features they need — no magic strings in logic.
  private static PASS_FEATURE_REQUIREMENTS: Record<string, string[]> = {
    'responsive-analyzer': ['viewport-units', 'large-fixed'],
    'layout-analyzer': ['flexbox-grid'],
    'pattern-detector': ['declarations'],
    'accessibility-optimizer': ['declarations'],
    'atomic-extractor': ['declarations'],
    'media-query-packer': ['at-rules'],
    'source-optimizer': ['declarations'],
    'css-compressor': ['declarations'],
    'token-lowering': ['semantic-tokens'],
    'intent-resolver': ['intents'],
    'constraint-resolver': ['constraints'],
  };

  private shouldRun(passName: string, features: Set<string>): boolean {
    const required = Pipeline.PASS_FEATURE_REQUIREMENTS[passName];
    // No entry = always run
    if (!required) return true;
    return required.some(f => features.has(f));
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
        if (vr.stats?.errors > 0 || vr.stats?.warnings > 0) {
          lines.push('      ⚠ ' + (vr.stats.errors || 0) + ' errors, ' + (vr.stats.warnings || 0) + ' warnings');
        }
      }
      if (entry.stage === 'optimization' && (entry.result as any).savings) {
        const s = (entry.result as any).savings;
        if (s.bytesSaved > 0) {
          lines.push('      📦 Saved ' + s.bytesSaved + ' bytes, ' + (s.rulesEliminated || 0) + ' rules eliminated');
        }
      }
    }
    lines.push('', '═══════════════════════════════════════════');
    return lines.join('\n');
  }
}

// ============================================================================
// Feature detection helpers — pure functions at module scope
// ============================================================================

function detectFromParsed(value: ParsedValue, features: Set<string>): void {
  switch (value.kind) {
    case 'dimension': {
      if (value.unit === 'vh' || value.unit === 'vw' ||
          value.unit === 'vmin' || value.unit === 'vmax') {
        features.add('viewport-units');
      }
      if (value.unit === 'px' && value.value > 768) {
        features.add('large-fixed');
      }
      break;
    }
    case 'keyword': {
      if (value.value === 'flex' || value.value === 'inline-flex') {
        features.add('flexbox-grid');
      }
      if (value.value === 'grid' || value.value === 'inline-grid') {
        features.add('flexbox-grid');
        features.add('css-grid');
      }
      break;
    }
    case 'function': {
      if (value.name === 'var') {
        features.add('custom-properties');
      }
      for (const arg of value.args) {
        detectFromParsed(arg, features);
      }
      break;
    }
    case 'list': {
      for (const item of value.items) {
        detectFromParsed(item, features);
      }
      break;
    }
  }
}

function detectFromString(decl: IRDeclaration, features: Set<string>): void {
  // Check display property directly (raw is the value, not property: value)
  if (decl.property === 'display') {
    const val = String(decl.value);
    if (/\b(inline-)?(flex|grid)\b/.test(val)) {
      features.add('flexbox-grid');
      return;
    }
  }
  const raw = String(decl.value);

  if (/\b\d+(\.\d+)?(vh|vw|vmin|vmax)\b/.test(raw)) {
    features.add('viewport-units');
  }

  const pxMatch = raw.match(/^(\d+)px$/);
  if (pxMatch && parseInt(pxMatch[1]) > 768) {
    features.add('large-fixed');
  }

  if (/\bdisplay\s*:\s*(inline-)?(flex|grid)\b/.test(raw)) {
    features.add('flexbox-grid');
  }
}