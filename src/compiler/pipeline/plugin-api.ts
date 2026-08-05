// ============================================================================
// FILE: src/compiler/pipeline/plugin-api.ts
// ============================================================================

import semver from "semver";
import type { StyleIR } from "./ir/types.js";
import type {
  GraphService,
  SymbolService,
  DiagnosticsService,
  CacheService,
  LoggerService,
} from "./service-registry.js";
import type {
  NormalizationResult,
  ValidationResult,
  AnalysisResult,
  OptimizationResult,
  LoweringResult,
} from "./pipeline-types.js";

// ============================================================================
// Deep Readonly + Freeze
// ============================================================================

export type DeepReadonly<T> = T extends (...args: any[]) => any
  ? T
  : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

function deepFreeze(obj: any): any {
  if (obj === null || typeof obj !== "object" || Object.isFrozen(obj))
    return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") deepFreeze(value);
  }
  return obj;
}

// ============================================================================
// Timing Helpers
// ============================================================================

export interface TimedExecution<T> {
  result: T;
  duration: number;
}

export function executeTimed<T>(fn: () => T): TimedExecution<T> {
  const start = performance.now();
  const result = fn();
  const duration = Math.round((performance.now() - start) * 100) / 100;
  return { result, duration };
}

export async function executeTimedAsync<T>(
  fn: () => Promise<T>,
): Promise<TimedExecution<T>> {
  const start = performance.now();
  const result = await fn();
  const duration = Math.round((performance.now() - start) * 100) / 100;
  return { result, duration };
}

// ============================================================================
// Ring Buffer (bounded execution log)
// ============================================================================

class RingBuffer<T> {
  private buffer: T[];
  private index = 0;
  private _size = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.capacity;
    if (this._size < this.capacity) this._size++;
  }

  toArray(): T[] {
    if (this._size === 0) return [];
    const result: T[] = [];
    const start = this._size < this.capacity ? 0 : this.index;
    for (let i = 0; i < this._size; i++) {
      result.push(this.buffer[(start + i) % this.capacity]);
    }
    return result;
  }

  get size(): number {
    return this._size;
  }
}

// ============================================================================
// Plugin Context
// ============================================================================

export interface PluginServices {
  readonly graph: GraphService;
  readonly symbols: SymbolService;
  readonly diagnostics: DiagnosticsService;
  readonly cache: CacheService;
  readonly logger: LoggerService;
}

export interface PluginContext {
  readonly ir: DeepReadonly<StyleIR>;
  readonly services: PluginServices;
}

export interface PluginSetupContext {
  readonly version: string;
  readonly compilerConfig: Record<string, unknown>;
  readonly pluginOptions: Record<string, unknown>;
  readonly root: string;
  readonly cwd: string;
  readonly env: "development" | "production" | "test";
  readonly watch: boolean;
  readonly services: PluginServices;
}

export interface PluginMetadata {
  apiVersion: string;
  version: string;
  requires?: string;
  homepage?: string;
  author?: string;
  description?: string;
  displayName?: string;
  keywords?: string[];
  license?: string;
  repository?: string;
}

export type AsyncOrSync<T> = T | Promise<T>;

export interface PluginConsumes {
  capability: string;
  version?: string;
  required?: boolean;
}

// ============================================================================
// Lifecycle
// ============================================================================

export type LifecyclePolicy = "continue" | "abort";

export interface LifecycleOptions {
  buildStart?: LifecyclePolicy;
  buildEnd?: LifecyclePolicy;
  beforeEmit?: LifecyclePolicy;
}

const DEFAULT_LIFECYCLE: LifecycleOptions = {
  buildStart: "continue",
  buildEnd: "abort",
  beforeEmit: "abort",
};

export type PluginPhase =
  "normalize" | "validate" | "analyze" | "optimize" | "lower";
export type LifecycleHook =
  "buildStart" | "buildEnd" | "watchStart" | "watchEnd";
export type TransformHook = "beforeEmit" | "afterEmit";
export type TimedPhase = PluginPhase | TransformHook | LifecycleHook;

