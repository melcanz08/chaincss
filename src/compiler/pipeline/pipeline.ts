// ============================================================================
// FILE: src/compiler/pipeline/pipeline.ts
// Unified Core Engine & Orchestrator for ChainCSS Compilation Pipeline
// ============================================================================

import type { StyleIR, IRRule, IRAtRule } from "./ir/types.js";
import {
  createDeclaration,
  createKeyframeFrame,
  record,
  nextId,
} from "./ir/index.js";
import { intentNormalizer } from "./normalizers/intent-normalizer.js";
import { unitNormalizer } from "./normalizers/unit-normalizer.js";
import { cssCompressor } from "./optimizers/css-compressor.js";
import { cssEmitter } from "./lowering/css-emitter.js";
import { intentResolver } from "./lowering/intent-resolver.js";
import { tokenLowering } from "./lowering/token-lowering.js";
import { accessibilityValidator } from "./validators/accessibility-validator.js";
import { conflictValidator } from "./validators/conflict-validator.js";
import { ideDiagnostics } from "./validators/ide-diagnostics.js";
import { accessibilityOptimizer } from "./optimizers/accessibility-optimizer.js";
import { specificitySorter } from "./optimizers/specificity-sorter.js";
import { deadCodeEliminator } from "./optimizers/dead-code-eliminator.js";
import { mediaQueryPacker } from "./optimizers/media-query-packer.js";
import { sourceOptimizer } from "./optimizers/source-optimizer.js";
import { atomicExtractor } from "./optimizers/atomic-extractor.js";
import { duplicateDeclarationDetector } from "./optimizers/duplicate-declaration-detector.js";
import { responsiveAnalyzer } from "./analyzers/responsive-analyzer.js";
import { layoutAnalyzer } from "./analyzers/layout-analyzer.js";
import { patternDetector } from "./analyzers/pattern-detector.js";
import {
  hasKeyframePreset,
  getKeyframeFrames,
} from "../animations.js";
import { astOptimizer } from "./optimizers/ast-optimizer.js";
import { schedulePasses, type PassDeclaration } from "./pass-scheduler.js";
import { buildIRGraph } from "../incremental/graph-builder.js";
import { buildSymbolTable } from "./symbol-table.js";
import type {
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
  LoweringResult,
} from "./pipeline-types.js";
import { cloneIR } from "./ir/utils.js";
import { cssValueValidator } from "./validators/css-value-validator.js";
import { intentSuggestionValidator } from "./validators/intent-suggestion-validator.js";

// ============================================================================
// Metrics & Observability
// ============================================================================
import { defaultMetrics } from "../metrics/index.js";
import { defaultTracer } from "../tracing/index.js";
import { DiagnosticReporter } from "../diagnostics/index.js";

// ============================================================================
// Animation keyword set — hoisted
// ============================================================================
const ANIMATION_KEYWORDS = new Set([
  "none", "infinite", "linear", "ease", "ease-in", "ease-out", "ease-in-out",
  "step-start", "step-end", "normal", "reverse", "alternate", "alternate-reverse",
  "forwards", "backwards", "both", "running", "paused",
  "inherit", "initial", "unset", "revert",
]);

function extractAnimationName(part: string): string | null {
  const tokens = part.trim().split(/\s+/);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (ANIMATION_KEYWORDS.has(lower)) continue;
    if (/^\d+(\.\d+)?(s|ms)?$/.test(token)) continue;
    if (/^(cubic-bezier|steps)\(/.test(token)) continue;
    return token;
  }
  return null;
}

