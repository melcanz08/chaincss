// ============================================================================
// FILE: src/core/usecases/compiler.ts
// ChainCSS - Core Compiler Engine
// ============================================================================

import chalk from "chalk";
import path from "path";
import crypto from "crypto";
import { DEFAULT_CONFIG, PERFORMANCE } from "@shared/constants/index.js";
import { writeFile, getBaseName } from "@shared/utils/index.js";
import type {
  ChainCSSConfig,
  CompileResult,
  StyleDefinition,
} from "@shared/types/index.js";
import { ChainCSSPrefixer } from "@compiler/prefixer.js";
import { Pipeline, createDefaultPipeline } from "@compiler/pipeline/index.js";
import { setBreakpoints } from "@compiler/breakpoints.js";
import { ModuleLoader } from "@compiler/services/module-loader.js";
import { CacheStore } from "@compiler/services/cache-store.js";
import { CacheManager } from "@compiler/cache/cache-manager.js";
import { PersistentCache } from "@compiler/cache/content-addressable-cache.js";
import { ManifestWriter } from "@compiler/services/manifest-writer.js";
import { CompilerEvents } from "@compiler/services/compiler-events.js";
import type { CompilerEvent } from "@compiler/services/compiler-events.js";
import {
  createCompilerState,
  updateState,
  markChangedRules,
  getStateStats,
  type CompilerState,
} from "@compiler/pipeline/persistent-compiler.js";
import { findAffectedNodes } from "@compiler/incremental/graph-builder.js";
import { createStyleCompilation } from "./style-compilation.js";
import { createComponentCompiler } from "./component-compiler.js";
import { StatsTracker } from "./stats.js";
import { tokens as designTokens } from "@compiler/tokens/tokens.js";

function ensureIterable<T>(
  target: T | T[] | Record<string, T> | undefined,
): T[] {
  if (!target) return [];
  if (Array.isArray(target)) return target;
  if (typeof target === "object") return Object.values(target) as T[];
  return [];
}

// Fix #6: deepMerge with explicit null/array handling
function deepMerge(base: any, overrides: any): any {
  const result = { ...base };
  for (const key of Object.keys(overrides || {})) {
    const ov = overrides[key];
    const bv = result[key];
    if (
      ov !== null &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      bv !== null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      result[key] = deepMerge(bv, ov);
    } else {
      result[key] = ov;
    }
  }
  return result;
}

// Fix #1: Stable key-sorted JSON serialization
function stableStringify(obj: any): string {
  const sortDeep = (value: any): any => {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === "object") {
      const sorted: Record<string, any> = {};
      for (const k of Object.keys(value).sort()) {
        sorted[k] = sortDeep(value[k]);
      }
      return sorted;
    }
    return value;
  };
  return JSON.stringify(sortDeep(obj));
}

export class ChainCSSCompiler {
  private config: Required<ChainCSSConfig>;
  private prefixer: ChainCSSPrefixer | null = null;
  private pipeline: Pipeline;
  private loader: ModuleLoader;
  private cache: CacheStore<CompileResult>;
  private persistentCache: CacheManager | null = null;
  private stateCache: PersistentCache | null = null;
  private manifestWriter: ManifestWriter;
  private eventHandlers: Array<(event: CompilerEvent) => void> = [];
  public readonly events = new CompilerEvents();
  private compileInProgress = false;
  private compileQueue: Array<() => Promise<void>> = [];
  private persistentMode = true;
  private compilerState: CompilerState | null = null;
  private aggregatedStats = {
    totalStyles: 0,
    atomicStyles: 0,
    deadRulesEliminated: 0,
    pipelinePasses: 0,
    filesProcessed: 0,
  };
  private styleCompiler!: ReturnType<typeof createStyleCompilation>;
  private componentCompiler!: ReturnType<typeof createComponentCompiler>;
  private cssChunks: string[] = [];
  private combinedCache: string | null = null;
  private _hasStyles = false;
  private initPromise: Promise<void> | null = null;
  private statsTracker = new StatsTracker();

