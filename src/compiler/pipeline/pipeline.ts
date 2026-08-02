// ============================================================================
// FILE: src/compiler/pipeline/pipeline.ts
// Unified Core Engine & Orchestrator for ChainCSS Compilation Pipeline
// ============================================================================

import { clearKeyframeCache } from "../utils/shorthands.js";
import type { StyleIR } from './ir/types.js';
// Metrics will be loaded dynamically
import { intentNormalizer } from './normalizers/intent-normalizer.js';
import { unitNormalizer } from './normalizers/unit-normalizer.js';
import { cssCompressor } from './optimizers/css-compressor.js';
import { cssEmitter } from './lowering/css-emitter.js';
import { intentResolver } from './lowering/intent-resolver.js';
import { tokenLowering } from './lowering/token-lowering.js';
import { accessibilityValidator } from './validators/accessibility-validator.js';
import { conflictValidator } from './validators/conflict-validator.js';
import { ideDiagnostics } from './validators/ide-diagnostics.js';
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
import AnimationRegistry from '../animations.js';
import { astOptimizer } from './optimizers/ast-optimizer.js';
import { schedulePasses, type PassDeclaration } from './pass-scheduler.js';
import { buildIRGraph } from './ir/graph-builder.js';
import { buildSymbolTable } from './symbol-table.js';
import type {
// Metrics will be loaded dynamically
  PipelineConfig,
  PipelineResult,
  PipelineStageResult,
  NormalizationPass,
  NormalizationResult,
  LoweringPass,
  OptimizationPass,
  OptimizationResult,
  ValidationPass,
  AnalysisPass,
  ValidationResult,
  AnalysisResult,
  LoweringResult
} from './pipeline-types.js';

// ============================================================================
// Metrics & Observability
// ============================================================================
import { defaultMetrics} from '../metrics/index.js';
import { defaultTracer } from '../tracing/index.js';
import { DiagnosticReporter } from '../diagnostics/index.js';

// ============================================================================
// Pass Declarations
// ============================================================================
const PASS_DECLARATIONS: PassDeclaration[] = [
  { name: 'intent-normalizer', phase: 'normalize', requires: [], produces: ['normalized-properties', 'intent-corrections'], invalidates: [], cost: 'cheap' },
  { name: 'unit-normalizer', phase: 'normalize', requires: [], produces: ['normalized-units'], invalidates: [], cost: 'cheap' },
  { name: 'token-lowering-bridge', phase: 'normalize', requires: [], produces: ['resolved-tokens'], invalidates: [], cost: 'moderate' },
  { name: 'accessibility-validator', phase: 'validate', requires: [], produces: ['a11y-diagnostics'], invalidates: [], cost: 'moderate' },
  { name: 'conflict-validator', phase: 'validate', requires: [], produces: ['conflict-diagnostics'], invalidates: [], cost: 'cheap' },
  { name: 'ide-diagnostics', phase: 'validate', requires: [], produces: ['ide-suggestions', 'unused-symbol-warnings'], invalidates: [], cost: 'cheap' },
  { name: 'responsive-analyzer', phase: 'analyze', requires: [], produces: ['responsive-annotations'], invalidates: [], cost: 'moderate' },
  { name: 'layout-analyzer', phase: 'analyze', requires: [], produces: ['layout-annotations'], invalidates: [], cost: 'moderate' },
  { name: 'pattern-detector', phase: 'analyze', requires: [], produces: ['pattern-clusters'], invalidates: [], cost: 'expensive' },
  { name: 'ast-optimizer', phase: 'optimize', requires: [], produces: ['optimized-ast'], invalidates: [], cost: 'cheap' },
  { name: 'dynamic-animation-resolver', phase: 'optimize', requires: [], produces: ['resolved-animations'], invalidates: [], cost: 'cheap' },
  { name: 'duplicate-declaration-detector', phase: 'optimize', requires: [], produces: ['deduplicated-declarations'], invalidates: [], cost: 'cheap' },
  { name: 'dead-code-eliminator', phase: 'optimize', requires: [], produces: ['eliminated-dead-rules'], invalidates: [], cost: 'cheap' },
  { name: 'css-compressor', phase: 'optimize', requires: [], produces: ['compressed-values'], invalidates: [], cost: 'cheap' },
  { name: 'specificity-sorter', phase: 'optimize', requires: [], produces: ['sorted-rules'], invalidates: [], cost: 'cheap' },
  { name: 'media-query-packer', phase: 'optimize', requires: [], produces: ['packed-media-queries'], invalidates: [], cost: 'cheap' },
  { name: 'source-optimizer', phase: 'optimize', requires: [], produces: ['deduplicated-rules'], invalidates: [], cost: 'expensive' },
  { name: 'atomic-extractor', phase: 'optimize', requires: [], produces: ['atomic-classes'], invalidates: [], cost: 'expensive' },
  { name: 'accessibility-optimizer', phase: 'optimize', requires: [], produces: ['a11y-auto-fixes'], invalidates: [], cost: 'cheap' },
  { name: 'intent-resolver', phase: 'lower', requires: [], produces: ['resolved-intents', 'generated-css'], invalidates: [], cost: 'moderate' },
  { name: 'token-resolver', phase: 'lower', requires: [], produces: ['lowered-tokens'], invalidates: [], cost: 'moderate' },
  { name: 'constraint-resolver', phase: 'lower', requires: [], produces: ['resolved-constraints'], invalidates: [], cost: 'cheap' },
  { name: 'css-emitter', phase: 'lower', requires: [], produces: ['final-css'], invalidates: [], cost: 'cheap' },
];
const validationResult = schedulePasses(PASS_DECLARATIONS);
if (validationResult.errors.length > 0) {
  for (const err of validationResult.errors) {
    console.warn(`  ⚠️  [Pass Scheduling Error]: ${err}`);
  }
}

