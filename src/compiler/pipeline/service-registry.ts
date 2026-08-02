// src/compiler/pipeline/service-registry.ts
// Central service registry — connects cache, graph, tokens, diagnostics, emitter, watcher, logger

import type { CompilerContext } from "./compiler-context.js";
import type { StyleIR } from "./ir/types.js";
import type { IRGraph } from "./ir/types.js";
import type { SymbolTable } from "./symbol-table.js";
import type { DiagnosticsReport } from "./diagnostics-reporter.js";
import type { PassResult } from "./pipeline-types.js";

// ============================================================================
// Service Interfaces
// ============================================================================

export interface CacheService {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  size: number;
}

export interface GraphService {
  getAffectedRules(ruleId: string): string[];
  getStats(): ReturnType<typeof import("./ir/graph-builder.js").getGraphStats>;
  dependsOn(ruleId: string, dependencyId: string): boolean;
  exportGraph(): import("./ir/graph-builder.js").GraphExport;
  readonly graph: IRGraph;
}

export interface SymbolService {
  resolve(
    name: string,
  ): ReturnType<typeof import("./symbol-table.js").resolveSymbol>;
  getDependents(
    name: string,
  ): ReturnType<typeof import("./symbol-table.js").findDependents>;
  getUnused(): ReturnType<typeof import("./symbol-table.js").findUnusedSymbols>;
  readonly table: SymbolTable;
}

export interface DiagnosticsService {
  add(
    severity: string,
    message: string,
    pass: string,
    opts?: { suggestion?: string; nodeId?: string },
  ): void;
  summary(): {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
    total: number;
  };
  generateReport(totalDuration: number): DiagnosticsReport;
  readonly items: ReadonlyArray<{
    severity: string;
    message: string;
    pass: string;
    suggestion?: string;
    nodeId?: string;
  }>;
}

export interface EmitterService {
  emit(ir: StyleIR): string;
  emitAtomic(ir: StyleIR): string;
}

export interface WatcherService {
  on(
    event: "change" | "add" | "unlink",
    callback: (filePath: string) => void,
  ): void;
  off(event: string, callback: Function): void;
  watch(patterns: string[]): void;
  unwatch(): void;
}

export interface LoggerService {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  setLevel(level: "debug" | "info" | "warn" | "error"): void;
}

// ============================================================================
// Service Registry
// ============================================================================

export class ServiceRegistry {
  private services = new Map<string, unknown>();

  /** Register a service by name */
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  /** Get a service by name */
  get<T>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  /** Check if a service is registered */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /** Remove a service */
  unregister(name: string): void {
    this.services.delete(name);
  }

  /** Get all registered service names */
  list(): string[] {
    return Array.from(this.services.keys());
  }
}

// ============================================================================
// Built-in Service Factory
// ============================================================================

/**
 * Create a fully populated service registry from a CompilerContext.
 * Wraps each subsystem as a service.
 */
export function createServiceRegistry(ctx: CompilerContext): ServiceRegistry {
  const registry = new ServiceRegistry();

  // Cache service
  registry.register<CacheService>("cache", {
    get: <T>(key: string) => ctx.getCached<T>(key),
    set: (key, value) => ctx.setCached(key, value),
    has: (key) => ctx.getCached(key) !== undefined,
    delete: (key) => ctx.setCached(key, undefined),
    clear: () => ctx.clearCache(),
    get size() {
      return ctx.cache.size;
    },
  });

  // Graph service
  registry.register<GraphService>("graph", {
    getAffectedRules: (ruleId) => ctx.getAffectedRules(ruleId),
    getStats: () => ctx.getGraphStats(),
    dependsOn: (ruleId, depId) => ctx.dependsOn(ruleId, depId),
    exportGraph: () => ctx.exportGraph(), // ADD
    get graph() {
      return ctx.graph;
    },
  });

  // Symbol service
  registry.register<SymbolService>("symbols", {
    resolve: (name) => ctx.resolveSymbol(name),
    getDependents: (name) => ctx.getSymbolDependents(name),
    getUnused: () => ctx.getUnusedSymbols(),
    get table() {
      return ctx.symbols;
    },
  });

  // Diagnostics service
  registry.register<DiagnosticsService>("diagnostics", {
    add: (severity, message, pass, opts) =>
      ctx.addDiagnostic(severity as any, message, pass, opts),
    summary: () => ctx.getDiagnosticsSummary(),
    generateReport: (totalDuration) => ctx.generateReport(totalDuration),
    get items() {
      return ctx.diagnostics;
    },
  });

  // Logger service (simple console-based)
  registry.register<LoggerService>("logger", {
    info: (msg, ...args) => console.log(`[ChainCSS] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[ChainCSS] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ChainCSS] ${msg}`, ...args),
    debug: (msg, ...args) => {
      if (ctx.config.verbose) console.debug(`[ChainCSS] ${msg}`, ...args);
    },
    setLevel: (_level) => {
      /* no-op for now */
    },
  });

  return registry;
}
