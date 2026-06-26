// src/compiler/pipeline-types.ts

import type { StyleIR, IRRule, IRDeclaration, IRNodeId } from './ir/types.js';

// ============================================================================
// Stage 1: Normalization
// ============================================================================
export interface NormalizationContext {
  sourceFile?: string;
  config?: Record<string, any>;
}

export interface Correction {
  nodeId: IRNodeId;
  property?: string;
  original: any;
  corrected: any;
  reason: string;
}

export interface NormalizationResult {
  ir: StyleIR;
  corrections: Correction[];
}

export interface NormalizationPass {
  name: string;
  normalize(ir: StyleIR, context: NormalizationContext): NormalizationResult;
}

// ============================================================================
// Stage 2: Validation
// ============================================================================
export interface ValidationContext {
  wcagLevel?: 'A' | 'AA' | 'AAA';
  strictMode?: boolean;
}

export interface Diagnostic {
  id: string;
  nodeId: IRNodeId;
  severity: 'error' | 'warning' | 'info' | 'hint';
  category: string;
  message: string;
  suggestion?: string;
  wcagCriterion?: string;
  autoFixable: boolean;
}

export interface ValidationResult {
  diagnostics: Diagnostic[];
  passed: boolean;
  stats: {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  };
}

export interface ValidationPass {
  name: string;
  validate(ir: StyleIR, context: ValidationContext): ValidationResult;
}

// ============================================================================
// Stage 3: Analysis
// ============================================================================
export interface AnalysisContext {
  theme?: Record<string, any>;
  breakpoints?: Record<string, string>;
}

export interface AnalysisAnnotation {
  nodeId: IRNodeId;
  type: string;
  data: any;
  confidence: number;
}

export interface AnalysisResult {
  ir: StyleIR;
  annotations: AnalysisAnnotation[];
}

export interface AnalysisPass {
  name: string;
  analyze(ir: StyleIR, context: AnalysisContext): AnalysisResult;
}

// ============================================================================
// Stage 4: Optimization
// ============================================================================
export interface OptimizationContext {
  minify?: boolean;
  atomic?: boolean;
  threshold?: number;
}

export interface OptimizationSavings {
  rulesEliminated: number;
  declarationsEliminated: number;
  bytesSaved: number;
}

export interface OptimizationResult {
  ir: StyleIR;
  savings: OptimizationSavings;
  changes: number;
}

export type GenerationTarget = 'css' | 'atomic-css' | 'component' | 'sourcemap';

export interface OptimizationPass {
  name: string;
  optimize(ir: StyleIR, context: OptimizationContext): OptimizationResult;
  cost: 'cheap' | 'moderate' | 'expensive';
  requiredFor: GenerationTarget[];
}

// ============================================================================
// Stage 5: Generation / Lowering
// ============================================================================
export interface LoweringContext {
  target?: GenerationTarget;
  minify?: boolean;
  sourceMap?: boolean;
  namespace?: string;
}

export interface LoweringResult {
  ir: StyleIR;
  generatedOutput?: string;
  generatedNodes: number;
}

export interface LoweringPass {
  name: string;
  generate(ir: StyleIR, context: LoweringContext): LoweringResult;
}

// ============================================================================
// Pipeline Orchestrator
// ============================================================================
export interface PipelineStageResult {
  stage: 'normalization' | 'validation' | 'analysis' | 'optimization' | 'lowering';
  pass: string;
  duration: number;
  result: NormalizationResult | ValidationResult | AnalysisResult | OptimizationResult | LoweringResult;
}

export interface PipelineResult {
  ir: StyleIR;
  timeline: PipelineStageResult[];
  totalDuration: number;
  finalCSS?: string;
  incremental?: {
    dirtyCount: number;
    totalRules: number;
    incrementalSkipped: number;
  };
}

export interface PipelineConfig {
  normalization?: NormalizationPass[];
  validation?: ValidationPass[];
  analysis?: AnalysisPass[];
  optimization?: OptimizationPass[];
  lowering?: LoweringPass[];
  contexts?: {
    normalization?: NormalizationContext;
    validation?: ValidationContext;
    analysis?: AnalysisContext;
    optimization?: OptimizationContext;
    lowering?: LoweringContext;
  };
}

// ============================================================================
// Unified CompilerPass Interface (v3.0)
// ============================================================================

export type PassPhase = 'normalize' | 'validate' | 'analyze' | 'optimize' | 'lower' | 'emit';

export interface CompilerPass {
  /** Unique pass identifier */
  readonly name: string;
  
  /** Which pipeline stage this pass belongs to */
  readonly phase: PassPhase;
  
  /** Passes that must run before this one */
  readonly dependencies: string[];
  
  /** Execute the pass on the IR */
  run(ir: StyleIR, context: PassContext): PassResult;
}

export interface PassContext {
  sourceFile?: string;
  config?: Record<string, any>;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  strictMode?: boolean;
  theme?: Record<string, any>;
  breakpoints?: Record<string, string>;
  minify?: boolean;
  atomic?: boolean;
  target?: 'css' | 'atomic-css' | 'component' | 'sourcemap';
  namespace?: string;
}

export interface PassResult {
  ir: StyleIR;
  diagnostics: Diagnostic[];
  corrections?: Correction[];
  annotations?: AnalysisAnnotation[];
  savings?: OptimizationSavings;
  generatedOutput?: string;
  changes?: number;
}
// ============================================================================