// ============================================================================
// Pipeline Adapters & Resolvers
// ============================================================================
const tokenNormalizationAdapter: NormalizationPass = {
  name: 'token-lowering-bridge',
  normalize(ir, context): NormalizationResult {
    const res = tokenLowering.generate(ir, context as any);
    return { ir: res.ir, corrections: [] };
  },
};
const dynamicAnimationResolver: OptimizationPass = {
  name: 'dynamic-animation-resolver',
  cost: 'cheap',
  requiredFor: [],
  optimize(ir: StyleIR, _context: Record<string, any> = {}): OptimizationResult {
    if (!ir || !ir.rules) return { ir, savings: { bytesSaved: 0, rulesEliminated: 0, declarationsEliminated: 0 }, changes: 0 };
    const activeAnimationNames = new Set<string>();
    const registry = AnimationRegistry as any;
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
            if (name && !['none', 'inherit', 'initial', 'unset'].includes(name)) {
              activeAnimationNames.add(name);
            }
          }
        }
      }
    }
    for (const animName of activeAnimationNames) {
      if (registry.has(animName)) {
        const keyframeNode = registry.getCompiledKeyframeNode(animName);
        if (keyframeNode) {
          ir.rules.push(keyframeNode as any);
          for (const rule of ir.rules) {
            const hasAnimation = rule.declarations?.some(
              d => (d.property === 'animation' || d.property === 'animation-name') &&
                   String(d.value).includes(animName)
            );
            if (hasAnimation) {
              rule.meta.dependencies = rule.meta.dependencies || [];
              rule.meta.dependencies.push(keyframeNode.id);
              keyframeNode.meta = keyframeNode.meta || {};
              keyframeNode.meta.dependents = keyframeNode.meta.dependents || [];
              keyframeNode.meta.dependents.push(rule.id);
            }
          }
        }
      }
    }
    return { ir, savings: { bytesSaved: 0, rulesEliminated: 0, declarationsEliminated: 0 }, changes: activeAnimationNames.size };
  }
};
const BASE_NORMALIZATION = [intentNormalizer, unitNormalizer, tokenNormalizationAdapter];
const BASE_OPTIMIZATION = [astOptimizer, dynamicAnimationResolver, cssCompressor];
const BASE_LOWERING = [intentResolver, cssEmitter];
export type PipelinePreset = 'default' | 'production' | 'ci' | 'lint' | 'atomic';
const PRESETS: Record<PipelinePreset, Partial<PipelineConfig>> = {
  default: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: [...BASE_OPTIMIZATION, mediaQueryPacker],
    lowering: BASE_LOWERING,
  },
  production: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: [astOptimizer, dynamicAnimationResolver, deadCodeEliminator, cssCompressor, specificitySorter, mediaQueryPacker, sourceOptimizer],
    lowering: BASE_LOWERING
  },
  ci: {
    normalization: BASE_NORMALIZATION,
    validation: [accessibilityValidator, conflictValidator, ideDiagnostics],
    analysis: [responsiveAnalyzer, layoutAnalyzer, patternDetector],
    optimization: [astOptimizer, duplicateDeclarationDetector, dynamicAnimationResolver, deadCodeEliminator, cssCompressor, specificitySorter, mediaQueryPacker, sourceOptimizer, accessibilityOptimizer],
    lowering: BASE_LOWERING
  },
  lint: {
    normalization: BASE_NORMALIZATION,
    validation: [accessibilityValidator, conflictValidator, ideDiagnostics],
    analysis: [],
    optimization: [],
    lowering: BASE_LOWERING,
  },
  atomic: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: [astOptimizer, dynamicAnimationResolver, atomicExtractor, cssCompressor],
    lowering: BASE_LOWERING
  },
};

