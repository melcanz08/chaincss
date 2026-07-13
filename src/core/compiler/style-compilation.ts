// src/core/compiler/style-compilation.ts — extracted from compiler.ts
// Responsibility: single style -> CSS via pipeline or direct path

import crypto from 'crypto'
import { formatCSS } from '../utils.js'
import { compileToCSS, partitionForBuild } from '../style-compiler.js'
import { parseIR, generateCSS } from '../../style-ir.js'
import type { ChainCSSConfig, CompileResult, StyleDefinition, StyleObject } from '../types.js'
import type { Pipeline } from '../../compiler/pipeline/index.js'
import type { ChainCSSPrefixer } from '../../compiler/prefixer.js'
import type { CacheStore } from '../../compiler/services/cache-store.js'
import type { CacheManager } from '../../compiler/cache/cache-manager.js'
import type { CompilerEventHandler } from '../../compiler/services/compiler-events.js'

export interface CompilationContext {
  config: Required<ChainCSSConfig>
  pipeline: Pipeline
  prefixer: ChainCSSPrefixer | null
  cache: CacheStore<CompileResult>
  persistentCache: CacheManager | null
  emit: (e: any) => void
}

export function createStyleCompilation(ctx: CompilationContext) {
  function hashStyleDef(styleDef: StyleDefinition): string {
    const { _componentName, _generateComponent, _framework, _propsDefinition, ...relevant } = styleDef as any
    const stable = (obj: any): any => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
      const keys = Object.keys(obj).sort()
      const o: any = {}
      for (const k of keys) o[k] = stable(obj[k])
      return o
    }
    return crypto.createHash('sha256').update(JSON.stringify(stable(relevant))).digest('hex').slice(0, 16)
  }

  function styleDefToObject(styleDef: StyleDefinition): StyleObject {
    const { selectors, atRules, nestedRules, hover, themes, dynamic, _componentName, _generateComponent, _framework, _propsDefinition, ...properties } = styleDef as any
    const obj: StyleObject = { ...properties }
    if (dynamic) (obj as any).dynamic = dynamic
    if (selectors) (obj as any).selectors = selectors
    if (hover) (obj as any)['&:hover'] = hover
    if (atRules) (obj as any).atRules = atRules
    if (nestedRules) (obj as any)._nestedRules = nestedRules
    for (const k of Object.keys(styleDef as any)) if (k.startsWith('&') || k.startsWith('.')) (obj as any)[k] = (styleDef as any)[k]
    return obj
  }

  function compileViaPipeline(styleId: string, styleDef: StyleDefinition): CompileResult {
    const hash = hashStyleDef(styleDef)
    const key = `pipeline:${styleId}:${hash}`
    const cached = ctx.cache.get(key)
    if (cached) return cached
    if (ctx.persistentCache?.has(key)) { const p = ctx.persistentCache.get(key); if (p) { ctx.cache.set(key, p, hash); return p } }

    const selectors = styleDef.selectors || []
    const isGlobal = selectors.some(s => !s.startsWith('.') && !s.startsWith('#'))
    const styleObject = styleDefToObject(styleDef)
    const ir = parseIR({ [styleId]: styleObject as any }, styleId)
    const result = ctx.pipeline.execute(ir)

    const total = result.ir.rules.length
    const alive = result.ir.rules.filter(r => !r.isDead).length
    const dead = total - alive
    const atomic = result.ir.rules.filter(r => r.meta?.atomic === true).length

    const raw = generateCSS(result.ir, { minify: false })
    let final = ctx.config.output.minify ? generateCSS(result.ir, { minify: true }) : raw
    const rawB = new TextEncoder().encode(raw).length
    const minB = new TextEncoder().encode(final).length
    const savings = rawB > 0 ? Math.round((1 - minB / rawB) * 100) : 0

    if (ctx.prefixer && ctx.config.prefixer.enabled && final.trim()) {
      try { final = (ctx.prefixer as any).lightweightPrefix(final) || final } catch (e) {
        ctx.emit({ type: 'warning', code: 'PREFIXER_FAILED', message: `prefix failed for ${styleId}`, sourceFile: styleId, originalError: e })
      }
    }

    const className = !isGlobal ? selectors[0]?.replace(/^\./, '') || `chain-${styleId}` : ''
    const { hasDynamic, dynamicValues } = partitionForBuild(styleObject)

    const out: CompileResult = {
      css: formatCSS(final, ctx.config.output.minify),
      classMap: isGlobal ? {} : { [styleId]: className },
      dynamic: hasDynamic ? dynamicValues : undefined,
      atomicClasses: [],
      stats: { totalStyles: total, atomicStyles: atomic, uniqueProperties: 0, savings: dead ? `${dead} rules eliminated` : '0%', deadRulesEliminated: dead, compressionSavings: `${savings}%`, pipelinePasses: result.timeline.length, totalDuration: result.totalDuration }
    } as any
    ;(out as any).inspector = { ir: result.ir, pipelineReport: result.timeline, diagnostics: result.ir.diagnostics }
    if (ctx.config.verbose) { (out as any)._pipelineReport = result.timeline; (out as any)._diagnostics = result.ir.diagnostics }

    ctx.cache.set(key, out, hash); ctx.persistentCache?.set(key, out)
    return out
  }

  function compileDirect(styleId: string, styleDef: StyleDefinition): CompileResult {
    const hash = hashStyleDef(styleDef)
    const key = `direct:${styleId}:${hash}`
    const cached = ctx.cache.get(key)
    if (cached) return cached
    if (ctx.persistentCache?.has(key)) { const p = ctx.persistentCache.get(key); if (p) { ctx.cache.set(key, p, hash); return p } }

    const selectors = styleDef.selectors || []
    const isGlobal = selectors.some(s => !s.startsWith('.') && !s.startsWith('#'))
    const styleObject = styleDefToObject(styleDef)
    const css = compileToCSS(styleObject, { scopeSelector: Array.isArray(selectors) ? selectors.join(',') : `.${styleId}`, minify: ctx.config.output.minify, sourceMap: ctx.config.sourceComments, sourceFile: styleId } as any)
    const className = isGlobal ? '' : selectors[0]?.replace(/^\./, '') || `chain-${styleId}`
    const { hasDynamic, dynamicValues } = partitionForBuild(styleObject)

    const out: CompileResult = { css: formatCSS(css, ctx.config.output.minify), classMap: isGlobal ? {} : { [styleId]: className }, dynamic: hasDynamic ? dynamicValues : undefined, atomicClasses: [], stats: { totalStyles: 1, atomicStyles: 0, uniqueProperties: 0, savings: '0%', deadRulesEliminated: 0, pipelinePasses: 0 } }
    ctx.cache.set(key, out, hash); ctx.persistentCache?.set(key, out)
    return out
  }

  return { compileViaPipeline, compileDirect, hashStyleDef, styleDefToObject }
}