  constructor(config: ChainCSSConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      output: { ...DEFAULT_CONFIG.output, ...(config as any).output },
      atomic: { ...DEFAULT_CONFIG.atomic, ...(config as any).atomic },
      prefixer: { ...DEFAULT_CONFIG.prefixer, ...(config as any).prefixer },
      tokens: deepMerge(DEFAULT_CONFIG.tokens, (config as any).tokens || {}),
      theme: (config as any).theme || 'light',
    } as Required<ChainCSSConfig>;

    if (this.config.breakpoints) setBreakpoints(this.config.breakpoints);
    if (this.config.prefixer?.enabled)
      this.prefixer = new ChainCSSPrefixer(this.config.prefixer);

    this.loader = new ModuleLoader();
    this.cache = new CacheStore<CompileResult>(
      PERFORMANCE.CACHE_MAX_ENTRIES || 500,
    );

    try {
      this.persistentCache = new CacheManager(
        ".chaincss-cache/compiler-cache.json",
        {
          maxAge: 7 * 24 * 60 * 60 * 1000,
          maxSize: 100 * 1024 * 1024,
          autoSave: true,
        },
      );
      this.stateCache = new PersistentCache({
        cacheDir: ".chaincss-cache/persistent",
        maxAgeDays: 7,
      });
    } catch {
      this.persistentCache = null;
      this.stateCache = null;
    }
    this.manifestWriter = new ManifestWriter();
    this.pipeline = createDefaultPipeline({
      contexts: {
        optimization: {
          minify: this.config.output.minify,
          atomic: this.config.atomic.enabled,
        },
        lowering: {
          tokenContract: this.config.tokens?.tokens || designTokens,
        },
      },
    });
    const ctx = {
      config: this.config,
      pipeline: this.pipeline,
      prefixer: this.prefixer,
      cache: this.cache,
      persistentCache: this.persistentCache,
      stateCache: this.stateCache,
      emit: (e: CompilerEvent) => this.emit(e),
    };
    this.styleCompiler = createStyleCompilation(ctx as any);
    this.componentCompiler = createComponentCompiler({
      config: this.config,
      loader: this.loader,
      prefixer: this.prefixer,
      manifestWriter: this.manifestWriter,
      compileStyle: (id, def) => this.compileStyle(id, def),
      computeStats: () => this.computeStats(),
      getAggregatedStats: () => this.getAggregatedStats(),
      emit: (e) => this.emit(e),
      statsTracker: this.statsTracker,
    });

