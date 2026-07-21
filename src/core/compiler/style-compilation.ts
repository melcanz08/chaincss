// src/core/compiler/style-compilation.ts 

import { formatCSS } from '../utils.js'
import { compileToCSS, partitionForBuild } from '../style-compiler.js'
import { parseIR, generateCSS } from '../../style-ir.js'
import type { ChainCSSConfig, CompileResult, StyleDefinition, StyleObject } from '../types.js'
import type { Pipeline } from '../../compiler/pipeline/index.js'
import type { ChainCSSPrefixer } from '../../compiler/prefixer.js'
import type { CacheStore } from '../../compiler/services/cache-store.js'
import type { CacheManager } from '../../compiler/cache/cache-manager.js'

export interface CompilationContext {
  config: Required<ChainCSSConfig>
  pipeline: Pipeline
  prefixer: ChainCSSPrefixer | null
  cache: CacheStore<CompileResult>
  persistentCache: CacheManager | null
  emit: (e: any) => void
}

/** DJB2 — browser-safe, no crypto dep */
function hashString(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

/** Fast stable stringify — sorts keys once, skips functions */
function fastStableStringify(val: any): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val) ?? ''
  if (Array.isArray(val)) {
    let s = '['
    for (let i = 0; i < val.length; i++) {
      if (i) s += ','
      s += fastStableStringify(val[i])
    }
    return s + ']'
  }
  const keys = Object.keys(val).sort()
  let out = '{'
  let first = true
  for (const k of keys) {
    const v = val[k]
    if (typeof v === 'function' || typeof v === 'undefined') continue
    if (!first) out += ','
    first = false
    out += JSON.stringify(k) + ':' + fastStableStringify(v)
  }
  return out + '}'
}

function styleDefToObject(styleDef: StyleDefinition): StyleObject {
  const {
    selectors,
    atRules,
    _atRules,
    nestedRules,
    _nestedRules,
    hover,
    themes,
    dynamic,
    _componentName,
    _generateComponent,
    _framework,
    _propsDefinition,
    ...props
  } = styleDef as any

  // props already contains & and . selectors — no extra loop needed
  const obj: any = props

  if (selectors) obj.selectors = selectors
  if (hover) obj['&:hover'] = hover
  // Bridge: runtime may use prefixed or un-prefixed
  if (atRules || _atRules) obj._atRules = atRules || _atRules
  if (nestedRules || _nestedRules) obj._nestedRules = nestedRules || _nestedRules
  if (dynamic) obj.dynamic = dynamic
  // themes intentionally dropped — handled upstream

  return obj as StyleObject
}

function hashStyleDef(styleDef: StyleDefinition): string {
  const normalized = styleDefToObject(styleDef)
  // Exclude dynamic (functions) from structural hash — JSON.stringify would drop them and collide
  const { dynamic, ...rest } = normalized as any
  return hashString(fastStableStringify(rest))
}

function isGlobalSelector(selectors: string[]): boolean {
  return selectors.some(s => !s.startsWith('.') && !s.startsWith('#'))
}