type PhaseHandlerMap = {
  normalize: (ctx: PluginContext) => AsyncOrSync<NormalizationResult>;
  validate: (ctx: PluginContext) => AsyncOrSync<ValidationResult>;
  analyze: (ctx: PluginContext) => AsyncOrSync<AnalysisResult>;
  optimize: (ctx: PluginContext) => AsyncOrSync<OptimizationResult>;
  lower: (ctx: PluginContext) => AsyncOrSync<LoweringResult>;
};

function getPhaseHandler<K extends PluginPhase>(
  plugin: ChainCSSPlugin,
  phase: K,
): PhaseHandlerMap[K] | undefined {
  return plugin[phase] as PhaseHandlerMap[K] | undefined;
}

// ============================================================================
// Plugin Descriptor & Inspection
// ============================================================================

export interface PluginDescriptor {
  plugin: ChainCSSPlugin;
  state: PluginState;
  stateReason?: string;
  capabilities: string[];
  executionTime: number;
  executionCount: number;
  failureCount: number;
  lastExecution?: number;
  lastFailure?: number;
  phaseTimes: Partial<Record<TimedPhase, number>>;
  errors: Error[];
}

export interface PluginInspection {
  name: string;
  displayName?: string;
  state: PluginState;
  stateReason?: string;
  capabilities: string[];
  executionTime: number;
  executionCount: number;
  failureCount: number;
  phaseTimes: Partial<Record<TimedPhase, number>>;
  errors: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "dependency" | "optional" | "before" | "after";
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyEdge[];
}

// ============================================================================
// Events
// ============================================================================

export type PluginEventType =
  | "activated"
  | "degraded"
  | "failed"
  | "removed"
  | "ruleAdded"
  | "ruleRemoved"
  | "diagnostic"
  | "cacheHit";

export interface PluginEvent {
  type: PluginEventType;
  plugin: string;
  timestamp: number;
  reason?: string;
  data?: unknown;
}

export type PluginEventHandler = (event: PluginEvent) => void;

// ============================================================================
// Plugin Interface
// ============================================================================

export interface ChainCSSPlugin<TOptions = Record<string, unknown>> {
  name: string;
  meta: PluginMetadata;
  options?: TOptions;
  before?: string[];
  after?: string[];
  priority?: number;
  provides?: string[];
  consumes?: (string | PluginConsumes)[];
  dependencies?: string[];
  optionalDependencies?: string[];
  supports?: string[];
  setup?: (ctx: PluginSetupContext) => AsyncOrSync<void>;
  buildStart?: (ctx: PluginContext) => AsyncOrSync<void>;
  buildEnd?: (ctx: PluginContext) => AsyncOrSync<void>;
  normalize?: PhaseHandlerMap["normalize"];
  validate?: PhaseHandlerMap["validate"];
  analyze?: PhaseHandlerMap["analyze"];
  optimize?: PhaseHandlerMap["optimize"];
  lower?: PhaseHandlerMap["lower"];
  watchStart?: (ctx: PluginContext) => AsyncOrSync<void>;
  watchEnd?: (ctx: PluginContext) => AsyncOrSync<void>;
  fileChanged?: (ctx: PluginContext, filePath: string) => AsyncOrSync<void>;
  beforeEmit?: (ctx: PluginContext) => AsyncOrSync<void>;
  afterEmit?: (ctx: PluginContext, css: string) => AsyncOrSync<string>;
  teardown?: () => AsyncOrSync<void>;
}

export type PluginFactory<TOptions = Record<string, unknown>> = (
  options?: TOptions,
) => ChainCSSPlugin<TOptions>;

// ============================================================================
// Plugin State
// ============================================================================

export enum PluginState {
  Registered = "registered",
  Initialized = "initialized",
  Active = "active",
  Degraded = "degraded",
  Failed = "failed",
  Removed = "removed",
}

