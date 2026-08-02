// ============================================================================
// FILE: src/compiler/pipeline/compiler-context.ts
// Shared compiler context — connects all subsystems into one unified interface
// ============================================================================

import type { StyleIR, IRRule, IRNodeId } from './ir/types.js';
import type { IRGraph } from './ir/types.js';
import type { SymbolTable } from './symbol-table.js';
import type { DiagnosticsReport } from './diagnostics-reporter.js';
import type { PipelineResult, PipelineStageResult, PassResult } from './pipeline-types.js';
import { buildIRGraph, findAffectedNodes, getGraphStats, exportGraphAsJSON, type GraphExport } from './ir/graph-builder.js';
import { buildSymbolTable, resolveSymbol, findDependents, findUnusedSymbols } from './symbol-table.js';
import { generateDiagnosticsReport } from './diagnostics-reporter.js';

// ============================================================================
// Types
// ============================================================================

export type CompilerEventType = 'ruleAdded' | 'ruleRemoved' | 'diagnostic' | 'cacheHit' | 'compileStart' | 'compileEnd';

export interface CompilerEvent {
  type: CompilerEventType;
  timestamp: number;
  data?: unknown;
}

export type CompilerEventHandler = (event: CompilerEvent) => void;

export interface PerformanceMetrics {
  totalCompiles: number;
  incrementalCompiles: number;
  fullCompiles: number;
  lastCompileDuration: number;
  averageCompileDuration: number;
  peakMemoryUsage?: number;
}

export interface CompilerContextConfig {
  /** Enable incremental compilation */
  incremental?: boolean;
  /** Enable immutable IR mode */
  immutable?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom plugin state */
  plugins?: Map<string, unknown>;
}

// ============================================================================
// CompilerContext
// ============================================================================

export class CompilerContext {
  /** Current IR */
  ir: StyleIR;

  /** Dependency graph (auto-built from IR) */
  graph: IRGraph;

  /** Symbol table (auto-built from IR) */
  symbols: SymbolTable;

  /** Previous pass results (pass name → result) */
  previousResults: Map<string, PassResult>;

  /** Accumulated diagnostics across all passes */
  diagnostics: Array<{
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    suggestion?: string;
    pass: string;
    nodeId?: IRNodeId;
  }>;

  /** Pipeline timeline from last run */
  timeline: PipelineStageResult[];

  /** Performance metrics */
  performance: PerformanceMetrics;

  /** Plugin state (arbitrary key-value) */
  pluginState: Map<string, unknown>;

  /** Configuration */
  config: CompilerContextConfig;

  /** Cache for expensive computations (pass-specific) */
  cache: Map<string, unknown>;

  /** Event handlers */
  private eventHandlers: CompilerEventHandler[] = [];

  private lastIR: StyleIR | null = null;

  constructor(ir: StyleIR, config: CompilerContextConfig = {}) {
    this.ir = config.immutable ? this.cloneIR(ir) : ir;
    this.config = config;
    this.graph = buildIRGraph(this.ir);
    this.symbols = buildSymbolTable(this.ir);
    this.previousResults = new Map();
    this.diagnostics = [];
    this.timeline = [];
    this.pluginState = config.plugins || new Map();
    this.cache = new Map();
    this.performance = {
      totalCompiles: 1,
      incrementalCompiles: 0,
      fullCompiles: 1,
      lastCompileDuration: 0,
      averageCompileDuration: 0,
    };
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  /** Register an event handler. Returns an unsubscribe function. */
  onEvent(handler: CompilerEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  /** Emit an event to all registered handlers. */
  private emit(type: CompilerEventType, data?: unknown): void {
    const event: CompilerEvent = { type, timestamp: Date.now(), data };
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Silently ignore handler errors to avoid breaking compilation
      }
    }
  }

  // ==========================================================================
  // Graph Queries
  // ==========================================================================

  /**
   * Export the full dependency graph as JSON for visualization.
   * Compatible with D3.js, Cytoscape.js, Graphviz, and custom visualizers.
   */
  exportGraph(): GraphExport {
    return exportGraphAsJSON(this.graph, this.ir);
  }

  /**
   * Find all rules affected by a change to a given rule.
   * Uses the dependency graph to trace dependents.
   */
  getAffectedRules(ruleId: IRNodeId): IRNodeId[] {
    return findAffectedNodes(this.graph, ruleId);
  }

  /**
   * Get graph statistics.
   */
  getGraphStats() {
    return getGraphStats(this.graph);
  }

