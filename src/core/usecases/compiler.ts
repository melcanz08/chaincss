// ============================================================================
// FILE: src/core/usecases/compiler.ts
// ChainCSS - Core Compiler Engine
// ============================================================================

import chalk from 'chalk'
import path from 'path'
import crypto from 'crypto'
import { DEFAULT_CONFIG, PERFORMANCE } from '@shared/constants/index.js'
import { writeFile, getBaseName } from '@shared/utils/index.js'
import type { ChainCSSConfig, CompileResult, StyleDefinition } from '@shared/types/index.js'
import { ChainCSSPrefixer } from '@compiler/prefixer.js'
import { Pipeline, createDefaultPipeline } from '@compiler/pipeline/index.js'
import { setBreakpoints } from '@compiler/breakpoints.js'
import { ModuleLoader } from '@compiler/services/module-loader.js'
import { CacheStore } from '@compiler/services/cache-store.js'
import { CacheManager } from '@compiler/cache/cache-manager.js'
import { PersistentCache } from '@compiler/cache/content-addressable-cache.js'
import { ManifestWriter } from '@compiler/services/manifest-writer.js'
import { CompilerEvents } from '@compiler/services/compiler-events.js'
import type { CompilerEvent } from '@compiler/services/compiler-events.js'
import {
  createCompilerState,
  updateState,
  markChangedRules,
  getStateStats,
  type CompilerState,
} from '@compiler/pipeline/persistent-compiler.js'
import { findAffectedNodes } from '@compiler/pipeline/ir/graph-builder.js'
import { createStyleCompilation } from './style-compilation.js'
import { createComponentCompiler } from './component-compiler.js'
import { StatsTracker } from './stats.js'

function ensureIterable<T>(target: T | T[] | Record<string, T> | undefined): T[] {
  if (!target) return [];
  if (Array.isArray(target)) return target;
  if (typeof target === 'object') return Object.values(target) as T[];
  return [];
}

function deepMerge(base: any, overrides: any): any {
  const result = { ...base }
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      typeof result[key] === 'object'
    ) {
      result[key] = deepMerge(result[key], overrides[key])
    } else {
      result[key] = overrides[key]
    }
  }
  return result
}

export class ChainCSSCompiler {
  private config: Required<ChainCSSConfig>
  private prefixer: ChainCSSPrefixer | null = null
  private pipeline: Pipeline
  private pipelineEnabled: boolean
  private loader: ModuleLoader
  private cache: CacheStore<CompileResult>
  private persistentCache: CacheManager | null = null
  private stateCache: PersistentCache | null = null
  private manifestWriter: ManifestWriter
  private eventHandlers: Array<(event: CompilerEvent) => void> = []
  public readonly events = new CompilerEvents()
  private compileInProgress = false
  private compileQueue: Array<() => Promise<void>> = []
  private persistentMode = true
  private compilerState: CompilerState | null = null
  private aggregatedStats = {
    totalStyles: 0,
    atomicStyles: 0,
    deadRulesEliminated: 0,
    pipelinePasses: 0,
    filesProcessed: 0,
  }
  private styleCompiler!: ReturnType<typeof createStyleCompilation>
  private componentCompiler!: ReturnType<typeof createComponentCompiler>
  private cssChunks: string[] = []
  private combinedCache: string | null = null
  private _hasStyles = false
  private initPromise: Promise<void> | null = null
  private statsTracker = new StatsTracker()
  constructor(config: ChainCSSConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      output: { ...DEFAULT_CONFIG.output, ...(config as any).output },
      atomic: { ...DEFAULT_CONFIG.atomic, ...(config as any).atomic },
      prefixer: { ...DEFAULT_CONFIG.prefixer, ...(config as any).prefixer },
      tokens: deepMerge(DEFAULT_CONFIG.tokens, (config as any).tokens || {}),
    } as Required<ChainCSSConfig>

    if (this.config.breakpoints) setBreakpoints(this.config.breakpoints)
    if (this.config.prefixer?.enabled) this.prefixer = new ChainCSSPrefixer(this.config.prefixer)

    this.loader = new ModuleLoader()
    this.cache = new CacheStore<CompileResult>(PERFORMANCE.CACHE_MAX_ENTRIES || 500)