// ============================================================================
// Pass Declarations
// ============================================================================
const PASS_DECLARATIONS: PassDeclaration[] = [
  {
    name: "intent-normalizer",
    phase: "normalize",
    requires: ["initial-ir"],
    produces: ["normalized-properties", "intent-corrections"],
    invalidates: [],
    cost: "cheap",
  },
  {
    name: "unit-normalizer",
    phase: "normalize",
    requires: ["normalized-properties"],
    produces: ["normalized-units"],
    invalidates: [],
    cost: "cheap",
  },
  {
    name: "token-normalizer",
    phase: "normalize",
    requires: ["normalized-units"],
    produces: ["resolved-tokens"],
    invalidates: ["normalized-units"],
    cost: "moderate",
  },
  {
    name: "ast-optimizer",
    phase: "optimize",
    requires: ["normalized-properties"],
    produces: ["optimized-ast"],
    invalidates: ["normalized-properties", "ir-graph"],
    cost: "cheap",
  },
  {
    name: "dynamic-animation-resolver",
    phase: "optimize",
    requires: ["optimized-ast"],
    produces: ["resolved-animations"],
    invalidates: [],
    cost: "cheap",
  },
  {
    name: "duplicate-declaration-detector",
    phase: "optimize",
    requires: ["optimized-ast"],
    produces: ["deduplicated-declarations"],
    invalidates: ["optimized-ast"],
    cost: "cheap",
  },
  {
    name: "dead-code-eliminator",
    phase: "optimize",
    requires: ["deduplicated-declarations"],
    produces: ["eliminated-dead-rules"],
    invalidates: ["ir-graph"],
    cost: "cheap",
  },
  {
    name: "css-compressor",
    phase: "optimize",
    requires: ["deduplicated-declarations"],
    produces: ["compressed-values"],
    invalidates: ["deduplicated-declarations"],
    cost: "cheap",
  },
  {
    name: "specificity-sorter",
    phase: "optimize",
    requires: ["compressed-values"],
    produces: ["sorted-rules"],
    invalidates: [],
    cost: "cheap",
  },
  {
    name: "media-query-packer",
    phase: "optimize",
    requires: ["sorted-rules"],
    produces: ["packed-media-queries"],
    invalidates: [],
    cost: "cheap",
  },
  {
    name: "source-optimizer",
    phase: "optimize",
    requires: ["packed-media-queries"],
    produces: ["deduplicated-rules"],
    invalidates: ["ir-graph"],
    cost: "expensive",
  },
  {
    name: "atomic-extractor",
    phase: "optimize",
    requires: ["deduplicated-rules"],
    produces: ["atomic-classes"],
    invalidates: ["ir-graph"],
    cost: "expensive",
  },
  {
    name: "accessibility-optimizer",
    phase: "optimize",
    requires: ["atomic-classes"],
    produces: ["a11y-auto-fixes"],
    invalidates: [],
    cost: "cheap",
  },
  {
    name: "intent-resolver",
    phase: "lower",
    requires: ["a11y-auto-fixes"],
    produces: ["resolved-intents", "generated-css"],
    invalidates: ["ir-graph", "ir-symbol-table"],
    cost: "moderate",
  },
  {
    name: "token-resolver",
    phase: "lower",
    requires: ["resolved-intents"],
    produces: ["lowered-tokens"],
    invalidates: ["ir-symbol-table"],
    cost: "moderate",
  },
  {
    name: "constraint-resolver",
    phase: "lower",
    requires: ["lowered-tokens"],
    produces: ["resolved-constraints"],
    invalidates: [],
    cost: "cheap",
  },
  {
    name: "css-emitter",
    phase: "lower",
    requires: ["resolved-constraints"],
    produces: ["final-css"],
    invalidates: [],
    cost: "cheap",
  },
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
  name: "token-normalizer",
  normalize(ir, context): NormalizationResult {
    const res = tokenLowering.generate(ir, context as any);
    return { ir: res.ir, corrections: [] };
  },
};