  /**
   * Check if rule A depends on rule B.
   */
  dependsOn(ruleId: IRNodeId, dependencyId: IRNodeId): boolean {
    const rule = this.graph.nodes.get(ruleId);
    return rule?.meta?.dependencies?.includes(dependencyId) ?? false;
  }

  // ==========================================================================
  // Symbol Queries
  // ==========================================================================

  /**
   * Resolve a token/variable/component by name.
   */
  resolveSymbol(name: string) {
    return resolveSymbol(this.symbols, name);
  }

  /**
   * Find all symbols that depend on a given symbol.
   */
  getSymbolDependents(name: string) {
    return findDependents(this.symbols, name);
  }

  /**
   * Find unused symbols (no dependents).
   */
  getUnusedSymbols() {
    return findUnusedSymbols(this.symbols);
  }

  // ==========================================================================
  // Diagnostics
  // ==========================================================================

  /**
   * Add a diagnostic from any pass.
   * Emits a 'diagnostic' event for plugin/IDE consumption.
   */
  addDiagnostic(
    severity: 'error' | 'warning' | 'info' | 'hint',
    message: string,
    pass: string,
    options?: { suggestion?: string; nodeId?: IRNodeId }
  ) {
    const entry = {
      severity,
      message,
      pass,
      suggestion: options?.suggestion,
      nodeId: options?.nodeId,
    };
    this.diagnostics.push(entry);

    // Emit fine-grained diagnostic event
    this.emit('diagnostic', entry);
  }

  /**
   * Get all diagnostics grouped by severity.
   */
  getDiagnosticsSummary() {
    return {
      errors: this.diagnostics.filter(d => d.severity === 'error').length,
      warnings: this.diagnostics.filter(d => d.severity === 'warning').length,
      info: this.diagnostics.filter(d => d.severity === 'info').length,
      hints: this.diagnostics.filter(d => d.severity === 'hint').length,
      total: this.diagnostics.length,
    };
  }

  // ==========================================================================
  // Pass Results
  // ==========================================================================

  /**
   * Store a pass result for later passes to reference.
   */
  setPassResult(passName: string, result: PassResult) {
    this.previousResults.set(passName, result);
  }

  /**
   * Get a previous pass result.
   */
  getPassResult(passName: string): PassResult | undefined {
    return this.previousResults.get(passName);
  }

  /**
   * Check if a pass has already run.
   */
  hasPassRun(passName: string): boolean {
    return this.previousResults.has(passName);
  }

  // ==========================================================================
  // Cache
  // ==========================================================================

  /**
   * Get a cached value (pass-specific).
   * Emits a 'cacheHit' event when a value is found.
   */
  getCached<T>(key: string): T | undefined {
    const value = this.cache.get(key) as T | undefined;
    if (value !== undefined) {
      this.emit('cacheHit', { key });
    }
    return value;
  }

  /**
   * Set a cached value.
   */
  setCached(key: string, value: unknown) {
    this.cache.set(key, value);
  }

  /**
   * Clear the cache.
   */
  clearCache() {
    this.cache.clear();
  }

  // ==========================================================================
  // IR Updates
  // ==========================================================================

  /**
   * Update the IR and rebuild derived data (graph, symbols).
   * Emits 'ruleAdded' and 'ruleRemoved' events for changed rules.
   */
  updateIR(ir: StyleIR) {
    // Detect added/removed rules for event emission
    if (this.lastIR) {
      const oldIds = new Set(this.ir.rules.map(r => r.id));
      const newIds = new Set(ir.rules.map(r => r.id));

      for (const id of newIds) {
        if (!oldIds.has(id)) {
          const rule = ir.rules.find(r => r.id === id);
          this.emit('ruleAdded', { ruleId: id, selector: rule?.selector });
        }
      }

      for (const id of oldIds) {
        if (!newIds.has(id)) {
          const rule = this.ir.rules.find(r => r.id === id);
          this.emit('ruleRemoved', { ruleId: id, selector: rule?.selector });
        }
      }
    }

    this.lastIR = this.config.immutable ? this.cloneIR(ir) : this.ir;
    this.ir = this.config.immutable ? this.cloneIR(ir) : ir;
    this.graph = buildIRGraph(this.ir);
    this.symbols = buildSymbolTable(this.ir);
  }

  /**
   * Mark a rule as changed and find all affected rules.
   */
  markChanged(ruleId: IRNodeId): IRNodeId[] {
    return this.getAffectedRules(ruleId);
  }

