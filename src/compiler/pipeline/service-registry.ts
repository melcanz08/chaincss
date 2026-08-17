// src/compiler/pipeline/service-registry.ts
// Central service registry — connects cache, graph, tokens, diagnostics, emitter, watcher, logger

import type { CompilerContext } from "./compiler-context.js";
import type { StyleIR, IRGraph } from "./ir/types.js";
import type { SymbolTable } from "./symbol-table.js";
import type { DiagnosticsReport } from "./diagnostics-reporter.js";
import { emit as executeEmit } from "./lowering/emitter-registry.js";

// ============================================================================
// Service Interfaces
// ============================================================================

export interface CacheService {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
}

export interface GraphService {
  getAffectedRules(ruleId: string): string[];
  getStats(): ReturnType<typeof import("../incremental/graph-builder.js").getGraphStats>;
  dependsOn(ruleId: string, dependencyId: string): boolean;
  exportGraph(): import("../incremental/graph-builder.js").GraphExport;
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
    severity: "error" | "warning" | "info" | "hint",
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
  off(event: string, callback: (...args: unknown[]) => void): void;
  watch(patterns: string[]): void;
  unwatch(): void;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerService {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  setLevel(level: LogLevel): void;
}

// Map of core built-in services for type inference
export interface KnownServices {
  cache: CacheService;
  graph: GraphService;
  symbols: SymbolService;
  diagnostics: DiagnosticsService;
  emitter: EmitterService;
  watcher: WatcherService;
  logger: LoggerService;
}

export interface ServiceRegistryOptions {
  watcher?: WatcherService;
  emitter?: EmitterService;
}

// ============================================================================
// Service Registry
// ============================================================================

export class ServiceRegistry {
  private services = new Map<string, unknown>();

  /** Register a service by name */
  register<K extends keyof KnownServices>(name: K, service: KnownServices[K]): void;
  register<T>(name: string, service: T): void;
  register(name: string, service: unknown): void {
    this.services.set(name, service);
  }

  /** Get a service by name */
  get<K extends keyof KnownServices>(name: K): KnownServices[K] | undefined;
  get<T>(name: string): T | undefined;
  get<T>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  /** Get a service by name or throw if unregistered */
  getRequired<K extends keyof KnownServices>(name: K): KnownServices[K];
  getRequired<T>(name: string): T;
  getRequired<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Required service "${name}" is not registered in ServiceRegistry.`);
    }
    return service as T;
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

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Create a fully populated service registry from a CompilerContext.
 */
export function createServiceRegistry(
  ctx: CompilerContext,
  options: ServiceRegistryOptions = {}
): ServiceRegistry {
  const registry = new ServiceRegistry();

  // 1. Cache service
  registry.register("cache", {
    get: <T>(key: string) => ctx.getCached<T>(key),
    set: (key, value) => ctx.setCached(key, value),
    has: (key) => ctx.cache.has(key),
    delete: (key) => ctx.cache.delete(key),
    clear: () => ctx.clearCache(),
    get size() {
      return ctx.cache.size;
    },
  });

  // 2. Graph service
  registry.register("graph", {
    getAffectedRules: (ruleId) => ctx.getAffectedRules(ruleId),
    getStats: () => ctx.getGraphStats(),
    dependsOn: (ruleId, depId) => ctx.dependsOn(ruleId, depId),
    exportGraph: () => ctx.exportGraph(),
    get graph() {
      return ctx.graph;
    },
  });

  // 3. Symbol service
  registry.register("symbols", {
    resolve: (name) => ctx.resolveSymbol(name),
    getDependents: (name) => ctx.getSymbolDependents(name),
    getUnused: () => ctx.getUnusedSymbols(),
    get table() {
      return ctx.symbols;
    },
  });

  // 4. Diagnostics service
  registry.register("diagnostics", {
    add: (severity, message, pass, opts) =>
      ctx.addDiagnostic(severity, message, pass, opts),
    summary: () => ctx.getDiagnosticsSummary(),
    generateReport: (totalDuration) => ctx.generateReport(totalDuration),
    get items() {
      return ctx.diagnostics;
    },
  });

  // 5. Emitter service
  registry.register("emitter", options.emitter ?? {
    emit: (ir) => {
      const result = executeEmit(ir, "css", {
        minify: ctx.config.minify,
        sourceMap: ctx.config.sourceMap,
      });
      return result?.output ?? "";
    },
    emitAtomic: (ir) => {
      const result = executeEmit(ir, "atomic-css", {
        minify: ctx.config.minify,
      });
      return result?.output ?? "";
    },
  });

  // 6. Watcher service
  registry.register("watcher", options.watcher ?? {
    on: () => {},
    off: () => {},
    watch: () => {},
    unwatch: () => {},
  });

  // 7. Logger service (configurable level filtering)
  let currentLogLevel: LogLevel = ctx.config.verbose ? "debug" : "info";

  registry.register("logger", {
    debug: (msg, ...args) => {
      if (LOG_LEVEL_WEIGHTS[currentLogLevel] <= LOG_LEVEL_WEIGHTS.debug) {
        console.debug(`[ChainCSS] ${msg}`, ...args);
      }
    },
    info: (msg, ...args) => {
      if (LOG_LEVEL_WEIGHTS[currentLogLevel] <= LOG_LEVEL_WEIGHTS.info) {
        console.log(`[ChainCSS] ${msg}`, ...args);
      }
    },
    warn: (msg, ...args) => {
      if (LOG_LEVEL_WEIGHTS[currentLogLevel] <= LOG_LEVEL_WEIGHTS.warn) {
        console.warn(`[ChainCSS] ${msg}`, ...args);
      }
    },
    error: (msg, ...args) => {
      if (LOG_LEVEL_WEIGHTS[currentLogLevel] <= LOG_LEVEL_WEIGHTS.error) {
        console.error(`[ChainCSS] ${msg}`, ...args);
      }
    },
    setLevel: (level: LogLevel) => {
      currentLogLevel = level;
    },
  });

  return registry;
}