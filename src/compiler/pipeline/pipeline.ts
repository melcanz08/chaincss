// ============================================================================
// FILE: src/compiler/pipeline/pipeline.ts
// ============================================================================

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

const perfNow = (): number => {
  if (typeof performance!== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

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
    const startTime = perfNow();
    try {
      const result = fn();
      return { result, duration: perfNow() - startTime };
    } catch (error) {
      const message = error instanceof Error? error.message : String(error);
      current.diagnostics = [...current.diagnostics, {
        id: `pass-crash-${passName}-${Date.now()}`,
        nodeId: current.id,
        severity: 'error',
        message: `Pass "${passName}" threw an unhandled error: ${message}`,
        suggestion: 'Check the pass implementation for unhandled edge cases.',
        pass: `${stage}:${passName}`,
      }];
      return { result: null, duration: perfNow() - startTime };
    }
  }

  private detectFeatures(ir: StyleIR): Set<string> {
    const features = new Set<string>();

    const handleDecl = (decl: IRDeclaration) => {
      features.add('declarations');
      const parsed = (decl as any).meta?.parsed;
      if (parsed && typeof parsed === 'object' && (parsed as any).kind) {
        detectFromParsed(parsed as ParsedValue, features);
      } else {
        detectFromString(decl, features);
      }
      if (decl.property.startsWith('--')) {
        features.add('custom-properties');
      }
      if (
        decl.property === 'animation' ||
        decl.property === 'transition' ||
        decl.property.startsWith('animation-')
      ) {
        features.add('animations');
      }
    };

    for (let i = 0; i < ir.rules.length; i++) {
      const rule = ir.rules[i];
      if (rule.isDead) continue;

      if (rule.meta._constraints && (rule.meta._constraints as any[]).length > 0) features.add('constraints');
      if (rule.meta._semantic && (rule.meta._semantic as any[]).length > 0) features.add('semantic-tokens');
      if (rule.meta._intent) features.add('intents');

      if (rule.atRules && rule.atRules.length > 0) {
        features.add('at-rules');
        for (let j = 0; j < rule.atRules.length; j++) {
          const atRule = rule.atRules[j] as any;
          if (atRule.type === 'keyframes' || atRule.name === 'keyframes') {
            features.add('animations');
            features.add('keyframes');
          }
          // FIX: scan atRules[].declarations too — e.g. @media { --x: 100vh } or @media { width: 800px }
          if (atRule.declarations && Array.isArray(atRule.declarations)) {
            for (const decl of atRule.declarations) {
              handleDecl(decl as IRDeclaration);
            }
          }
        }
      }

      if (rule.pseudoClasses && rule.pseudoClasses.length > 0) {
        features.add('pseudo-classes');
        // FIX: scan pseudoClasses[].declarations — e.g. &:hover { width: 100vw } or &:hover { width: 800px }
        for (let k = 0; k < rule.pseudoClasses.length; k++) {
          const pc = rule.pseudoClasses[k] as any;
          if (pc.declarations && Array.isArray(pc.declarations)) {
            for (const decl of pc.declarations) {
              handleDecl(decl as IRDeclaration);
            }
          }
        }
      }

      for (let j = 0; j < rule.declarations.length; j++) {
        handleDecl(rule.declarations[j] as IRDeclaration);
      }
    }

    features.add('core');
    return features;
  }

  private static PASS_FEATURE_REQUIREMENTS: Record<string, string[]> = {
    'responsive-analyzer': ['viewport-units', 'large-fixed', 'at-rules'],
    'layout-analyzer': ['flexbox-grid', 'css-grid'],
    'pattern-detector': ['declarations'],
    'accessibility-optimizer': ['declarations'],
    'atomic-extractor': ['declarations'],
    'media-query-packer': ['at-rules'],
    'source-optimizer': ['declarations'],
    'css-compressor': ['declarations'],
    'token-lowering': ['semantic-tokens'],
    'intent-resolver': ['intents'],
    'constraint-resolver': ['constraints'],
    'animation-lowering': ['animations', 'keyframes'],
  };

  private shouldRun(passName: string, features: Set<string>): boolean {
    const required = Pipeline.PASS_FEATURE_REQUIREMENTS[passName];
    if (!required) return true;
    for (let i = 0; i < required.length; i++) {
      if (features.has(required[i])) return true;
    }
    return false;
  }

  private runSync(ir: StyleIR): PipelineResult {
    const startTime = perfNow();
    const timeline: PipelineStageResult[] = [];
    let current = ir;
    let skipped = 0;

    const features = this.detectFeatures(ir);
    const dirtyCount = ir.rules.filter((r: any) => r._dirty || r.meta?._dirty).length;
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
        if (result.diagnostics && result.diagnostics.length > 0) {
          const targetDiags = [...current.diagnostics];
          for (let i = 0; i < result.diagnostics.length; i++) {
            const diag = result.diagnostics[i];
            targetDiags.push({
              id: diag.id,
              nodeId: diag.nodeId,
              severity: diag.severity,
              message: diag.message,
              suggestion: diag.suggestion,
              pass: `validation:${pass.name}`,
            });
          }
          current.diagnostics = targetDiags;
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
      current.diagnostics = [...current.diagnostics, {
        id: 'pipeline-skip',
        nodeId: current.id,
        severity: 'info',
        message: `Skipped ${skipped} pass(es) — no relevant features detected`,
        pass: 'pipeline',
      }];
    }

    const result: PipelineResult = {
      ir: current,
      timeline,
      totalDuration: perfNow() - startTime,
      finalCSS,
      incremental: { dirtyCount, totalRules, incrementalSkipped: 0 }
    };
    this.lastResult = result;
    return result;
  }

  report(timeline: PipelineStageResult[]): string {
    const lines = [
      '═══════════════════════════════════════════',
      ' ChainCSS Pipeline Report',
      '═══════════════════════════════════════════',
    ];
    let currentStage = '';
    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      if (entry.stage!== currentStage) {
        currentStage = entry.stage;
        lines.push('', ` [${currentStage.toUpperCase()}]`);
      }
      lines.push(` ✓ ${entry.pass.padEnd(25)} ${String(entry.duration.toFixed(2)).padStart(7)}ms`);
      if (entry.stage === 'validation') {
        const vr = entry.result as ValidationResult;
        if (vr.stats && (vr.stats.errors > 0 || vr.stats.warnings > 0)) {
          lines.push(` ⚠ ${vr.stats.errors || 0} errors, ${vr.stats.warnings || 0} warnings`);
        }
      }
      if (entry.stage === 'optimization' && (entry.result as any).savings) {
        const s = (entry.result as any).savings;
        if (s.bytesSaved > 0) {
          lines.push(` 📦 Saved ${s.bytesSaved} bytes, ${s.rulesEliminated || 0} rules eliminated`);
        }
      }
    }
    lines.push('', '═══════════════════════════════════════════');
    return lines.join('\n');
  }
}