// ============================================================================
// Core Pipeline Execution Engine
// ============================================================================
export class Pipeline {
  private config: PipelineConfig;
  private passDeclarations: PassDeclaration[] = PASS_DECLARATIONS;
  private lastResult: PipelineResult | null = null;
  private immutableMode: boolean = true;
  private metricsEnabled: boolean = true;
  private diagnostics: DiagnosticReporter;
  private tracer: typeof defaultTracer;
  constructor(config: PipelineConfig) {
    this.config = config;
    this.diagnostics = new DiagnosticReporter();
    this.tracer = defaultTracer;
    this.metricsEnabled = process.env.CHAINCSS_METRICS !== 'false';
  }
  public setPassDeclarations(declarations: PassDeclaration[]): void {
    this.passDeclarations = declarations;
  }
  public getPassDeclarations(): PassDeclaration[] {
    return this.passDeclarations;
  }
  public getLastResult(): PipelineResult | null {
    return this.lastResult;
  }
  public getScheduleValidation(): { errors: string[]; warnings: string[]; valid: boolean } {
    return {
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      valid: validationResult.errors.length === 0,
    };
  }
  public report(timeline: PipelineStageResult[]): string {
    const lines = [
      '═══════════════════════════════════════════',
      ' ChainCSS Pipeline Report',
      '═══════════════════════════════════════════',
    ];
    let currentStage = '';
    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      if (entry.stage !== currentStage) {
        currentStage = entry.stage;
        lines.push('', ` [${currentStage.toUpperCase()}]`);
      }
      lines.push(` ✓ ${entry.pass.padEnd(25)} ${String(entry.duration.toFixed(2)).padStart(7)}ms`);
    }
    lines.push('', '═══════════════════════════════════════════');
    return lines.join('\n');
  }
  public setImmutableMode(enabled: boolean): void {
    this.immutableMode = enabled;
  }
  public isImmutableMode(): boolean {
    return this.immutableMode;
  }
  public getDiagnostics(): DiagnosticReporter {
    return this.diagnostics;
  }
  public getMetrics() {
    return defaultMetrics;
  }
  public getTracer() {
    return this.tracer;
  }
  public execute(ir: StyleIR, filePath?: string): PipelineResult {
    const startTime = performance.now();
    const timeline: PipelineStageResult[] = [];
    let currentIR = ir;
    // Start root span
    const rootSpan = this.tracer.startSpan('pipeline-execute', undefined);
    this.tracer.setAttribute(rootSpan.id, 'filePath', filePath || 'unknown');
    this.tracer.setAttribute(rootSpan.id, 'ruleCount', ir.rules?.length || 0);
    // Start total compile timer
    if (this.metricsEnabled) {
      defaultMetrics.start('total_compile', { filePath });
      defaultMetrics.increment('files_processed');
    }
    // Ensure diagnostics array exists on IR
    currentIR.diagnostics = currentIR.diagnostics || [];
    // Build graph and symbol table
    if (this.metricsEnabled) defaultMetrics.start('graph_build');
    currentIR.graph = buildIRGraph(currentIR);
    if (this.metricsEnabled) {
      defaultMetrics.stop('graph_build');
      defaultMetrics.increment('pipeline_passes_run');
    }
    if (this.metricsEnabled) defaultMetrics.start('symbol_table_build');
    (currentIR as any)._symbolTable = buildSymbolTable(currentIR);
    if (this.metricsEnabled) {
      defaultMetrics.stop('symbol_table_build');
      defaultMetrics.increment('pipeline_passes_run');
    }
    const pipelineContext = {
      filePath,
      ...(this.config.contexts || {})
    };
    try {
      // 1. Normalization Stage
      if (this.config.normalization) {
        if (this.metricsEnabled) defaultMetrics.start('normalize');
        for (const pass of this.config.normalization as NormalizationPass[]) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`normalize-${pass.name}`, rootSpan.id);
          const res = pass.normalize(currentIR, pipelineContext.normalization as any || pipelineContext);
          currentIR = res.ir;
          this.tracer.endSpan(span.id, 'ok');
          const passName = pass.name || 'normalization';
          timeline.push({ 
            stage: 'normalization', 
            pass: passName, 
            duration: performance.now() - passStart,
            result: res
          });
          if (this.metricsEnabled) defaultMetrics.increment('pipeline_passes_run');
        }
        if (this.metricsEnabled) defaultMetrics.stop('normalize');
      }
      // 2. Validation Stage
      if (this.config.validation && this.config.validation.length > 0) {
        if (this.metricsEnabled) defaultMetrics.start('validate');
        for (const pass of this.config.validation as ValidationPass[]) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`validate-${pass.name}`, rootSpan.id);
          let res: ValidationResult = { 
            diagnostics: [], 
            passed: true,
            stats: { errors: 0, warnings: 0, info: 0, hints: 0 } 
          };
          if (typeof pass.validate === 'function') {
            const passRes = pass.validate(currentIR, pipelineContext.validation as any || pipelineContext);
            if (passRes) {
              res = passRes;
              if (res.diagnostics && Array.isArray(res.diagnostics)) {
                for (const d of res.diagnostics) {
                  currentIR.diagnostics.push({
                    ...d,
                    pass: (d as any).pass || pass.name || 'validation'
                  });
                  if (d.severity === 'error') {
                    if (this.metricsEnabled) defaultMetrics.increment('errors_encountered');
                    this.diagnostics.error(d.message, { file: (d as any).file, line: (d as any).line })
                  } else if (d.severity === 'warning') {
                    if (this.metricsEnabled) defaultMetrics.increment('warnings_issued');
                    this.diagnostics.warning(d.message, { file: (d as any).file, line: (d as any).line })
                  }
                }
              }
            }
          }
          this.tracer.endSpan(span.id, 'ok');
          const passName = pass.name || 'validation';
          timeline.push({ 
            stage: 'validation', 
            pass: passName, 
            duration: performance.now() - passStart,
            result: res
          });
          if (this.metricsEnabled) defaultMetrics.increment('pipeline_passes_run');
        }
        if (this.metricsEnabled) defaultMetrics.stop('validate');
      }
      // 3. Analysis Stage
      if (this.config.analysis && this.config.analysis.length > 0) {
        if (this.metricsEnabled) defaultMetrics.start('analyze');
        for (const pass of this.config.analysis as AnalysisPass[]) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`analyze-${pass.name}`, rootSpan.id);
          
          let res: AnalysisResult = { ir: currentIR, annotations: [] };
          if (typeof pass.analyze === 'function') {
            const passRes = pass.analyze(currentIR, pipelineContext.analysis as any || pipelineContext);
            if (passRes) res = passRes;
          }
          this.tracer.endSpan(span.id, 'ok');
          const passName = pass.name || 'analysis';
          timeline.push({ 
            stage: 'analysis', 
            pass: passName, 
            duration: performance.now() - passStart,
            result: res
          });
          if (this.metricsEnabled) defaultMetrics.increment('pipeline_passes_run');
        }
        if (this.metricsEnabled) defaultMetrics.stop('analyze');
      }
      // 4. Optimization Stage
      if (this.config.optimization) {
        if (this.metricsEnabled) defaultMetrics.start('optimize');
        for (const pass of this.config.optimization as OptimizationPass[]) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`optimize-${pass.name}`, rootSpan.id);
          const res = pass.optimize(currentIR, pipelineContext.optimization as any || pipelineContext);
          currentIR = res.ir;
          this.tracer.endSpan(span.id, 'ok');
          const passName = pass.name || 'optimization';
          timeline.push({ 
            stage: 'optimization', 
            pass: passName, 
            duration: performance.now() - passStart,
            result: res
          });
          if (this.metricsEnabled) defaultMetrics.increment('pipeline_passes_run');
        }
        if (this.metricsEnabled) defaultMetrics.stop('optimize');
      }
      // 5. Lowering Stage
      let finalCSS = '';
      if (this.config.lowering) {
        if (this.metricsEnabled) defaultMetrics.start('lower');
        for (const pass of this.config.lowering as LoweringPass[]) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`lower-${pass.name}`, rootSpan.id);
          let res: LoweringResult = { ir: currentIR, generatedNodes: 0 };
          const passRes = pass.generate(currentIR, pipelineContext.lowering as any || pipelineContext);
          if (passRes) {
            res = passRes;
            if (passRes.generatedOutput) {
              finalCSS = passRes.generatedOutput;
            }
          }
          this.tracer.endSpan(span.id, 'ok');
          const passName = pass.name || 'lowering';
          timeline.push({ 
            stage: 'lowering', 
            pass: passName, 
            duration: performance.now() - passStart,
            result: res
          });
          if (this.metricsEnabled) defaultMetrics.increment('pipeline_passes_run');
        }
        if (this.metricsEnabled) defaultMetrics.stop('lower');
      }
      // Stamp passMeta on rules
      for (const rule of currentIR.rules) {
        if (!rule.passMeta) {
          rule.passMeta = {};
        }
        for (const entry of timeline) {
          (rule.passMeta as any)[entry.pass] = {
            _ran: true,
            _ranAt: Date.now(),
            _stage: entry.stage,
          };
        }
      }
      // Update metrics
      if (this.metricsEnabled) {
        defaultMetrics.increment('rules_compiled', currentIR.rules.length);
        const atomicRules = currentIR.rules.filter(r => r.passMeta?.optimization?.atomic?.isAtomic === true);
        defaultMetrics.increment('atomic_classes_generated', atomicRules.length);
        defaultMetrics.stop('total_compile');
      }
      this.tracer.endSpan(rootSpan.id, 'ok');
      const result: PipelineResult = {
        ir: currentIR,
        timeline,
        totalDuration: performance.now() - startTime,
        finalCSS,
        incremental: { dirtyCount: 0, totalRules: currentIR.rules.length, incrementalSkipped: 0 }
      };
      this.lastResult = result;
      // Record metrics history
      defaultMetrics.recordHistory();
      return result;
    } catch (error) {
      if (this.metricsEnabled) {
        defaultMetrics.increment('errors_encountered');
        defaultMetrics.stop('total_compile');
      }
      this.tracer.endSpan(rootSpan.id, 'error');
      this.tracer.addEvent(rootSpan.id, 'error', { 
        message: (error as Error).message,
        stack: (error as Error).stack 
      });
      const result: PipelineResult = {
        ir: currentIR,
        timeline,
        totalDuration: performance.now() - startTime,
        finalCSS: '',
        incremental: { dirtyCount: 0, totalRules: currentIR.rules.length, incrementalSkipped: 0 }
      };
      this.lastResult = result;
      return result;
    }
  }
  // Alias `process` to `execute` for maximum compatibility
  public async process(ir: StyleIR, filePath?: string): Promise<PipelineResult> {
    return this.execute(ir, filePath);
  }
  // ==========================================================================
  // Metrics Helpers
  // ==========================================================================
  public generateMetricsReport(): string {
    return defaultMetrics.generateReport();
  }
  public generateDiagnosticReport(): string {
    return this.diagnostics.formatReport();
  }
  public getTraceTree(): any {
    return this.tracer.getTraceTree();
  }
}
// Backwards-compatibility alias
export class UnifiedPipeline extends Pipeline {}