  /**
   * Find all rules affected by a token change.
   * Traces: token → symbol dependents → graph dependents.
   */
  getAffectedByToken(tokenName: string): IRNodeId[] {
    const symbol = this.resolveSymbol(tokenName);
    if (!symbol) return [];

    const affected = new Set<IRNodeId>();
    affected.add(symbol.nodeId);

    const dependents = this.getSymbolDependents(tokenName);
    for (const dep of dependents) {
      affected.add(dep.nodeId);
      const graphAffected = this.getAffectedRules(dep.nodeId);
      for (const id of graphAffected) {
        affected.add(id);
      }
    }

    return Array.from(affected);
  }

  /**
   * Find all rules affected by a file change.
   * Combines graph + symbol analysis for comprehensive impact detection.
   */
  getAffectedByFile(filePath: string): IRNodeId[] {
    const affected = new Set<IRNodeId>();

    for (const rule of this.ir.rules) {
      if (rule.source?.file === filePath) {
        affected.add(rule.id);
        const graphAffected = this.getAffectedRules(rule.id);
        for (const id of graphAffected) affected.add(id);
      }
    }

    for (const [, symbol] of this.symbols.symbols) {
      if (symbol.source === filePath) {
        affected.add(symbol.nodeId);
        for (const depId of symbol.dependents) {
          affected.add(depId);
          const graphAffected = this.getAffectedRules(depId);
          for (const id of graphAffected) affected.add(id);
        }
      }
    }

    return Array.from(affected);
  }

  /**
   * Smart incremental compilation decision.
   * Returns impact analysis: how many rules would be affected.
   */
  getIncrementalImpact(changedRuleIds: IRNodeId[]): {
    affectedRules: number;
    totalRules: number;
    percentAffected: number;
    shouldIncremental: boolean;
  } {
    const allAffected = new Set<IRNodeId>();

    for (const id of changedRuleIds) {
      allAffected.add(id);
      const graphAffected = this.getAffectedRules(id);
      for (const affId of graphAffected) allAffected.add(affId);
    }

    const totalRules = this.ir.rules.length;
    const affectedCount = allAffected.size;
    const percentAffected = totalRules > 0 ? Math.round((affectedCount / totalRules) * 100) : 0;

    return {
      affectedRules: affectedCount,
      totalRules,
      percentAffected,
      shouldIncremental: affectedCount > 0 && !this.needsFullRecompile(affectedCount),
    };
  }

  // ==========================================================================
  // Performance
  // ==========================================================================

  /**
   * Record a compilation duration.
   * Emits 'compileStart' on first call, 'compileEnd' after recording.
   */
  recordCompile(duration: number, isIncremental: boolean = false) {
    if (this.performance.totalCompiles === 0) {
      this.emit('compileStart', { isIncremental });
    }

    this.performance.totalCompiles++;
    if (isIncremental) {
      this.performance.incrementalCompiles++;
    } else {
      this.performance.fullCompiles++;
    }
    this.performance.lastCompileDuration = duration;
    const total = this.performance.totalCompiles;
    this.performance.averageCompileDuration =
      (this.performance.averageCompileDuration * (total - 1) + duration) / total;

    this.emit('compileEnd', { duration, isIncremental, totalCompiles: this.performance.totalCompiles });
  }

  /**
   * Generate a full diagnostics report.
   */
  generateReport(totalDuration: number): DiagnosticsReport {
    return generateDiagnosticsReport(this.timeline, this.ir, totalDuration);
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Check if a full recompile is needed (>50% rules dirty).
   */
  needsFullRecompile(dirtyCount: number): boolean {
    const totalRules = this.ir.rules.length;
    return totalRules === 0 || dirtyCount > totalRules * 0.5;
  }

  /**
   * Get a summary of the compiler state.
   */
  getSummary() {
    return {
      rules: this.ir.rules.length,
      deadRules: this.ir.rules.filter(r => r.isDead).length,
      symbols: this.symbols.stats,
      graph: this.getGraphStats(),
      diagnostics: this.getDiagnosticsSummary(),
      performance: this.performance,
      passesRun: this.previousResults.size,
    };
  }

  private cloneIR(ir: StyleIR): StyleIR {
    const cloned = JSON.parse(JSON.stringify(ir));
    if (ir.graph) {
        cloned.graph = buildIRGraph(cloned);
    }
    return cloned;
}
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new compiler context from an IR.
 */
export function createCompilerContext(
  ir: StyleIR,
  config?: CompilerContextConfig
): CompilerContext {
  return new CompilerContext(ir, config);
}

/**
 * Update an existing context with new IR (for incremental compilation).
 */
export function updateCompilerContext(
  ctx: CompilerContext,
  newIR: StyleIR
): CompilerContext {
  ctx.updateIR(newIR);
  return ctx;
}