const dynamicAnimationResolver: OptimizationPass = {
  name: "dynamic-animation-resolver",
  cost: "cheap",
  requiredFor: [],
  optimize(ir: StyleIR, _context: Record<string, any> = {}): OptimizationResult {
    if (!ir || !ir.rules) {
      return {
        ir,
        savings: { bytesSaved: 0, rulesEliminated: 0, declarationsEliminated: 0 },
        changes: 0,
      };
    }

    const activeAnimationNames = new Set<string>();

    function kebabProp(prop: string): string {
      if (prop.startsWith("--")) return prop;
      return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
    }

    function collectAnimationNames(rules: IRRule[]) {
      for (const rule of rules) {
        if (rule.isDead) continue;
        const allDecls = [
          ...(rule.declarations || []),
          ...(rule.pseudoClasses?.flatMap((pc) => pc.declarations || []) || []),
        ];
        for (const decl of allDecls) {
          if (
            (decl.property === "animation" || decl.property === "animation-name") &&
            decl.value
          ) {
            const raw = String(decl.value).split(",");
            for (const part of raw) {
              // Fix #2: Extract name by checking all tokens against keywords
              const name = extractAnimationName(part);
              if (name) {
                activeAnimationNames.add(name);
              }
            }
          }
        }
        if (rule.nestedRules && rule.nestedRules.length > 0) {
          collectAnimationNames(rule.nestedRules);
        }
      }
    }

    collectAnimationNames(ir.rules);

    if (!ir.atRules) ir.atRules = [];

    for (const animName of activeAnimationNames) {
      if (!hasKeyframePreset(animName)) continue;

      const frames = getKeyframeFrames(animName);
      if (frames.length === 0) continue;

      const alreadyExists = ir.atRules.some(
        (atRule) =>
          atRule.type === "keyframes" &&
          atRule.name === animName,
      );

      if (alreadyExists) continue;

      const keyframeAtRule: IRAtRule = {
        id: nextId("atrule"),
        type: "keyframes",
        name: animName,
        keyframes: frames.map((frame: { keyText: string; declarations: Record<string, string | number> }) => {
          const kf = createKeyframeFrame(frame.keyText, {});
          for (const [p, v] of Object.entries(frame.declarations) as Array<[string, string | number]>) {
            kf.declarations.push(
              createDeclaration(kebabProp(p), v, {}),
            );
          }
          return kf;
        }),
        declarations: [],
        nestedRules: [],
        source: {},
        history: [
          record("dynamic-animation-resolver", "created", undefined, "Generated keyframes from animation preset"),
        ],
      };

      ir.atRules.push(keyframeAtRule);
    }

    return {
      ir,
      savings: { bytesSaved: 0, rulesEliminated: 0, declarationsEliminated: 0 },
      changes: activeAnimationNames.size,
    };
  },
};

const BASE_NORMALIZATION = [
  intentNormalizer,
  unitNormalizer,
  tokenNormalizationAdapter,
];
const BASE_OPTIMIZATION = [
  astOptimizer,
  dynamicAnimationResolver,
  cssCompressor,
];
const BASE_LOWERING = [intentResolver, tokenLowering, cssEmitter];

export type PipelinePreset =
  | "default"
  | "production"
  | "ci"
  | "lint"
  | "atomic";

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
    optimization: [
      astOptimizer,
      dynamicAnimationResolver,
      //deadCodeEliminator,
      cssCompressor,
      specificitySorter,
      mediaQueryPacker,
      sourceOptimizer,
    ],
    lowering: BASE_LOWERING,
  },
  ci: {
    normalization: BASE_NORMALIZATION,
    validation: [cssValueValidator, accessibilityValidator, conflictValidator, ideDiagnostics],
    analysis: [responsiveAnalyzer, layoutAnalyzer, patternDetector],
    optimization: [
      astOptimizer,
      duplicateDeclarationDetector,
      dynamicAnimationResolver,
      deadCodeEliminator,
      cssCompressor,
      specificitySorter,
      mediaQueryPacker,
      sourceOptimizer,
      accessibilityOptimizer,
    ],
    lowering: BASE_LOWERING,
  },
  lint: {
    normalization: BASE_NORMALIZATION,
    validation: [cssValueValidator, accessibilityValidator, conflictValidator, ideDiagnostics, intentSuggestionValidator],
    analysis: [],
    optimization: [],
    lowering: BASE_LOWERING,
  },
  atomic: {
    normalization: BASE_NORMALIZATION,
    validation: [],
    analysis: [],
    optimization: [
      astOptimizer,
      dynamicAnimationResolver,
      atomicExtractor,
      cssCompressor,
    ],
    lowering: BASE_LOWERING,
  },
};