const VALID_TRANSITIONS: Record<PluginState, PluginState[]> = {
  [PluginState.Registered]: [
    PluginState.Initialized,
    PluginState.Failed,
    PluginState.Removed,
  ],
  [PluginState.Initialized]: [
    PluginState.Active,
    PluginState.Failed,
    PluginState.Removed,
  ],
  [PluginState.Active]: [
    PluginState.Degraded,
    PluginState.Failed,
    PluginState.Removed,
  ],
  [PluginState.Degraded]: [
    PluginState.Active,
    PluginState.Failed,
    PluginState.Removed,
  ],
  [PluginState.Failed]: [PluginState.Removed],
  [PluginState.Removed]: [],
};

// ============================================================================
// Execution Context
// ============================================================================

export interface PluginExecutionContext {
  plugin: string;
  phase: PluginPhase | LifecycleHook | TransformHook;
  duration: number;
  success: boolean;
  error?: string;
}

export interface CapabilityIssue {
  plugin: string;
  capability: string;
  severity: "warning" | "error";
  message: string;
}

export interface InitializationResult {
  success: boolean;
  errors: CapabilityIssue[];
  warnings: CapabilityIssue[];
}

// ============================================================================
// Plugin Registry
// ============================================================================

const CURRENT_API_VERSION = "12.9.0";
const MAX_EXECUTION_LOG = 5000;
const MAX_ERRORS_PER_PLUGIN = 100;

export class PluginRegistry {
  private plugins = new Map<string, PluginDescriptor>();
  private pending: ChainCSSPlugin[] = [];
  private initialized = false;
  private services: PluginServices;
  private setupDefaults: PluginSetupContext;
  private executionLog = new RingBuffer<PluginExecutionContext>(
    MAX_EXECUTION_LOG,
  );
  private devMode: boolean;
  private activeFeatures = new Set<string>();
  private capabilityProviders = new Map<
    string,
    Array<{ plugin: string; version: string }>
  >();
  private executionOrder: string[] = [];
  private eventHandlers: PluginEventHandler[] = [];

  constructor(services: PluginServices, setup: PluginSetupContext) {
    if (!services.logger)
      throw new Error('PluginRegistry: "logger" service is required.');
    if (!services.graph)
      throw new Error('PluginRegistry: "graph" service is required.');
    if (!services.diagnostics)
      throw new Error('PluginRegistry: "diagnostics" service is required.');
    this.services = services;
    this.setupDefaults = setup;
    this.devMode = setup.env === "development";
  }

  // ── Events ────────────────────────────────────────────