    // Two separate caches for different purposes:
    // - persistentCache: style compilation result cache (key-value by style ID + hash)
    // - stateCache: persistent compiler state (content-addressable by hash)
    try {
      this.persistentCache = new CacheManager('.chaincss-cache/compiler-cache.json', {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        maxSize: 100 * 1024 * 1024,
        autoSave: true,
      })
      this.stateCache = new PersistentCache({
        cacheDir: '.chaincss-cache/persistent',
        maxAgeDays: 7,
      })
    } catch {
      this.persistentCache = null
      this.stateCache = null
    }
    this.manifestWriter = new ManifestWriter()
    this.pipelineEnabled = (config as any).experimental?.enablePipeline !== false
    this.pipeline = createDefaultPipeline({
      contexts: {
        optimization: {
          minify: this.config.output.minify,
          atomic: this.config.atomic.enabled,
        },
      },
    })
    const ctx = {
      config: this.config,
      pipeline: this.pipeline,
      prefixer: this.prefixer,
      cache: this.cache,
      persistentCache: this.persistentCache,
      stateCache: this.stateCache,
      emit: (e: CompilerEvent) => this.emit(e),
    }
    this.styleCompiler = createStyleCompilation(ctx as any)
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
    })

    this.registerCustomExtensions()
  }

  private registerCustomExtensions() {
    const cfg = this.config as any
    const promises: Promise<any>[] = []

    if (cfg.shorthands && Object.keys(cfg.shorthands).length) {
      promises.push(
        import('@compiler/utils/shorthands.js').then((m) => {
          ;(m as any).registerCustomShorthands?.(cfg.shorthands, !!cfg.allowOverride)
          return Promise.all([
            import('@compiler/pipeline/normalizers/intent-data.js').then((d) =>
              (d as any).registerCustomKnownProperties?.(Object.keys(cfg.shorthands)),
            ),
            import('@compiler/pipeline/normalizers/intent-detector.js').then((det) =>
              (det as any).registerCustomIntentKeys?.(Object.keys(cfg.shorthands)),
            ),
          ])
        }),
      )
    }
    if (cfg.macros && Object.keys(cfg.macros).length) {
      promises.push(
        import('@compiler/utils/shorthands.js').then((m) =>
          (m as any).registerCustomMacros?.(cfg.macros, !!cfg.allowOverride),
        ),
      )
    }
    if (cfg.intents && Object.keys(cfg.intents).length) {
      promises.push(
        import('@compiler/pipeline/lowering/intent-resolver.js').then((r) =>
          (r as any).registerIntents?.(cfg.intents, !!cfg.allowOverride),
        ),
      )
    }

    this.initPromise = Promise.all(promises)
      .then(() => {})
      .catch((err) => {
        this.emit({
          type: 'error',
          code: 'EXTENSION_REGISTRATION_FAILED',
          message: 'Failed to register custom extensions dynamically',
          originalError: err,
        } as any)
      })
  }

  public async ready(): Promise<this> {
    if (this.initPromise) await this.initPromise
    return this
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  public onEvent(h: (event: CompilerEvent) => void) {
    this.eventHandlers.push(h)
    return () => {
      this.eventHandlers = this.eventHandlers.filter((x) => x !== h)
    }
  }

  private emit(e: CompilerEvent) {
    try {
      ;(this.events as any).emit(e)
    } catch {}
    for (const h of this.eventHandlers) {
      try {
        h(e)
      } catch {}
    }
    if (e.type === 'warning' && !this.config.silent)
      console.warn(chalk.yellow(`[ChainCSS] ${e.code}: ${e.message}`))
    if (e.type === 'error' && !this.config.silent)
      console.error(chalk.red(`[ChainCSS] ${e.code}: ${e.message}`))
  }

  // ==========================================================================
  // Style Compilation
  // ==========================================================================

  public compileStyle(id: string, def: StyleDefinition): CompileResult {
    const selectors = (def as any).selectors?.length ? (def as any).selectors : [`.${id}`]
    const nestedRules = ensureIterable((def as any)._nestedRules)
    const atRules = ensureIterable((def as any)._atRules)
    const { _nestedRules, _atRules, selectors: _sel, ...baseProps } = def as any
    const baseDef = { ...baseProps, selectors }

    const baseResult = this.pipelineEnabled
      ? this.styleCompiler.compileViaPipeline(id, baseDef)
      : this.styleCompiler.compileDirect(id, baseDef)

    let css = baseResult.css
    let classMap = (baseResult as any).classMap || {}
    let atomicClasses = (baseResult as any).atomicClasses || []
    let stats = (baseResult as any).stats || {}

    for (const rule of nestedRules) {
      const resolvedSelector = rule.selector.includes('&')
        ? rule.selector.replace(/&/g, selectors[0])
        : `${selectors[0]}${rule.selector.startsWith(':') || rule.selector.startsWith('[') ? '' : ' '}${rule.selector}`

      const nestedDef = { ...rule.styles, selectors: [resolvedSelector] }
      const r = this.pipelineEnabled
        ? this.styleCompiler.compileViaPipeline(`${id}:${rule.selector}`, nestedDef)
        : this.styleCompiler.compileDirect(`${id}:${rule.selector}`, nestedDef)

      css += `\n${r.css}`
      classMap = { ...classMap, ...(r as any).classMap }
      atomicClasses = [...atomicClasses, ...((r as any).atomicClasses || [])]
    }

    for (const at of atRules) {
      const innerDef = { ...at.styles, selectors }
      const r = this.pipelineEnabled
        ? this.styleCompiler.compileViaPipeline(`${id}:${at.type}`, innerDef)
        : this.styleCompiler.compileDirect(`${id}:${at.type}`, innerDef)

      css += `\n@${at.type} ${at.query} { ${r.css} }`
      classMap = { ...classMap, ...(r as any).classMap }
      atomicClasses = [...atomicClasses, ...((r as any).atomicClasses || [])]
    }

    const result = {
      css,
      classMap,
      atomicClasses,
      stats,
      dynamic: (baseResult as any).dynamic,
      inspector: (baseResult as any).inspector,
    } as CompileResult

    this.trackCSS(result.css)
    this.trackStats(result.stats as any)
    return result
  }

  public compileRecipe(id: string, val: any): CompileResult {
    try {
      const g = val.getAllVariants
      if (typeof g === 'function') {
        let css = ''
        const map: Record<string, string> = {}
        for (const v of g()) {
          const k = Object.entries(v)
            .map(([a, b]) => `${a}-${b}`)
            .join('_')
          const sd = val(v)
          if (sd?.selectors) {
            const r = this.compileStyle(`${id}_${k}`, sd)
            css += r.css
            Object.assign(map, r.classMap)
          }
        }
        return { css, classMap: map, atomicClasses: [], stats: this.computeStats() } as any
      }
    } catch (e) {
      this.emit({
        type: 'error',
        code: 'RECIPE_COMPILE_FAILED',
        message: `recipe ${id} failed`,
        sourceFile: id,
        originalError: e,
      } as any)
    }
    return { css: '', classMap: {}, atomicClasses: [], stats: this.computeStats() } as any
  }

  // ==========================================================================
  // Batch Compilation
  // ==========================================================================

  public async compileComponents(components: string[]) {
    await this.ready()
    return new Promise<void>((resolve, reject) => {
      this.compileQueue.push(async () => {
        try {
          this.aggregatedStats = {
            totalStyles: 0,
            atomicStyles: 0,
            deadRulesEliminated: 0,
            pipelinePasses: 0,
            filesProcessed: 0,
          }
          await this.componentCompiler.compileAll(components)
          resolve()
        } catch (err) {
          reject(err as Error)
        }
      })
      this.runQueue()
    })
  }

  private async runQueue() {
    if (this.compileInProgress) return
    this.compileInProgress = true
    while (this.compileQueue.length) {
      const job = this.compileQueue.shift()!
      await job()
    }
    this.compileInProgress = false
  }

  // ==========================================================================
  // File Compilation (Full + Incremental)
  // ==========================================================================

  public async compileFile(filePath: string, useIncremental = false): Promise<Record<string, CompileResult>> {
    await this.ready()

    if (useIncremental && this.persistentMode && this.compilerState) {
      return this.compileFileIncremental(filePath)
    }

    const ex = await this.loader.import(filePath)
    const out: Record<string, CompileResult> = {}
    for (const [n, v] of Object.entries(ex || {})) {
      if (!v || typeof v !== 'object') continue;
      const value = { ...v };
      if (value._nestedRules) {
        value._nestedRules = ensureIterable(value._nestedRules);
      }
      if (value._atRules) {
        value._atRules = ensureIterable(value._atRules);
      }
      
      if (typeof v === 'function' && (v as any).variants) {
        out[n] = this.compileRecipe(n, v)
      } else if ((v as any)?.selectors) {
        out[n] = this.compileStyle(n, v as any)
      }
    }

    if (this.persistentMode && Object.keys(out).length > 0) {
      const firstResult = Object.values(out)[0]
      const inspector = (firstResult as any)?.inspector
      if (inspector?.ir) {
        if (!this.compilerState) {
          this.compilerState = createCompilerState(inspector.ir)
        } else {
          updateState(this.compilerState, inspector.ir, [filePath])
        }
      }
    }

    return out
  }

  private async compileFileIncremental(filePath: string): Promise<Record<string, CompileResult>> {
    const ex = await this.loader.import(filePath)
    const out: Record<string, CompileResult> = {}
    const changedRuleIds: string[] = []

    for (const [n, v] of Object.entries(ex || {})) {
      if (!v || typeof v !== 'object') continue;
      const value = { ...v };
      if (value._nestedRules) {
        value._nestedRules = ensureIterable(value._nestedRules);
      }
      if (value._atRules) {
        value._atRules = ensureIterable(value._atRules);
      }
      
      if (typeof v === 'function' && (v as any).variants) {
        out[n] = this.compileRecipe(n, v)
      } else if ((v as any)?.selectors) {
        out[n] = this.compileStyle(n, v as any)
      }
    }

    if (changedRuleIds.length > 0 && this.compilerState) {
      markChangedRules(this.compilerState, changedRuleIds)
    }

    const firstResult = Object.values(out)[0]
    const inspector = (firstResult as any)?.inspector
    if (inspector?.ir && this.compilerState) {
      updateState(this.compilerState, inspector.ir, [filePath])
    }

    return out
  }

  public getIncrementalImpact(filePath: string): {
    changedFiles: string[]
    affectedRules: number
    totalRules: number
    affectedPercent: number
    shouldIncremental: boolean
  } | null {
    if (!this.compilerState?.ir?.graph) return null

    const graph = this.compilerState.ir.graph
    const totalRules = this.compilerState.ir.rules.length

    const fileRules = this.compilerState.ir.rules.filter(
      r => r.source?.file === filePath
    )

    if (fileRules.length === 0) {
      return {
        changedFiles: [filePath],
        affectedRules: 0,
        totalRules,
        affectedPercent: 0,
        shouldIncremental: false,
      }
    }

    const allAffected = new Set<string>()
    for (const rule of fileRules) {
      allAffected.add(rule.id)
      const affected = findAffectedNodes(graph, rule.id)
      for (const id of affected) allAffected.add(id)
    }

    const affectedCount = allAffected.size

    return {
      changedFiles: [filePath],
      affectedRules: affectedCount,
      totalRules,
      affectedPercent: totalRules > 0 ? Math.round((affectedCount / totalRules) * 100) : 0,
      shouldIncremental: affectedCount > 0 && affectedCount <= totalRules * 0.5,
    }
  }

  public async compile(inputFile: string, outDir: string) {
    const r = await this.compileFile(inputFile)
    let css = ''
    for (const v of Object.values(r)) css += v.css
    writeFile(path.join(outDir, `${getBaseName(inputFile)}.css`), css)
    return { results: r }
  }

  // ==========================================================================
  // Pipeline Control
  // ==========================================================================

  public setPipelineEnabled(v: boolean) {
    this.pipelineEnabled = v
    return this
  }

  public setPipeline(p: Pipeline) {
    this.pipeline = p
    this.pipelineEnabled = true
    return this
  }

  public isPipelineEnabled() {
    return this.pipelineEnabled
  }

  public getPipeline() {
    return this.pipeline
  }

  public getDiagnostics() {
    return this.pipeline.getLastResult?.()?.ir?.diagnostics || []
  }

  // ==========================================================================
  // Persistent Mode
  // ==========================================================================

  public setPersistentMode(enabled: boolean): this {
    this.persistentMode = enabled
    if (!enabled) this.compilerState = null
    return this
  }

  public isPersistentMode(): boolean {
    return this.persistentMode
  }

  public getCompilerState(): CompilerState | null {
    return this.compilerState
  }

  public setCompilerState(state: CompilerState): void {
    this.compilerState = state
  }

  public getCompilerStats() {
    if (!this.compilerState) return null
    return getStateStats(this.compilerState)
  }

  // ==========================================================================
  // Stats
  // ==========================================================================

  private computeStats() {
    const last = this.pipeline.getLastResult?.()
    const rules = last?.ir?.rules || []
    const total = rules.length
    const alive = rules.filter((r: any) => !r.isDead).length
    const atomic = rules.filter((r: any) =>
      r.passMeta?.optimization?.atomic?.isAtomic === true || r.meta?.atomic === true
    ).length
    return {
      totalStyles: total,
      atomicStyles: atomic,
      uniqueProperties: 0,
      savings: total - alive ? `${total - alive} rules eliminated` : '0%',
      deadRulesEliminated: total - alive,
      pipelinePasses: last?.timeline?.length || 0,
    }
  }

  public getStats() {
    return this.computeStats()
  }

  private trackStats(s: ReturnType<typeof this.computeStats>) {
    this.aggregatedStats.totalStyles += s.totalStyles
    this.aggregatedStats.atomicStyles += s.atomicStyles
    this.aggregatedStats.deadRulesEliminated += s.deadRulesEliminated
    this.aggregatedStats.pipelinePasses = Math.max(
      this.aggregatedStats.pipelinePasses,
      s.pipelinePasses,
    )
    this.aggregatedStats.filesProcessed++
  }

  public getAggregatedStats() {
    return {
      totalStyles: this.aggregatedStats.totalStyles,
      atomicStyles: this.aggregatedStats.atomicStyles,
      uniqueProperties: 0,
      savings: this.aggregatedStats.deadRulesEliminated
        ? `${this.aggregatedStats.deadRulesEliminated} rules eliminated`
        : '0%',
      deadRulesEliminated: this.aggregatedStats.deadRulesEliminated,
      pipelinePasses: this.aggregatedStats.pipelinePasses,
      filesProcessed: this.aggregatedStats.filesProcessed,
    }
  }

  // ==========================================================================
  // Virtual Source (Vite HMR)
  // ==========================================================================

  public async compileVirtualSource(source: string, virtualPath: string): Promise<Record<string, CompileResult>> {
    await this.ready()

    // Content-addressable cache lookup via PersistentCache (stateCache)
    if (this.stateCache) {
      const sourceHash = crypto.createHash('md5').update(source).digest('hex')
      const cached = await this.stateCache.getByHash(sourceHash)
      if (cached?.result) {
        return cached.result
      }
    }

    // In-memory compilation via loader
    const ex = await this.loader.importSource(source, virtualPath)
    const out: Record<string, CompileResult> = {}
    const changedRuleIds: string[] = []

    for (const [n, v] of Object.entries(ex || {})) {
      if (!v || typeof v !== 'object') continue;
      
      // Ensure nested rules and at-rules are safely handled
      const value = { ...v };
      if (value._nestedRules) {
        value._nestedRules = ensureIterable(value._nestedRules);
      }
      if (value._atRules) {
        value._atRules = ensureIterable(value._atRules);
      }
      
      if (typeof v === 'function' && (v as any).variants) {
        out[n] = this.compileRecipe(n, v)
      } else if ((v as any)?.selectors) {
        const result = this.compileStyle(n, v as any)
        out[n] = result

        // Collect rule IDs for dirty tracking
        const inspector = (result as any)?.inspector
        if (inspector?.ir?.rules) {
          for (const rule of inspector.ir.rules) {
            changedRuleIds.push(rule.id)
          }
        }
      }
    }

    // INCREMENTAL: Mark changed rules as dirty via graph
    if (this.persistentMode && changedRuleIds.length > 0 && this.compilerState) {
      markChangedRules(this.compilerState, changedRuleIds)
    }

    // Update persistent state
    if (this.persistentMode && Object.keys(out).length > 0) {
      const firstResult = Object.values(out)[0]
      const inspector = (firstResult as any)?.inspector
      if (inspector?.ir) {
        if (!this.compilerState) {
          this.compilerState = createCompilerState(inspector.ir)
        } else {
          updateState(this.compilerState, inspector.ir, [virtualPath])
        }
      }
    }

    // Save to content-addressable cache via PersistentCache (stateCache)
    if (this.stateCache) {
      const sourceHash = crypto.createHash('md5').update(source).digest('hex')
      await this.stateCache.setByHash(sourceHash, out)
    }

    return out
  }

  // ==========================================================================
  // Cache Accessors
  // ==========================================================================

  /** Style compilation result cache (CacheManager — key-value by style ID + hash) */
  public getPersistentCache(): CacheManager | null {
    return this.persistentCache
  }

  /** Compiler state cache (PersistentCache — content-addressable by hash) */
  public getStateCache(): PersistentCache | null {
    return this.stateCache
  }

  // ==========================================================================
  // CSS Accumulation
  // ==========================================================================

  public getCombinedCSS() {
    if (this.combinedCache === null) {
      this.combinedCache = this.cssChunks.join('\n')
    }
    return this.combinedCache
  }

  public hasStyles() {
    return this._hasStyles
  }

  public clearCSS() {
    this.cssChunks = [];
    this.combinedCache = null;
    this._hasStyles = false;
    this.cache.clear();
    try {
      this.persistentCache?.clear?.();
    } catch {}
    try {
      this.stateCache?.clear?.();
    } catch {}
  }

  private trackCSS(c: string) {
    if (c?.trim()) {
      this.cssChunks.push(c)
      this.combinedCache = null
      this._hasStyles = true
    }
  }
}

export async function compileChainCSS(input: string, out: string, cfg?: ChainCSSConfig) {
  return new ChainCSSCompiler(cfg || {}).compile(input, out)
}