function stampPassMeta(rules: IRRule[], metaStamp: Record<string, any>) {
  for (const rule of rules) {
    rule.passMeta = { ...rule.passMeta, ...metaStamp };
    if (rule.nestedRules && rule.nestedRules.length > 0) {
      stampPassMeta(rule.nestedRules, metaStamp);
    }
  }
}

function buildIRMetadata(ir: StyleIR, metricsEnabled: boolean): void {
  if (metricsEnabled) defaultMetrics.start("graph_build");
  ir.graph = buildIRGraph(ir);
  if (metricsEnabled) {
    defaultMetrics.stop("graph_build");
    defaultMetrics.increment("pipeline_passes_run");
  }

  if (metricsEnabled) defaultMetrics.start("symbol_table_build");
  (ir as any)._symbolTable = buildSymbolTable(ir);
  if (metricsEnabled) {
    defaultMetrics.stop("symbol_table_build");
    defaultMetrics.increment("pipeline_passes_run");
  }
}

export class Pipeline {
  private config: PipelineConfig;
  private passDeclarations: PassDeclaration[] = PASS_DECLARATIONS;
  private lastResult: PipelineResult | null = null;
  private metricsEnabled: boolean = true;
  private diagnostics: DiagnosticReporter;
  private tracer: typeof defaultTracer;
  private immutableMode: boolean = false; // Fix #5: Default false — no silent mutation mismatch
  private graphDirty = true;
  private symbolTableDirty = true;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.diagnostics = new DiagnosticReporter();
    this.tracer = defaultTracer;
    this.metricsEnabled = (() => {
      try {
        if (typeof process !== "undefined" && process.env) {
          return process.env.CHAINCSS_METRICS !== "false";
        }
      } catch {}
      return true;
    })();
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
  public getScheduleValidation() {
    return {
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      valid: validationResult.errors.length === 0,
    };
  }

  public report(timeline: PipelineStageResult[]): string {
    const lines = [
      "═══════════════════════════════════════════",
      " ChainCSS Pipeline Report",
      "═══════════════════════════════════════════",
    ];
    let currentStage = "";
    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      if (entry.stage !== currentStage) {
        currentStage = entry.stage;
        lines.push("", ` [${currentStage.toUpperCase()}]`);
      }
      lines.push(
        ` ✓ ${entry.pass.padEnd(25)} ${String(entry.duration.toFixed(2)).padStart(7)}ms`,
      );
    }
    lines.push("", "═══════════════════════════════════════════");
    return lines.join("\n");
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

  private applyPassInvalidation(passName: string): void {
    const declaration = this.passDeclarations.find((p) => p.name === passName);
    if (!declaration) return;

    if (declaration.invalidates.includes("ir-graph")) {
      this.graphDirty = true;
    }
    if (declaration.invalidates.includes("ir-symbol-table")) {
      this.symbolTableDirty = true;
    }
  }

  private invalidateIRMetadata(): void {
    this.graphDirty = true;
    this.symbolTableDirty = true;
  }

  private ensureIRMetadata(ir: StyleIR): void {
    if (this.graphDirty || !ir.graph) {
      buildIRMetadata(ir, this.metricsEnabled);
      this.graphDirty = false;
      this.symbolTableDirty = false;
      return;
    }

    if (this.symbolTableDirty || !(ir as any)._symbolTable) {
      if (this.metricsEnabled) defaultMetrics.start("symbol_table_build");
      (ir as any)._symbolTable = buildSymbolTable(ir);
      if (this.metricsEnabled) {
        defaultMetrics.stop("symbol_table_build");
        defaultMetrics.increment("pipeline_passes_run");
      }
      this.symbolTableDirty = false;
    }
  }

  private buildExecutionOrder(): PassDeclaration[] {
    const schedule = schedulePasses(this.passDeclarations);

    if (schedule.errors.length === 0 && schedule.ordered.length > 0) {
      return schedule.ordered;
    }

    return [];
  }