function getClassName(selectors: string[], styleId: string, isGlobal: boolean): string {
  if (isGlobal) return ''
  return selectors[0]?.replace(/^\.|^#/, '') || `chain-${styleId}`
}

export function createStyleCompilation(ctx: CompilationContext) {
  function getCached(key: string, hash: string): CompileResult | null {
    const mem = ctx.cache.get(key)
    if (mem) return mem
    if (ctx.persistentCache?.has(key)) {
      const p = ctx.persistentCache.get(key)
      if (p) {
        ctx.cache.set(key, p, hash)
        return p
      }
    }
    return null
  }

  function setCached(key: string, value: CompileResult, hash: string) {
    ctx.cache.set(key, value, hash)
    ctx.persistentCache?.set(key, value)
  }

  function compileViaPipeline(styleId: string, styleDef: StyleDefinition): CompileResult {
    const hash = hashStyleDef(styleDef)
    const key = `pipeline:${styleId}:${hash}`
    const cached = getCached(key, hash)
    if (cached) return cached

    const selectors = (styleDef as any).selectors || []
    const global = isGlobalSelector(selectors)
    const styleObject = styleDefToObject(styleDef)
    const ir = parseIR({ [styleId]: styleObject as any }, styleId)
    const result = ctx.pipeline.execute(ir)

    const total = result.ir.rules.length
    const alive = result.ir.rules.filter(r => !r.isDead).length
    const dead = total - alive
    const atomic = result.ir.rules.filter(r => r.meta?.atomic === true).length

    // Only 1 generateCSS in prod — savings calc only in verbose
    let finalCss = generateCSS(result.ir, { minify: !!ctx.config.output.minify })

    let savingsLabel = dead ? `${dead} rules eliminated` : '0%'
    let compression = '0%'
    if (ctx.config.verbose && ctx.config.output.minify) {
      const raw = generateCSS(result.ir, { minify: false })
      const rawB = raw.length
      const minB = finalCss.length
      const pct = rawB > 0 ? Math.round((1 - minB / rawB) * 100) : 0
      compression = `${pct}%`
    }

    if (ctx.prefixer && ctx.config.prefixer.enabled && finalCss.trim()) {
      try {
        finalCss = (ctx.prefixer as any).lightweightPrefix(finalCss) || finalCss
      } catch (e) {
        ctx.emit({
          type: 'warning',
          code: 'PREFIXER_FAILED',
          message: `prefix failed for ${styleId}`,
          sourceFile: styleId,
          originalError: e
        })
      }
    }

    const className = getClassName(selectors, styleId, global)
    const { hasDynamic, dynamicValues } = partitionForBuild(styleObject as any)

    const out: CompileResult = {
      css: formatCSS(finalCss, ctx.config.output.minify),
      classMap: global ? {} : { [styleId]: className },
      dynamic: hasDynamic ? dynamicValues : undefined,
      atomicClasses: [],
      stats: {
        totalStyles: total,
        atomicStyles: atomic,
        uniqueProperties: 0,
        savings: savingsLabel,
        deadRulesEliminated: dead,
        compressionSavings: compression,
        pipelinePasses: result.timeline.length,
        totalDuration: result.totalDuration
      }
    } as any

    ;(out as any).inspector = { ir: result.ir, pipelineReport: result.timeline, diagnostics: result.ir.diagnostics }

    if (ctx.config.verbose) {
      ;(out as any)._pipelineReport = result.timeline
      ;(out as any)._diagnostics = result.ir.diagnostics
    }

    setCached(key, out, hash)
    return out
  }

  function compileDirect(styleId: string, styleDef: StyleDefinition): CompileResult {
    const hash = hashStyleDef(styleDef)
    const key = `direct:${styleId}:${hash}`
    const cached = getCached(key, hash)
    if (cached) return cached

    const selectors = (styleDef as any).selectors || []
    const global = isGlobalSelector(selectors)
    const styleObject = styleDefToObject(styleDef)

    const css = compileToCSS(styleObject as any, {
      scopeSelector: Array.isArray(selectors) ? selectors.join(',') : `.${styleId}`,
      minify: ctx.config.output.minify,
      sourceMap: ctx.config.sourceComments,
      sourceFile: styleId
    } as any)

    const className = getClassName(selectors, styleId, global)
    const { hasDynamic, dynamicValues } = partitionForBuild(styleObject as any)

    const out: CompileResult = {
      css: formatCSS(css, ctx.config.output.minify),
      classMap: global ? {} : { [styleId]: className },
      dynamic: hasDynamic ? dynamicValues : undefined,
      atomicClasses: [],
      stats: {
        totalStyles: 1,
        atomicStyles: 0,
        uniqueProperties: 0,
        savings: '0%',
        deadRulesEliminated: 0,
        pipelinePasses: 0
      }
    }

    setCached(key, out, hash)
    return out
  }

  return { compileViaPipeline, compileDirect, hashStyleDef, styleDefToObject }
}