    this.registerCustomExtensions();
  }

  private registerCustomExtensions() {
    const cfg = this.config as any;
    const promises: Promise<any>[] = [];

    // Fix #5: Single import for shorthands module
    const hasShorthands = cfg.shorthands && Object.keys(cfg.shorthands).length;
    const hasMacros = cfg.macros && Object.keys(cfg.macros).length;

    if (hasShorthands || hasMacros) {
      promises.push(
        import("@compiler/utils/shorthands.js").then((m) => {
          if (hasShorthands) {
            (m as any).registerCustomShorthands?.(
              cfg.shorthands,
              !!cfg.allowOverride,
            );
            // Register known properties for intent detection
            return Promise.all([
              import("@compiler/pipeline/normalizers/intent-data.js").then((d) =>
                (d as any).registerCustomKnownProperties?.(Object.keys(cfg.shorthands)),
              ),
              import("@compiler/pipeline/normalizers/intent-detector.js").then(
                (det) =>
                  (det as any).registerCustomIntentKeys?.(Object.keys(cfg.shorthands)),
              ),
            ]).then(() => {
              if (hasMacros) {
                return (m as any).registerCustomMacros?.(cfg.macros, !!cfg.allowOverride);
              }
            });
          }
          if (hasMacros) {
            return (m as any).registerCustomMacros?.(cfg.macros, !!cfg.allowOverride);
          }
        }),
      );
    }

    // Register semantic intents (new format with resolve() functions)
    if (cfg.intents && Object.keys(cfg.intents).length) {
      promises.push(
        import("@compiler/pipeline/lowering/intent-resolver.js").then((r) =>
          (r as any).registerSemanticIntentsFromConfig?.(cfg.intents),
        ),
      );
    }

    // Fix #3: Let initPromise reject on failure — don't swallow
    this.initPromise = Promise.all(promises)
      .then(() => {})
      .catch((err) => {
        this.emit({
          type: "error",
          code: "EXTENSION_REGISTRATION_FAILED",
          message: "Failed to register custom extensions dynamically",
          originalError: err,
        } as any);
        throw err; // Re-throw so ready() rejects
      });
  }

  public async ready(): Promise<this> {
    if (this.initPromise) await this.initPromise;
    return this;
  }

  public onEvent(h: (event: CompilerEvent) => void) {
    this.eventHandlers.push(h);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((x) => x !== h);
    };
  }

  private emit(e: CompilerEvent) {
    try { (this.events as any).emit(e); } catch {}
    for (const h of this.eventHandlers) {
      try { h(e); } catch {}
    }
    if (e.type === "warning" && !this.config.silent)
      console.warn(chalk.yellow(`[ChainCSS] ${e.code}: ${e.message}`));
    if (e.type === "error" && !this.config.silent)
      console.error(chalk.red(`[ChainCSS] ${e.code}: ${e.message}`));
  }

  public compileStyle(id: string, def: StyleDefinition): CompileResult {
    const selectors = (def as any).selectors?.length
      ? (def as any).selectors
      : [`.${id}`];

    const styleDef = { ...(def as any), selectors };
    
    // Pass this.pipeline explicitly
    const result = this.styleCompiler.compileViaPipeline(id, styleDef, this.pipeline);
    
    this.trackCSS(result.css);
    this.trackStats(result.stats as any);
    return result;
  }

  public compileRecipe(id: string, val: any): CompileResult {
    try {
      const g = val.getAllVariants;
      if (typeof g === "function") {
        let css = "";
        const map: Record<string, string> = {};
        for (const v of g()) {
          const k = Object.entries(v).map(([a, b]) => `${a}-${b}`).join("_");
          const sd = val(v);
          if (sd?.selectors) {
            const r = this.compileStyle(`${id}_${k}`, sd);
            css += r.css;
            Object.assign(map, r.classMap);
          }
        }
        return { css, classMap: map, atomicClasses: [], stats: this.computeStats() } as any;
      }
    } catch (e) {
      this.emit({ type: "error", code: "RECIPE_COMPILE_FAILED", message: `recipe ${id} failed`, sourceFile: id, originalError: e } as any);
    }
    return { css: "", classMap: {}, atomicClasses: [], stats: this.computeStats() } as any;
  }

  public async compileComponents(components: string[]) {
    await this.ready();
    return new Promise<void>((resolve, reject) => {
      this.compileQueue.push(async () => {
        try {
          this.aggregatedStats = { totalStyles: 0, atomicStyles: 0, deadRulesEliminated: 0, pipelinePasses: 0, filesProcessed: 0 };
          await this.componentCompiler.compileAll(components);
          resolve();
        } catch (err) { reject(err as Error); }
      });
      this.runQueue();
    });
  }

  private async runQueue() {
    if (this.compileInProgress) return;
    this.compileInProgress = true;
    while (this.compileQueue.length) {
      const job = this.compileQueue.shift()!;
      await job();
    }
    this.compileInProgress = false;
  }

  public async compileFile(filePath: string, useIncremental = false): Promise<Record<string, CompileResult>> {
    await this.ready();

    if (useIncremental && this.persistentMode && this.compilerState) {
      return this.compileFileIncremental(filePath);
    }

    const ex = await this.loader.import(filePath);
    const out: Record<string, CompileResult> = {};
    for (const [n, v] of Object.entries(ex || {})) {
      if (!v || typeof v !== "object") continue;
      const value = { ...v };
      if (value._nestedRules) value._nestedRules = ensureIterable(value._nestedRules);
      if (value._atRules) value._atRules = ensureIterable(value._atRules);

      if (typeof v === "function" && (v as any).variants) {
        out[n] = this.compileRecipe(n, v);
      } else if ((v as any)?.selectors) {
        out[n] = this.compileStyle(n, v as any);
      }
    }

    if (this.persistentMode && Object.keys(out).length > 0) {
      const firstResult = Object.values(out)[0];
      const inspector = (firstResult as any)?.inspector;
      if (inspector?.ir) {
        if (!this.compilerState) {
          this.compilerState = createCompilerState(inspector.ir);
        } else {
          updateState(this.compilerState, inspector.ir, [filePath]);
        }
      }
    }

    return out;
  }

  private hashStyleDefinition(def: any): string {
    // Fix #1: Constant hash for non-objects, stable key-sorted JSON for objects
    if (!def || typeof def !== "object") return "empty";

    const relevant: any = {};
    if (def.selectors) relevant.selectors = def.selectors;

    const props: Record<string, any> = {};
    for (const [key, value] of Object.entries(def)) {
      if (key.startsWith("_") || key === "selectors" || key === "nestedRules" || key === "atRules" || typeof value === "function") continue;
      props[key] = value;
    }
    if (Object.keys(props).length > 0) relevant.properties = props;

    if (def._nestedRules || def.nestedRules) {
      const nested = def._nestedRules || def.nestedRules;
      relevant.nestedRules = nested.map((r: any) => ({ selector: r.selector, styles: r.styles }));
    }

    if (def._atRules || def.atRules) {
      const atRules = def._atRules || def.atRules;
      relevant.atRules = atRules.map((r: any) => ({ type: r.type, query: r.query, name: r.name, styles: r.styles }));
    }

    return crypto.createHash("md5").update(stableStringify(relevant)).digest("hex");
  }

  private async compileFileIncremental(filePath: string): Promise<Record<string, CompileResult>> {
    const ex = await this.loader.import(filePath);
    const out: Record<string, CompileResult> = {};

    const previousHashes = this.compilerState?.fileExportHashes?.[filePath] ?? {};
    const previousResults = this.compilerState?.cachedResults?.[filePath] ?? {};

    const newHashes: Record<string, string> = {};
    const changedRuleIds: string[] = [];
    let anyRecompiled = false;
    let skippedCount = 0;

    for (const [name, exported] of Object.entries(ex || {})) {
      if (!exported || typeof exported !== "object") continue;

      const value = { ...exported };
      if (value._nestedRules) value._nestedRules = ensureIterable(value._nestedRules);
      if (value._atRules) value._atRules = ensureIterable(value._atRules);

      if (typeof exported === "function" && (exported as any).variants) {
        out[name] = this.compileRecipe(name, exported);
        // Fix #2: Hash recipe by source string, not randomUUID
        newHashes[name] = crypto.createHash("md5").update((exported as any).toString()).digest("hex");
        anyRecompiled = true;
        continue;
      }

      if ((exported as any)?.selectors) {
        const defHash = this.hashStyleDefinition(exported as any);
        newHashes[name] = defHash;

        if (defHash === previousHashes[name] && previousResults[name]) {
          out[name] = previousResults[name];
          skippedCount++;
        } else {
          const result = this.compileStyle(name, exported as any);
          out[name] = result;
          anyRecompiled = true;

          const inspector = (result as any)?.inspector;
          if (inspector?.ir?.rules) {
            for (const rule of inspector.ir.rules) changedRuleIds.push(rule.id);
          }
        }
      }
    }

    if (this.compilerState) {
      if (!this.compilerState.fileExportHashes) (this.compilerState as any).fileExportHashes = {};
      this.compilerState.fileExportHashes[filePath] = newHashes;

      if (!this.compilerState.cachedResults) (this.compilerState as any).cachedResults = {};
      this.compilerState.cachedResults[filePath] = out;

      if (changedRuleIds.length > 0) markChangedRules(this.compilerState, changedRuleIds);

      if (anyRecompiled) {
        const recompiledResult = Object.values(out).find((r: any) => r?.inspector?.ir) as any;
        if (recompiledResult?.inspector?.ir) {
          updateState(this.compilerState, recompiledResult.inspector.ir, [filePath]);
        }
      }
    }

    if ((this.config as any).verbose && skippedCount > 0) {
      const total = Object.keys(out).length;
      console.log(chalk.dim(`  ⚡ Incremental: ${skippedCount}/${total} exports skipped (${total - skippedCount} recompiled)`));
    }

    return out;
  }

  public getIncrementalImpact(filePath: string) {
    if (!this.compilerState?.ir?.graph) return null;
    const graph = this.compilerState.ir.graph;
    const totalRules = this.compilerState.ir.rules.length;
    const fileRules = this.compilerState.ir.rules.filter((r) => r.source?.file === filePath);

    if (fileRules.length === 0) {
      return { changedFiles: [filePath], affectedRules: 0, totalRules, affectedPercent: 0, shouldIncremental: false };
    }

    const allAffected = new Set<string>();
    for (const rule of fileRules) {
      allAffected.add(rule.id);
      for (const id of findAffectedNodes(graph, rule.id)) allAffected.add(id);
    }

    const affectedCount = allAffected.size;
    return {
      changedFiles: [filePath],
      affectedRules: affectedCount,
      totalRules,
      affectedPercent: totalRules > 0 ? Math.round((affectedCount / totalRules) * 100) : 0,
      shouldIncremental: affectedCount > 0 && affectedCount <= totalRules * 0.5,
    };
  }

  public async compile(inputFile: string, outDir: string) {
    const r = await this.compileFile(inputFile);
    let css = "";
    for (const v of Object.values(r)) css += v.css;
    writeFile(path.join(outDir, `${getBaseName(inputFile)}.css`), css);
    return { results: r };
  }

  public setPipeline(p: Pipeline) {
    this.pipeline = p;
    // Update the styleCompiler's captured pipeline reference
    if (this.styleCompiler && (this.styleCompiler as any).ctx) {
      (this.styleCompiler as any).ctx.pipeline = p;
    }
    return this;
  }
  public getPipeline() { return this.pipeline; }
  public getDiagnostics() { return this.pipeline.getLastResult?.()?.ir?.diagnostics || []; }

  public setPersistentMode(enabled: boolean): this {
    this.persistentMode = enabled;
    if (!enabled) this.compilerState = null;
    return this;
  }
  public isPersistentMode(): boolean { return this.persistentMode; }
  public getCompilerState(): CompilerState | null { return this.compilerState; }
  public setCompilerState(state: CompilerState): void { this.compilerState = state; }
  public getCompilerStats() { return this.compilerState ? getStateStats(this.compilerState) : null; }

  // Fix #7: Pass result directly instead of reading getLastResult()
  private computeStats(result?: any) {
    const rules = result?.ir?.rules || this.pipeline.getLastResult?.()?.ir?.rules || [];
    const total = rules.length;
    const alive = rules.filter((r: any) => !r.isDead).length;
    const atomic = rules.filter((r: any) => r.passMeta?.optimization?.atomic?.isAtomic === true || r.meta?.atomic === true).length;
    return {
      totalStyles: total,
      atomicStyles: atomic,
      uniqueProperties: 0,
      savings: total - alive ? `${total - alive} rules eliminated` : "0%",
      deadRulesEliminated: total - alive,
      pipelinePasses: result?.timeline?.length || 0,
    };
  }

  public getStats() { return this.computeStats(); }
  private trackStats(s: ReturnType<typeof this.computeStats>) {
    this.aggregatedStats.totalStyles += s.totalStyles;
    this.aggregatedStats.atomicStyles += s.atomicStyles;
    this.aggregatedStats.deadRulesEliminated += s.deadRulesEliminated;
    this.aggregatedStats.pipelinePasses = Math.max(this.aggregatedStats.pipelinePasses, s.pipelinePasses);
    this.aggregatedStats.filesProcessed++;
  }

  public getAggregatedStats() {
    return {
      totalStyles: this.aggregatedStats.totalStyles,
      atomicStyles: this.aggregatedStats.atomicStyles,
      uniqueProperties: 0,
      savings: this.aggregatedStats.deadRulesEliminated ? `${this.aggregatedStats.deadRulesEliminated} rules eliminated` : "0%",
      deadRulesEliminated: this.aggregatedStats.deadRulesEliminated,
      pipelinePasses: this.aggregatedStats.pipelinePasses,
      filesProcessed: this.aggregatedStats.filesProcessed,
    };
  }

  public async compileVirtualSource(source: string, virtualPath: string): Promise<Record<string, CompileResult>> {
    await this.ready();

    if (this.stateCache) {
      const sourceHash = crypto.createHash("sha256").update(source).digest("hex");
      const cached = await this.stateCache.getByHash(sourceHash);
      if (cached?.result) return cached.result;
    }

    const ex = await this.loader.importSource(source, virtualPath);
    const out: Record<string, CompileResult> = {};
    const changedRuleIds: string[] = [];

    for (const [n, v] of Object.entries(ex || {})) {
      if (!v || typeof v !== "object") continue;
      const value = { ...v };
      if (value._nestedRules) value._nestedRules = ensureIterable(value._nestedRules);
      if (value._atRules) value._atRules = ensureIterable(value._atRules);

      if (typeof v === "function" && (v as any).variants) {
        out[n] = this.compileRecipe(n, v);
      } else if ((v as any)?.selectors) {
        const result = this.compileStyle(n, v as any);
        out[n] = result;
        const inspector = (result as any)?.inspector;
        if (inspector?.ir?.rules) {
          for (const rule of inspector.ir.rules) changedRuleIds.push(rule.id);
        }
      }
    }

    if (this.persistentMode && changedRuleIds.length > 0 && this.compilerState) {
      markChangedRules(this.compilerState, changedRuleIds);
    }

    if (this.persistentMode && Object.keys(out).length > 0) {
      const firstResult = Object.values(out)[0];
      const inspector = (firstResult as any)?.inspector;
      if (inspector?.ir) {
        if (!this.compilerState) {
          this.compilerState = createCompilerState(inspector.ir);
        } else {
          updateState(this.compilerState, inspector.ir, [virtualPath]);
        }
      }
    }

    if (this.stateCache) {
      const sourceHash = crypto.createHash("sha256").update(source).digest("hex");
      await this.stateCache.setByHash(sourceHash, out);
    }

    return out;
  }

  public getPersistentCache(): CacheManager | null { return this.persistentCache; }
  public getStateCache(): PersistentCache | null { return this.stateCache; }

  public getCombinedCSS() {
    if (this.combinedCache === null) this.combinedCache = this.cssChunks.join("\n");
    return this.combinedCache;
  }
  public hasStyles() { return this._hasStyles; }

  // Fix #4: clearCSS only clears output, not incremental state
  public clearCSS() {
    this.cssChunks = [];
    this.combinedCache = null;
    this._hasStyles = false;
    this.cache.clear(); // Only in-memory result cache
  }

  public clearCaches() {
    try { this.persistentCache?.clear?.(); } catch {}
    try { this.stateCache?.clear?.(); } catch {}
  }

  private trackCSS(c: string) {
    if (c?.trim()) {
      this.cssChunks.push(c);
      this.combinedCache = null;
      this._hasStyles = true;
    }
  }
}

export async function compileChainCSS(input: string, out: string, cfg?: ChainCSSConfig) {
  return new ChainCSSCompiler(cfg || {}).compile(input, out);
}