  public execute(ir: StyleIR, filePath?: string): PipelineResult {
    const startTime = performance.now();
    const timeline: PipelineStageResult[] = [];
    
    // Fix #5: Clone IR when immutableMode is enabled
    let currentIR = this.immutableMode
      ? cloneIR(ir)
      : ir;

    const rootSpan = this.tracer.startSpan("pipeline-execute", undefined);
    this.tracer.setAttribute(rootSpan.id, "filePath", filePath || "unknown");
    this.tracer.setAttribute(rootSpan.id, "ruleCount", currentIR.rules?.length || 0);

    if (this.metricsEnabled) {
      defaultMetrics.start("total_compile", { filePath });
      defaultMetrics.increment("files_processed");
    }

    currentIR.diagnostics = currentIR.diagnostics || [];

    this.ensureIRMetadata(currentIR);

    const executionOrder = this.buildExecutionOrder();

    const pipelineContext = {
      filePath,
      ...(this.config.contexts || {}),
    };

    let activeStage: string | null = null;

    try {
      // 1. Normalization Stage
      if (this.config.normalization) {
        activeStage = "normalize";
        if (this.metricsEnabled) defaultMetrics.start("normalize");
        const scheduledNormalization = (this.config.normalization || [])
          .slice()
          .sort((a, b) => {
            const ia = executionOrder.findIndex((p) => p.name === (a as any).name);
            const ib = executionOrder.findIndex((p) => p.name === (b as any).name);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
          }) as NormalizationPass[];

        for (const pass of scheduledNormalization) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`normalize-${pass.name}`, rootSpan.id);
          const stageContext = {
            ...pipelineContext,
            ...(pipelineContext.normalization || {}),
          };
          const res = pass.normalize(currentIR, stageContext as any);
          currentIR = res.ir;
          this.applyPassInvalidation(pass.name);
          this.tracer.endSpan(span.id, "ok");
          timeline.push({
            stage: "normalization",
            pass: pass.name || "normalization",
            duration: performance.now() - passStart,
            result: res,
          });
          if (this.metricsEnabled) defaultMetrics.increment("pipeline_passes_run");
        }
        if (this.metricsEnabled) defaultMetrics.stop("normalize");
        activeStage = null;
      }

