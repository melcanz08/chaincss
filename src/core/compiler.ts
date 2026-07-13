// src/core/compiler.ts
// Now only orchestrates: config, events, caches, pipeline instance, delegates to 2 modules

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { DEFAULT_CONFIG, VERSION, PERFORMANCE } from './constants.js'
import { writeFile, getBaseName } from './utils.js'
import type { ChainCSSConfig, CompileResult, StyleDefinition } from './types.js'
import { ChainCSSPrefixer } from '../compiler/prefixer.js'
import { StyleGraphCompiler } from '../compiler/style-graph.js'
import type { GraphCompileOptions } from '../compiler/style-graph.js'
import { Pipeline, createDefaultPipeline } from '../compiler/pipeline/index.js'
import { setBreakpoints } from '../compiler/breakpoints.js'
import { ModuleLoader } from '../compiler/services/module-loader.js'
import { CacheStore } from '../compiler/services/cache-store.js'
import { CacheManager } from '../compiler/cache/cache-manager.js'
import { ManifestWriter } from '../compiler/services/manifest-writer.js'
import { CompilerEvents } from '../compiler/services/compiler-events.js'
import type { CompilerEventHandler, CompilerEvent } from '../compiler/services/compiler-events.js'

// New split modules
import { createStyleCompilation } from './compiler/style-compilation.js'
import { createComponentCompiler } from './compiler/component-compiler.js'

export class ChainCSSCompiler {
  private config: Required<ChainCSSConfig>
  private prefixer: ChainCSSPrefixer | null = null
  private pipeline: Pipeline
  private pipelineEnabled: boolean
  private loader: ModuleLoader
  private cache: CacheStore<CompileResult>
  private persistentCache: CacheManager | null = null
  private manifestWriter: ManifestWriter
  private eventHandlers: CompilerEventHandler[] = []
  public readonly events = new CompilerEvents()
  private compileInProgress = false
  private compileQueue: Array<{ resolve: () => void; reject: (e: Error) => void }> = []
  private aggregatedStats = { totalStyles: 0, atomicStyles: 0, deadRulesEliminated: 0, pipelinePasses: 0, filesProcessed: 0 }


  // Delegates
  private styleCompiler!: ReturnType<typeof createStyleCompilation>
  private componentCompiler!: ReturnType<typeof createComponentCompiler>

  private accumulatedCSS: string = ''
  private _hasStyles = false

  constructor(config: ChainCSSConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config, output: { ...DEFAULT_CONFIG.output, ...(config as any).output }, atomic: { ...DEFAULT_CONFIG.atomic, ...(config as any).atomic }, prefixer: { ...DEFAULT_CONFIG.prefixer, ...(config as any).prefixer }, tokens: { ...DEFAULT_CONFIG.tokens, ...(config as any).tokens } } as Required<ChainCSSConfig>
    if (this.config.breakpoints) setBreakpoints(this.config.breakpoints)
    if (this.config.prefixer?.enabled) this.prefixer = new ChainCSSPrefixer(this.config.prefixer)

    this.loader = new ModuleLoader()
    this.cache = new CacheStore<CompileResult>(PERFORMANCE.CACHE_MAX_ENTRIES || 500)
    try {
        const s = fs.statSync('.chaincss-cache');
        // if it's a file from v2 OR a dir from a broken v3 run, nuke it
        if (s.isFile() || s.isDirectory()) {
          fs.rmSync('.chaincss-cache', { recursive: true, force: true });
        }
      } catch {
        // doesn't exist — that's fine, we'll create it fresh below
      }
    try { this.persistentCache = new CacheManager('.chaincss-cache', { maxAge: 7*24*60*60*1000, maxSize: 100*1024*1024, autoSave: true }) } catch { this.persistentCache = null }
    this.manifestWriter = new ManifestWriter()
    this.pipelineEnabled = (config as any).experimental?.enablePipeline !== false
    this.pipeline = createDefaultPipeline({ contexts: { optimization: { minify: this.config.output.minify, atomic: this.config.atomic.enabled } } })

    const ctx = { config: this.config, pipeline: this.pipeline, prefixer: this.prefixer, cache: this.cache, persistentCache: this.persistentCache, emit: (e: CompilerEvent) => this.emit(e) }
    this.styleCompiler = createStyleCompilation(ctx as any)
    this.componentCompiler = createComponentCompiler({ config: this.config, loader: this.loader, prefixer: this.prefixer, manifestWriter: this.manifestWriter, compileStyle: (id, def) => this.compileStyle(id, def), computeStats: () => this.computeStats(), getAggregatedStats: () => this.getAggregatedStats(), emit: (e) => this.emit(e) })