  onEvent(handler: PluginEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  private emit(event: PluginEvent): void {
    for (const h of this.eventHandlers) {
      try {
        h(event);
      } catch (err) {
        this.services.logger.warn(
          `Plugin event handler error: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Emit a broadcast event (not tied to a specific plugin). */
  emitBroadcast(type: PluginEventType, data?: unknown): void {
    this.emit({ type, plugin: "*", timestamp: Date.now(), data });
  }

  // ── Registration ──────────────────────────────────────

  async use(plugin: ChainCSSPlugin): Promise<void>;
  async use<TOptions>(
    factory: PluginFactory<TOptions>,
    options: TOptions,
  ): Promise<void>;
  async use<TOptions extends Record<string, unknown> = Record<string, unknown>>(
    pluginOrFactory: ChainCSSPlugin<TOptions> | PluginFactory<TOptions>,
    options?: TOptions,
  ): Promise<void> {
    const plugin: ChainCSSPlugin =
      typeof pluginOrFactory === "function"
        ? pluginOrFactory(options)
        : (pluginOrFactory as ChainCSSPlugin);

    if (!plugin || typeof plugin.name !== "string") {
      throw new Error("Invalid ChainCSS plugin.");
    }
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }
    if (!plugin.meta?.apiVersion) {
      throw new Error(`Plugin "${plugin.name}" must declare meta.apiVersion.`);
    }
    if (!semver.satisfies(CURRENT_API_VERSION, plugin.meta.apiVersion)) {
      throw new Error(
        `Plugin "${plugin.name}" requires API ${plugin.meta.apiVersion}.`,
      );
    }
    if (plugin.options) deepFreeze(plugin.options);

    const desc: PluginDescriptor = {
      plugin,
      state: PluginState.Registered,
      capabilities: [],
      executionTime: 0,
      executionCount: 0,
      failureCount: 0,
      phaseTimes: {},
      errors: [],
    };

    this.plugins.set(plugin.name, desc);

    if (this.initialized) {
      await this.validateAndSetup(desc);
      this.setState(desc, PluginState.Active);
      this.rebuildExecutionOrder();
    } else {
      this.pending.push(plugin);
    }
  }

  activateFeatures(features: string[]): void {
    this.activeFeatures = new Set(features);
  }

  // ── Initialization ────────────────────────────────────

  async initialize(): Promise<InitializationResult> {
    const errors: CapabilityIssue[] = [];
    const warnings: CapabilityIssue[] = [];
    const ordered = this.topologicalSort(this.pending);
    this.executionOrder = ordered.map((p) => p.name);

    for (const plugin of ordered) {
      const desc = this.plugins.get(plugin.name)!;
      try {
        await this.validateAndSetup(desc);
        this.setState(desc, PluginState.Initialized);
      } catch (e) {
        this.setState(desc, PluginState.Failed, (e as Error).message);
        this.pushError(desc, e as Error);
        errors.push({
          plugin: plugin.name,
          capability: "initialization",
          severity: "error",
          message: (e as Error).message,
        });
      }
    }

    this.pending = [];
    this.initialized = true;

    for (const issue of this.validateCapabilities()) {
      if (issue.severity === "error") errors.push(issue);
      else warnings.push(issue);
    }

    return { success: errors.length === 0, errors, warnings };
  }

  activateAll(): void {
    for (const name of this.executionOrder) {
      const desc = this.plugins.get(name);
      if (desc && desc.state === PluginState.Initialized) {
        this.setState(desc, PluginState.Active);
      }
    }
  }

  // ── State Management ──────────────────────────────────

  private setState(
    desc: PluginDescriptor,
    to: PluginState,
    reason?: string,
  ): void {
    const from = desc.state;
    if (from && !VALID_TRANSITIONS[from]?.includes(to)) {
      throw new Error(`Invalid state transition: ${from} → ${to}.`);
    }
    desc.state = to;
    if (reason) desc.stateReason = reason;

    const eventMap: Partial<Record<PluginState, PluginEventType>> = {
      [PluginState.Active]: "activated",
      [PluginState.Degraded]: "degraded",
      [PluginState.Failed]: "failed",
      [PluginState.Removed]: "removed",
    };

    const eventType = eventMap[to];
    if (eventType) {
      this.emit({
        type: eventType,
        plugin: desc.plugin.name,
        timestamp: Date.now(),
        reason,
      });
    }
  }

  private pushError(desc: PluginDescriptor, err: Error): void {
    desc.errors.push(err);
    if (desc.errors.length > MAX_ERRORS_PER_PLUGIN) {
      desc.errors = desc.errors.slice(-MAX_ERRORS_PER_PLUGIN);
    }
  }

  private rebuildExecutionOrder(): void {
    const allPlugins = Array.from(this.plugins.values()).map((d) => d.plugin);
    this.executionOrder = this.topologicalSort(allPlugins).map((p) => p.name);
  }

  // ── Graph ─────────────────────────────────────────────

  getDependencyGraph(): DependencyGraph {
    const nodes: string[] = [];
    const edges: DependencyEdge[] = [];

    for (const [name] of this.plugins) nodes.push(name);

    for (const [, desc] of this.plugins) {
      if (desc.plugin.dependencies) {
        for (const dep of desc.plugin.dependencies) {
          if (this.plugins.has(dep))
            edges.push({ from: dep, to: desc.plugin.name, type: "dependency" });
        }
      }
      if (desc.plugin.optionalDependencies) {
        for (const dep of desc.plugin.optionalDependencies) {
          if (this.plugins.has(dep))
            edges.push({ from: dep, to: desc.plugin.name, type: "optional" });
        }
      }
      if (desc.plugin.before) {
        for (const b of desc.plugin.before) {
          if (this.plugins.has(b))
            edges.push({ from: desc.plugin.name, to: b, type: "before" });
        }
      }
      if (desc.plugin.after) {
        for (const a of desc.plugin.after) {
          if (this.plugins.has(a))
            edges.push({ from: a, to: desc.plugin.name, type: "after" });
        }
      }
    }

    return { nodes, edges };
  }

  // ── Topological Sort ──────────────────────────────────

  private topologicalSort(plugins: ChainCSSPlugin[]): ChainCSSPlugin[] {
    if (plugins.length <= 1) return [...plugins];

    const inDegree = new Map<string, number>();
    const dependents = new Map<string, Set<string>>();
    const pluginMap = new Map(plugins.map((p) => [p.name, p]));

    for (const p of plugins) {
      inDegree.set(p.name, 0);
      dependents.set(p.name, new Set());
    }

    for (const p of plugins) {
      if (p.dependencies)
        for (const dep of p.dependencies) {
          if (pluginMap.has(dep)) addEdge(dep, p.name, dependents, inDegree);
        }
      if (p.optionalDependencies)
        for (const dep of p.optionalDependencies) {
          if (pluginMap.has(dep)) addEdge(dep, p.name, dependents, inDegree);
        }
      if (p.after)
        for (const a of p.after) {
          if (pluginMap.has(a)) addEdge(a, p.name, dependents, inDegree);
        }
      if (p.before)
        for (const b of p.before) {
          if (pluginMap.has(b)) addEdge(p.name, b, dependents, inDegree);
        }
    }

    const queue: string[] = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) queue.push(name);
    }
    queue.sort(
      (a, b) =>
        (pluginMap.get(a)?.priority || 100) -
        (pluginMap.get(b)?.priority || 100),
    );

    const sorted: ChainCSSPlugin[] = [];
    while (queue.length > 0) {
      const name = queue.shift()!;
      const plugin = pluginMap.get(name);
      if (plugin) sorted.push(plugin);

      for (const dep of dependents.get(name) || []) {
        const d = (inDegree.get(dep) || 1) - 1;
        inDegree.set(dep, d);
        if (d === 0) {
          const prio = pluginMap.get(dep)?.priority || 100;
          let i = 0;
          while (
            i < queue.length &&
            (pluginMap.get(queue[i])?.priority || 100) <= prio
          )
            i++;
          queue.splice(i, 0, dep);
        }
      }
    }

    if (sorted.length !== plugins.length) {
      throw new Error("Plugin dependency cycle detected.");
    }
    return sorted;
  }

  // ── Setup ─────────────────────────────────────────────

  private async validateAndSetup(desc: PluginDescriptor): Promise<void> {
    const plugin = desc.plugin;

    if (
      plugin.meta?.requires &&
      !semver.satisfies(this.setupDefaults.version, plugin.meta.requires)
    ) {
      throw new Error(
        `Plugin "${plugin.name}" requires ChainCSS ${plugin.meta.requires}.`,
      );
    }

    try {
      if (plugin.setup) {
        await plugin.setup({
          ...this.setupDefaults,
          pluginOptions: plugin.options || {},
        });
      }

      if (plugin.provides) {
        for (const p of plugin.provides) {
          const idx = p.lastIndexOf("@");
          const name = idx >= 0 ? p.slice(0, idx) : p;
          const version = idx >= 0 ? p.slice(idx + 1) : "0.0.0";
          desc.capabilities.push(name);
          if (!this.capabilityProviders.has(name))
            this.capabilityProviders.set(name, []);
          this.capabilityProviders
            .get(name)!
            .push({ plugin: plugin.name, version });
        }
      }

      this.services.logger.info(`Plugin "${plugin.name}" registered.`);
    } catch (err) {
      if (plugin.teardown) await plugin.teardown();
      throw err;
    }
  }

  private removeCapabilities(name: string): void {
    for (const [c, providers] of this.capabilityProviders) {
      const filtered = providers.filter((x) => x.plugin !== name);
      if (filtered.length) this.capabilityProviders.set(c, filtered);
      else this.capabilityProviders.delete(c);
    }
  }

  // ── Phase Execution ───────────────────────────────────

  async executePhase<K extends PluginPhase>(
    plugin: ChainCSSPlugin,
    phase: K,
    ctx: PluginContext,
  ): Promise<{
    result?: Awaited<ReturnType<PhaseHandlerMap[K]>>;
    execution: PluginExecutionContext;
  }> {
    const desc = this.plugins.get(plugin.name);
    if (
      !desc ||
      (desc.state !== PluginState.Initialized &&
        desc.state !== PluginState.Active &&
        desc.state !== PluginState.Degraded)
    ) {
      throw new Error(`Plugin "${plugin.name}" is not active.`);
    }

    const fn = getPhaseHandler(plugin, phase);
    if (!fn) {
      return {
        execution: { plugin: plugin.name, phase, duration: 0, success: true },
      };
    }

    if (ctx.ir && !Object.isFrozen(ctx.ir)) Object.freeze(ctx.ir);
    if (this.devMode) deepFreeze(ctx.ir);

    const { result, duration } = await executeTimedAsync(() =>
      Promise.resolve(fn(ctx)),
    );
    desc.executionTime += duration;
    desc.executionCount++;
    desc.lastExecution = Date.now();
    desc.phaseTimes[phase] = (desc.phaseTimes[phase] || 0) + duration;

    const execution: PluginExecutionContext = {
      plugin: plugin.name,
      phase,
      duration,
      success: true,
    };
    this.executionLog.push(execution);

    return { result: result as any, execution };
  }

  // ── Lifecycle Hooks ───────────────────────────────────

  async executeHook(
    hook: LifecycleHook,
    ctx: PluginContext,
    options?: LifecycleOptions,
  ): Promise<void> {
    const policy = { ...DEFAULT_LIFECYCLE, ...options };
    const hookPolicy = policy[hook as keyof LifecycleOptions] || "continue";
    const activeByName = new Map(
      this.getActive().map((d) => [d.plugin.name, d]),
    );

    for (const name of this.executionOrder) {
      const desc = activeByName.get(name);
      if (!desc) continue;
      const fn = desc.plugin[hook];
      if (!fn) continue;

      try {
        const { duration } = await executeTimedAsync(() => (fn as any)(ctx));
        desc.executionCount++;
        desc.lastExecution = Date.now();
        desc.phaseTimes[hook] = (desc.phaseTimes[hook] || 0) + duration;
        this.executionLog.push({
          plugin: desc.plugin.name,
          phase: hook,
          duration,
          success: true,
        });
      } catch (e) {
        const err = e as Error;
        desc.failureCount++;
        desc.lastFailure = Date.now();
        this.pushError(desc, err);
        this.executionLog.push({
          plugin: desc.plugin.name,
          phase: hook,
          duration: 0,
          success: false,
          error: err.message,
        });

        if (hookPolicy === "continue") {
          this.setState(desc, PluginState.Degraded, err.message);
        } else {
          throw e;
        }
      }
    }
  }

  async executeBeforeEmit(ctx: PluginContext): Promise<void> {
    const activeByName = new Map(
      this.getActive().map((d) => [d.plugin.name, d]),
    );

    for (const name of this.executionOrder) {
      const desc = activeByName.get(name);
      if (!desc) continue;
      const fn = desc.plugin.beforeEmit;
      if (!fn) continue;

      try {
        const { duration } = await executeTimedAsync(() =>
          Promise.resolve(fn(ctx)),
        );
        desc.executionCount++;
        desc.lastExecution = Date.now();
        desc.phaseTimes["beforeEmit"] =
          (desc.phaseTimes["beforeEmit"] || 0) + duration;
        this.executionLog.push({
          plugin: desc.plugin.name,
          phase: "beforeEmit",
          duration,
          success: true,
        });
      } catch (e) {
        const err = e as Error;
        desc.failureCount++;
        desc.lastFailure = Date.now();
        this.pushError(desc, err);
        this.executionLog.push({
          plugin: desc.plugin.name,
          phase: "beforeEmit",
          duration: 0,
          success: false,
          error: err.message,
        });
        throw e;
      }
    }
  }

  async executeAfterEmit(ctx: PluginContext, css: string): Promise<string> {
    let result = css;
    const activeByName = new Map(
      this.getActive().map((d) => [d.plugin.name, d]),
    );

    for (const name of this.executionOrder) {
      const desc = activeByName.get(name);
      if (!desc) continue;
      const fn = desc.plugin.afterEmit;
      if (!fn) continue;

      try {
        const timed = await executeTimedAsync(() =>
          Promise.resolve(fn(ctx, result)),
        );
        result = timed.result;
        desc.executionCount++;
        desc.lastExecution = Date.now();
        desc.phaseTimes["afterEmit"] =
          (desc.phaseTimes["afterEmit"] || 0) + timed.duration;
        this.executionLog.push({
          plugin: desc.plugin.name,
          phase: "afterEmit",
          duration: timed.duration,
          success: true,
        });
      } catch (e) {
        const err = e as Error;
        desc.failureCount++;
        desc.lastFailure = Date.now();
        this.pushError(desc, err);
        this.executionLog.push({
          plugin: desc.plugin.name,
          phase: "afterEmit",
          duration: 0,
          success: false,
          error: err.message,
        });
        throw e;
      }
    }

    return result;
  }

  // ── Queries ───────────────────────────────────────────

  getReady(phase: PluginPhase): ChainCSSPlugin[] {
    const activeByName = new Map(
      this.getActive().map((d) => [d.plugin.name, d]),
    );
    return this.executionOrder
      .map((n) => activeByName.get(n))
      .filter((d): d is PluginDescriptor => !!d)
      .map((d) => d.plugin)
      .filter(
        (p) =>
          p[phase] &&
          (!p.supports?.length ||
            p.supports.some((f) => this.activeFeatures.has(f))),
      );
  }

  getExecutionLog(): PluginExecutionContext[] {
    return this.executionLog.toArray();
  }

  inspect(): PluginInspection[] {
    return Array.from(this.plugins.values()).map((d) => ({
      name: d.plugin.name,
      displayName: d.plugin.meta?.displayName,
      state: d.state,
      stateReason: d.stateReason,
      capabilities: d.capabilities,
      executionTime: d.executionTime,
      executionCount: d.executionCount,
      failureCount: d.failureCount,
      phaseTimes: { ...d.phaseTimes },
      errors: d.errors.map((e) => e.message),
    }));
  }

  // ── Capability Validation ─────────────────────────────

  validateCapabilities(): CapabilityIssue[] {
    const issues: CapabilityIssue[] = [];
    const activePluginNames = new Set(
      this.getActive().map((d) => d.plugin.name),
    );

    for (const desc of this.getActive()) {
      const plugin = desc.plugin;
      if (!plugin.consumes) continue;

      for (const entry of plugin.consumes) {
        const c = typeof entry === "string" ? entry : entry.capability;
        const req = typeof entry === "string" ? false : entry.required === true;
        const ver = typeof entry === "string" ? undefined : entry.version;
        const available = (this.capabilityProviders.get(c) || []).filter((p) =>
          activePluginNames.has(p.plugin),
        );

        if (available.length === 0) {
          issues.push({
            plugin: plugin.name,
            capability: c,
            severity: req ? "error" : "warning",
            message: req
              ? `Plugin "${plugin.name}" requires "${c}" but no active plugin provides it.`
              : `Plugin "${plugin.name}" consumes "${c}" but no active plugin provides it.`,
          });
        } else if (ver) {
          const match = available.find((p) => semver.satisfies(p.version, ver));
          if (!match) {
            issues.push({
              plugin: plugin.name,
              capability: c,
              severity: req ? "error" : "warning",
              message: `Plugin "${plugin.name}" requires "${c}@${ver}" but providers are: ${available.map((p) => `v${p.version}`).join(", ")}.`,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Incremental capability validation — run when a capability provider is
   * added or removed at runtime (hot-load). Only checks plugins that consume
   * the changed capability.
   */
  async validateCapabilityIncremental(
    capability: string,
  ): Promise<CapabilityIssue[]> {
    const issues: CapabilityIssue[] = [];
    const activePluginNames = new Set(
      this.getActive().map((d) => d.plugin.name),
    );

    for (const desc of this.getActive()) {
      const plugin = desc.plugin;
      if (!plugin.consumes) continue;

      for (const entry of plugin.consumes) {
        const c = typeof entry === "string" ? entry : entry.capability;
        if (c !== capability) continue;

        const req = typeof entry === "string" ? false : entry.required === true;
        const ver = typeof entry === "string" ? undefined : entry.version;
        const available = (this.capabilityProviders.get(c) || []).filter((p) =>
          activePluginNames.has(p.plugin),
        );

        if (available.length === 0) {
          issues.push({
            plugin: plugin.name,
            capability: c,
            severity: req ? "error" : "warning",
            message: req
              ? `Plugin "${plugin.name}" requires "${c}" but no active plugin provides it.`
              : `Plugin "${plugin.name}" consumes "${c}" but no active plugin provides it.`,
          });
        } else if (ver) {
          const match = available.find((p) => semver.satisfies(p.version, ver));
          if (!match) {
            issues.push({
              plugin: plugin.name,
              capability: c,
              severity: req ? "error" : "warning",
              message: `Plugin "${plugin.name}" requires "${c}@${ver}" but providers are: ${available.map((p) => `v${p.version}`).join(", ")}.`,
            });
          }
        }
      }
    }

    return issues;
  }

  // ── Removal ───────────────────────────────────────────

  async remove(name: string): Promise<void> {
    for (const [, desc] of this.plugins) {
      if (desc.plugin.dependencies?.includes(name)) {
        throw new Error(
          `Cannot remove "${name}": plugin "${desc.plugin.name}" depends on it.`,
        );
      }
    }

    for (const [, desc] of this.plugins) {
      if (
        desc.plugin.optionalDependencies?.includes(name) &&
        desc.state !== PluginState.Removed
      ) {
        this.setState(
          desc,
          PluginState.Degraded,
          `Optional dependency "${name}" removed.`,
        );
      }
    }

    this.pending = this.pending.filter((p) => p.name !== name);
    const desc = this.plugins.get(name);
    if (!desc) return;

    this.setState(desc, PluginState.Removed);
    if (desc.plugin.teardown) await desc.plugin.teardown();
    this.removeCapabilities(name);
    this.plugins.delete(name);
    this.rebuildExecutionOrder();
  }

  // ── Accessors ─────────────────────────────────────────

  get(name: string): ChainCSSPlugin | undefined {
    return this.plugins.get(name)?.plugin;
  }
  getDescriptor(name: string): PluginDescriptor | undefined {
    return this.plugins.get(name);
  }
  getState(name: string): PluginState | undefined {
    return this.plugins.get(name)?.state;
  }
  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  getActive(): PluginDescriptor[] {
    return Array.from(this.plugins.values()).filter(
      (d) =>
        d.state === PluginState.Initialized ||
        d.state === PluginState.Active ||
        d.state === PluginState.Degraded,
    );
  }

  getActivePlugins(): ChainCSSPlugin[] {
    return this.getActive().map((d) => d.plugin);
  }

  getFailed(): PluginDescriptor[] {
    return Array.from(this.plugins.values()).filter(
      (d) => d.state === PluginState.Failed,
    );
  }

  getFailedPlugins(): ChainCSSPlugin[] {
    return this.getFailed().map((d) => d.plugin);
  }
  getAll(): PluginDescriptor[] {
    return Array.from(this.plugins.values());
  }
  getAllPlugins(): ChainCSSPlugin[] {
    return this.getAll().map((d) => d.plugin);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function addEdge(
  from: string,
  to: string,
  dependents: Map<string, Set<string>>,
  inDegree: Map<string, number>,
): void {
  const deps = dependents.get(from)!;
  if (!deps.has(to)) {
    deps.add(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
  }
}

export function createPluginRegistry(
  services: PluginServices,
  setup: PluginSetupContext,
): PluginRegistry {
  return new PluginRegistry(services, setup);
}