      // 2. Validation Stage
      if (this.config.validation && this.config.validation.length > 0) {
        activeStage = "validate";
        if (this.metricsEnabled) defaultMetrics.start("validate");
        for (const pass of this.config.validation as ValidationPass[]) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`validate-${pass.name}`, rootSpan.id);
          let res: ValidationResult = {
            diagnostics: [],
            passed: true,
            stats: { errors: 0, warnings: 0, info: 0, hints: 0 },
          };
          if (typeof pass.validate === "function") {
            const stageContext = {
              ...pipelineContext,
              ...(pipelineContext.validation || {}),
            };
            const passRes = pass.validate(currentIR, stageContext as any);
            if (passRes) {
              res = passRes;
              if (res.diagnostics && Array.isArray(res.diagnostics)) {
                for (const d of res.diagnostics) {
                  currentIR.diagnostics.push({
                    ...d,
                    pass: (d as any).pass || pass.name || "validation",
                  });
                  if (d.severity === "error") {
                    if (this.metricsEnabled) defaultMetrics.increment("errors_encountered");
                    this.diagnostics.error(d.message, {
                      file: (d as any).file,
                      line: (d as any).line,
                    });
                  } else if (d.severity === "warning") {
                    if (this.metricsEnabled) defaultMetrics.increment("warnings_issued");
                    this.diagnostics.warning(d.message, {
                      file: (d as any).file,
                      line: (d as any).line,
                    });
                  }
                }
              }
            }
          }
          this.tracer.endSpan(span.id, "ok");
          timeline.push({
            stage: "validation",
            pass: pass.name || "validation",
            duration: performance.now() - passStart,
            result: res,
          });
          if (this.metricsEnabled) defaultMetrics.increment("pipeline_passes_run");
        }
        if (this.metricsEnabled) defaultMetrics.stop("validate");
        activeStage = null;
      }

      // 3. Analysis Stage
      if (this.config.analysis && this.config.analysis.length > 0) {
        activeStage = "analyze";
        if (this.metricsEnabled) defaultMetrics.start("analyze");
        for (const pass of this.config.analysis as AnalysisPass[]) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`analyze-${pass.name}`, rootSpan.id);

          let res: AnalysisResult = { ir: currentIR, annotations: [] };
          if (typeof pass.analyze === "function") {
            const stageContext = {
              ...pipelineContext,
              ...(pipelineContext.analysis || {}),
            };
            const passRes = pass.analyze(currentIR, stageContext as any);
            if (passRes) {
              res = passRes;
              // Fix #3: Update currentIR with analysis results
              currentIR = res.ir || currentIR;
            }
          }
          this.tracer.endSpan(span.id, "ok");
          timeline.push({
            stage: "analysis",
            pass: pass.name || "analysis",
            duration: performance.now() - passStart,
            result: res,
          });
          if (this.metricsEnabled) defaultMetrics.increment("pipeline_passes_run");
        }
        if (this.metricsEnabled) defaultMetrics.stop("analyze");
        activeStage = null;
      }

      // 4. Optimization Stage
      if (this.config.optimization) {
        activeStage = "optimize";
        if (this.metricsEnabled) defaultMetrics.start("optimize");
        const scheduledOptimization = (this.config.optimization || [])
          .slice()
          .sort((a, b) => {
            const ia = executionOrder.findIndex((p) => p.name === (a as any).name);
            const ib = executionOrder.findIndex((p) => p.name === (b as any).name);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
          }) as OptimizationPass[];

        for (const pass of scheduledOptimization) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`optimize-${pass.name}`, rootSpan.id);
          const stageContext = {
            ...pipelineContext,
            ...(pipelineContext.optimization || {}),
          };
          const res = pass.optimize(currentIR, stageContext as any);
          currentIR = res.ir;
          this.applyPassInvalidation(pass.name);
          this.tracer.endSpan(span.id, "ok");
          timeline.push({
            stage: "optimization",
            pass: pass.name || "optimization",
            duration: performance.now() - passStart,
            result: res,
          });
          if (this.metricsEnabled) defaultMetrics.increment("pipeline_passes_run");
        }
        if (this.metricsEnabled) defaultMetrics.stop("optimize");
        activeStage = null;

        this.invalidateIRMetadata();
        this.ensureIRMetadata(currentIR);
      }

      // 5. Lowering Stage
      let finalCSS = "";
      if (this.config.lowering) {
        activeStage = "lower";
        if (this.metricsEnabled) defaultMetrics.start("lower");
        const scheduledLowering = (this.config.lowering || [])
          .slice()
          .sort((a, b) => {
            const ia = executionOrder.findIndex((p) => p.name === (a as any).name);
            const ib = executionOrder.findIndex((p) => p.name === (b as any).name);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
          }) as LoweringPass[];

        for (const pass of scheduledLowering) {
          const passStart = performance.now();
          const span = this.tracer.startSpan(`lower-${pass.name}`, rootSpan.id);
          let res: LoweringResult = { ir: currentIR, generatedNodes: 0 };
          const stageContext = {
            ...pipelineContext,
            ...(pipelineContext.lowering || {}),
          };
          const passRes = pass.generate(currentIR, stageContext as any);
          this.applyPassInvalidation(pass.name);
          if (passRes) {
            res = passRes;
            if (passRes.generatedOutput) {
              finalCSS = passRes.generatedOutput;
            }
          }
          this.tracer.endSpan(span.id, "ok");
          timeline.push({
            stage: "lowering",
            pass: pass.name || "lowering",
            duration: performance.now() - passStart,
            result: res,
          });
          if (this.metricsEnabled) defaultMetrics.increment("pipeline_passes_run");
        }
        if (this.metricsEnabled) defaultMetrics.stop("lower");
        activeStage = null;
      }

      const metaStamp = Object.fromEntries(
        timeline.map((entry) => [entry.pass, { _ran: true, _stage: entry.stage }]),
      );
      stampPassMeta(currentIR.rules, metaStamp);

      if (this.metricsEnabled) {
        defaultMetrics.increment("rules_compiled", currentIR.rules.length);
        const atomicRules = currentIR.rules.filter(
          (r: IRRule) => r.passMeta?.optimization?.atomic?.isAtomic === true,
        );
        defaultMetrics.increment("atomic_classes_generated", atomicRules.length);
        defaultMetrics.stop("total_compile");
      }
      this.tracer.endSpan(rootSpan.id, "ok");
      const result: PipelineResult = {
        ir: currentIR,
        timeline,
        totalDuration: performance.now() - startTime,
        finalCSS,
        incremental: {
          dirtyCount: 0,
          totalRules: currentIR.rules.length,
          incrementalSkipped: 0,
        },
      };
      this.lastResult = result;
      defaultMetrics.recordHistory();
      return result;
    } catch (error) {
      if (this.metricsEnabled) {
        if (activeStage) {
          try { defaultMetrics.stop(activeStage as any); } catch {}
        }
        defaultMetrics.increment("errors_encountered");
        defaultMetrics.stop("total_compile");
      }
      this.tracer.endSpan(rootSpan.id, "error");
      this.tracer.addEvent(rootSpan.id, "error", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      currentIR.diagnostics.push({
        id: `pipeline-error-${Date.now()}`,
        nodeId: currentIR.id,
        severity: "error",
        message: (error as Error).message || "Unhandled compilation pipeline exception",
        pass: "pipeline-core",
      });

      const result: PipelineResult = {
        ir: currentIR,
        timeline,
        totalDuration: performance.now() - startTime,
        finalCSS: "",
        incremental: {
          dirtyCount: 0,
          totalRules: currentIR.rules.length,
          incrementalSkipped: 0,
        },
      };
      this.lastResult = result;
      return result;
    }
  }

  public async process(ir: StyleIR, filePath?: string): Promise<PipelineResult> {
    return this.execute(ir, filePath);
  }

  public generateMetricsReport(): string {
    return defaultMetrics.generateReport();
  }
  public generateDiagnosticReport(): string {
    return this.diagnostics.formatReport();
  }
  public getTraceTree(): any {
    return this.tracer.getTraceTree();
  }

  public setImmutableMode(enabled: boolean): void {
    this.immutableMode = enabled;
  }
  public isImmutableMode(): boolean {
    return this.immutableMode;
  }
}