    this.registerCustomExtensions()
  }

  private registerCustomExtensions() {
    const cfg = this.config as any
    if (cfg.shorthands && Object.keys(cfg.shorthands).length) {
      import('../compiler/utils/shorthands.js').then(m => {
        ;(m as any).registerCustomShorthands?.(cfg.shorthands, !!cfg.allowOverride)
        import('../compiler/pipeline/normalizers/intent-data.js').then(d => (d as any).registerCustomKnownProperties?.(Object.keys(cfg.shorthands))).catch(()=>{})
        import('../compiler/pipeline/normalizers/intent-detector.js').then(det => (det as any).registerCustomIntentKeys?.(Object.keys(cfg.shorthands))).catch(()=>{})
      }).catch(()=>{})
    }
    if (cfg.macros && Object.keys(cfg.macros).length) import('../compiler/utils/shorthands.js').then(m => (m as any).registerCustomMacros?.(cfg.macros, !!cfg.allowOverride)).catch(()=>{})
    if (cfg.intents && Object.keys(cfg.intents).length) import('../compiler/pipeline/lowering/intent-resolver.js').then(r => (r as any).registerIntents?.(cfg.intents, !!cfg.allowOverride)).catch(()=>{})
  }

  // Events
  public onEvent(h: CompilerEventHandler) { this.eventHandlers.push(h); return () => { this.eventHandlers = this.eventHandlers.filter(x => x !== h) } }
  private emit(e: CompilerEvent) { for (const h of this.eventHandlers) try { h(e) } catch {} if (e.type === 'warning' && !this.config.silent) console.warn(chalk.yellow(`[ChainCSS] ${e.code}: ${e.message}`)); if (e.type === 'error' && !this.config.silent) console.error(chalk.red(`[ChainCSS] ${e.code}: ${e.message}`)) }

  // Public API — delegates to style-compilation
  public compileStyle(id: string, def: StyleDefinition): CompileResult { 
    return this.pipelineEnabled ? this.styleCompiler.compileViaPipeline(id, def) : this.styleCompiler.compileDirect(id, def) }
  public compileRecipe(id: string, val: any): CompileResult {
    try { const g = val.getAllVariants; if (typeof g === 'function') { let css = ''; const map: Record<string,string> = {}; for (const v of g()) { const k = Object.entries(v).map(([a,b])=>`${a}-${b}`).join('_'); const sd = val(v); if (sd?.selectors) { const r = this.compileStyle(`${id}_${k}`, sd); css += r.css; Object.assign(map, r.classMap) } } return { css, classMap: map, atomicClasses: [], stats: this.computeStats() } as any } } catch (e) { this.emit({ type: 'error', code: 'RECIPE_COMPILE_FAILED', message: `recipe ${id} failed`, sourceFile: id, originalError: e } as any) }
    return { css: '', classMap: {}, atomicClasses: [], stats: this.computeStats() } as any
  }

  // Batch
  public async compileComponents(components: string[]) {
    if (this.compileInProgress) return new Promise<void>((res, rej) => { this.compileQueue.push({ resolve: res, reject: rej }) })
    this.aggregatedStats = { totalStyles: 0, atomicStyles: 0, deadRulesEliminated: 0, pipelinePasses: 0, filesProcessed: 0 }
    this.compileInProgress = true
    try { await this.componentCompiler.compileAll(components) } finally { this.compileInProgress = false; this.drainQueue() }
  }
  private drainQueue() { const q = [...this.compileQueue]; this.compileQueue = []; for (const i of q) i.resolve() }

  // File single
  public async compileFile(filePath: string) { const ex = await this.loader.import(filePath); const out: Record<string, CompileResult> = {}; for (const [n, v] of Object.entries(ex)) { if (typeof v === 'function' && (v as any).variants) out[n] = this.compileRecipe(n, v); else if ((v as any)?.selectors) out[n] = this.compileStyle(n, v as any) } return out }
  public async compile(inputFile: string, outDir: string) { const r = await this.compileFile(inputFile); let css = ''; for (const v of Object.values(r)) css += v.css; writeFile(path.join(outDir, `${getBaseName(inputFile)}.css`), css); return { results: r } }

  // Graph
  public compileWithGraph(styles: Record<string, StyleDefinition>, opts?: GraphCompileOptions) { return new StyleGraphCompiler({ ...opts, verbose: this.config.verbose }).compile(styles) }

  // Pipeline control
  public setPipelineEnabled(v: boolean) { this.pipelineEnabled = v; return this } public setPipeline(p: Pipeline) { this.pipeline = p; this.pipelineEnabled = true; return this } public isPipelineEnabled() { return this.pipelineEnabled } public getPipeline() { return this.pipeline } public getDiagnostics() { return this.pipeline.getLastResult?.()?.ir?.diagnostics || [] }

  // Stats — pure compute, no side effect
  private computeStats() { const last = this.pipeline.getLastResult?.(); const rules = last?.ir?.rules || []; const total = rules.length; const alive = rules.filter((r:any)=>!r.isDead).length; const atomic = rules.filter((r:any)=>r.meta?.atomic===true).length; return { totalStyles: total, atomicStyles: atomic, uniqueProperties: 0, savings: total-alive ? `${total-alive} rules eliminated` : '0%', deadRulesEliminated: total-alive, pipelinePasses: last?.timeline?.length || 0 } }
  public getStats() { const s = this.computeStats(); this.aggregatedStats.totalStyles += s.totalStyles; this.aggregatedStats.atomicStyles += s.atomicStyles; this.aggregatedStats.deadRulesEliminated += s.deadRulesEliminated; this.aggregatedStats.pipelinePasses = Math.max(this.aggregatedStats.pipelinePasses, s.pipelinePasses); this.aggregatedStats.filesProcessed++; return s }
  public getAggregatedStats() { return { totalStyles: this.aggregatedStats.totalStyles, atomicStyles: this.aggregatedStats.atomicStyles, uniqueProperties: 0, savings: this.aggregatedStats.deadRulesEliminated ? `${this.aggregatedStats.deadRulesEliminated} rules eliminated` : '0%', deadRulesEliminated: this.aggregatedStats.deadRulesEliminated, pipelinePasses: this.aggregatedStats.pipelinePasses, filesProcessed: this.aggregatedStats.filesProcessed } }
  public getCombinedCSS(){ return this.accumulatedCSS }
  public hasStyles(){ return this._hasStyles }
  public clearCSS(){ this.accumulatedCSS=''; this._hasStyles=false; this.cache.clear(); try{ this.persistentCache?.clear?.() }catch{} }

  private trackCSS(css: string){
    if(css && css.trim()){ this.accumulatedCSS += css; this._hasStyles = true }
  }
}

export async function compileChainCSS(input: string, out: string, cfg?: ChainCSSConfig) { return new ChainCSSCompiler(cfg||{}).compile(input, out) }