// ============================================================================
// Factory & Helper Functions
// ============================================================================
function deepMerge<T extends Record<string, any>>(base: T, overrides: Partial<T>): T {
  const result = { ...base };
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
  const clone: any = { ...config };
  if (clone.normalization) clone.normalization = [...clone.normalization];
  if (clone.validation) clone.validation = [...clone.validation];
  if (clone.analysis) clone.analysis = [...clone.analysis];
  if (clone.optimization) clone.optimization = [...clone.optimization];
  if (clone.lowering) clone.lowering = [...clone.lowering];
  clone.contexts = { ...(clone.contexts || {}) };
  clone.contexts.normalization = { ...(clone.contexts.normalization || {}) };
  clone.contexts.validation = { ...(clone.contexts.validation || {}) };
  clone.contexts.analysis = { ...(clone.contexts.analysis || {}) };
  clone.contexts.optimization = { ...(clone.contexts.optimization || {}) };
  clone.contexts.lowering = { ...(clone.contexts.lowering || {}) };
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
  const pipeline = new Pipeline(merged as PipelineConfig);
  pipeline.setPassDeclarations(PASS_DECLARATIONS);
  return pipeline;
}
export function createDefaultPipeline(overrides?: Partial<PipelineConfig>): Pipeline {
  return createPipeline('default', overrides);
}
export function createFullPipeline(overrides?: Partial<PipelineConfig>): Pipeline {
  return createPipeline('ci', overrides);
}
export function isValidPreset(v: string): v is PipelinePreset {
  return Object.prototype.hasOwnProperty.call(PRESETS, v);
}
export function getPassDeclarations(): PassDeclaration[] {
  return PASS_DECLARATIONS;
}
export function validatePassSchedule(passes: PassDeclaration[]) {
  return schedulePasses(passes);
}
export type { PipelineResult, PipelineConfig, PipelineStageResult } from './pipeline-types.js';
export default Pipeline;