function detectFromParsed(value: ParsedValue, features: Set<string>): void {
  switch (value.kind) {
    case 'dimension': {
      const u = value.unit;
      if (u === 'vh' || u === 'vw' || u === 'vmin' || u === 'vmax') {
        features.add('viewport-units');
      }
      if (u === 'px' && value.value > 768) {
        features.add('large-fixed');
      }
      break;
    }
    case 'keyword': {
      const val = value.value;
      if (val === 'flex' || val === 'inline-flex') {
        features.add('flexbox-grid');
      }
      if (val === 'grid' || val === 'inline-grid') {
        features.add('flexbox-grid');
        features.add('css-grid');
      }
      break;
    }
    case 'function': {
      if (value.name === 'var') {
        features.add('custom-properties');
      }
      for (let i = 0; i < value.args.length; i++) {
        detectFromParsed(value.args[i], features);
      }
      break;
    }
    case 'list': {
      for (let i = 0; i < value.items.length; i++) {
        detectFromParsed(value.items[i], features);
      }
      break;
    }
  }
}

function detectFromString(decl: IRDeclaration, features: Set<string>): void {
  const val = String(decl.value).trim();

  if (decl.property === 'display') {
    if (val === 'flex' || val === 'inline-flex') {
      features.add('flexbox-grid');
    } else if (val === 'grid' || val === 'inline-grid') {
      features.add('flexbox-grid');
      features.add('css-grid');
    }
    return;
  }

  if (/\b\d+(?:\.\d+)?(?:vh|vw|vmin|vmax)\b/.test(val)) {
    features.add('viewport-units');
  }

  const pxMatches = val.matchAll(/\b(\d+(?:\.\d+)?)px\b/g);
  for (const m of pxMatches) {
    const num = parseFloat(m[1]);
    if (num > 768) {
      features.add('large-fixed');
      break;
    }
  }
}