export class UnifiedPipeline extends Pipeline {}

function deepMerge<T extends Record<string, any>>(
  base: T,
  overrides: Partial<T>,
): T {
  const result = { ...base };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const ov = overrides[key];
    const bv = result[key];
    if (
      ov !== undefined &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      ov !== null &&
      typeof bv === "object" &&
      !Array.isArray(bv) &&
      bv !== null
    ) {
      result[key] = deepMerge(bv as any, ov as any);
    } else if (ov !== undefined) {
      result[key] = Array.isArray(ov) ? ([...ov] as any) : ov;
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

export function createPipeline(
  preset: PipelinePreset = "default",
  overrides?: Partial<PipelineConfig>,
): Pipeline {
  const base = PRESETS[preset];
  if (!base)
    throw new Error(
      `Unknown preset: "${preset}". Valid: ${Object.keys(PRESETS).join(", ")}`,
    );
  const cloned = deepCloneConfig(base);
  const merged: any = overrides
    ? deepMerge(cloned as any, overrides as any)
    : cloned;

  if (preset === "atomic") {
    merged.contexts = merged.contexts || {};
    merged.contexts.optimization = merged.contexts.optimization || {};
    if (!merged.contexts.optimization.atomicUsageMap) {
      merged.contexts.optimization.atomicUsageMap = new Map<string, number>();
    }
  }
  // Fix #7: Removed clearKeyframeCache() — cache is now per-registry, not global
  const pipeline = new Pipeline(merged as PipelineConfig);
  pipeline.setPassDeclarations(PASS_DECLARATIONS);
  return pipeline;
}

export function createDefaultPipeline(
  overrides?: Partial<PipelineConfig>,
): Pipeline {
  return createPipeline("default", overrides);
}

export function createFullPipeline(
  overrides?: Partial<PipelineConfig>,
): Pipeline {
  return createPipeline("ci", overrides);
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

export type {
  PipelineResult,
  PipelineConfig,
  PipelineStageResult,
} from "./pipeline-types.js";

export default Pipeline;