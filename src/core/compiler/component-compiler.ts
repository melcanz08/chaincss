// src/core/compiler/component-compiler.ts — extracted from compiler.ts
// Responsibility: batch .chain.ts files -> .class.js + .css + manifest

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { formatCSS } from '../utils.js'
import type { CompileResult, StyleDefinition } from '../types.js'
import type { ChainCSSPrefixer } from '../../compiler/prefixer.js'
import type { ManifestWriter } from '../../compiler/services/manifest-writer.js'
import { VERSION } from '../constants.js'

export interface ComponentContext {
  config: any
  loader: { import: (p: string) => Promise<any> }
  prefixer: ChainCSSPrefixer | null
  manifestWriter: ManifestWriter
  compileStyle: (id: string, def: StyleDefinition) => CompileResult
  computeStats: () => any
  getAggregatedStats: () => any
  emit: (e: any) => void
}

export function createComponentCompiler(ctx: ComponentContext) {
  function header(file: string) {
    return `/**\n * ChainCSS Generated Class Map\n * Source: ${path.relative(process.cwd(), file)}\n * Generated: ${new Date().toISOString()}\n * DO NOT EDIT MANUALLY\n */\n\n`
  }

  async function writeOutput(sourceDir: string, baseName: string, js: string, css: string, generated: string[]) {
    if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true })
    const classFile = path.join(sourceDir, `${baseName}.class.js`)
    fs.writeFileSync(classFile, js); generated.push(classFile)
    if (css.trim()) {
      let final = css
      if (ctx.prefixer && ctx.config.prefixer?.enabled) {
        try { const p = await ctx.prefixer.process(final); final = p.css || final } catch (e) {
          ctx.emit({ type: 'warning', code: 'PREFIXER_BATCH_FAILED', message: `prefix failed for ${baseName}`, sourceFile: classFile, originalError: e })
        }
      }
      fs.writeFileSync(path.join(sourceDir, `${baseName}.css`), formatCSS(final, false))
    }
    if (ctx.config.verbose) console.log(chalk.green(`   ✨ ${baseName} → ${path.relative(process.cwd(), classFile)}`))
  }

  async function compileOne(file: string, baseName: string, sourceDir: string, generated: string[]): Promise<number> {
    let diag = 0
    try {
      const raw = await ctx.loader.import(file)
      const styles: Record<string, any> = {}
      if (raw.default && typeof raw.default === 'object' && !raw.default.selectors) Object.assign(styles, raw.default)
      for (const [k, v] of Object.entries(raw)) if (k !== 'default' && k !== '__esModule' && typeof v === 'object' && v !== null) styles[k] = v
      if (raw.default?.selectors) styles['default'] = raw.default
      if (Object.keys(styles).length === 0 && typeof raw === 'object') Object.assign(styles, raw)

      let js = header(file), css = ''
      for (const [name, style] of Object.entries(styles)) {
        if (!style || typeof style !== 'object' || !(style as any).selectors) continue
        const result = ctx.compileStyle(name, style as StyleDefinition)
        const className = Object.values(result.classMap)[0] as string | undefined
        if (className) {
          const hasDyn = result.dynamic && Object.keys(result.dynamic).length > 0
          if (hasDyn) {
            const fns: Record<string, string> = {}
            for (const [p, fn] of Object.entries(result.dynamic!)) fns[p] = (fn as Function).toString()
            const fnEntries = Object.entries(fns).map(([k,v]) => `"${k}": ${v}`).join(", ");
            js += `export const ${name} = { className: '${className}', dynamic: { ${fnEntries} } };\n`
          } else js += `export const ${name} = '${className}';\n`
        }
        css += result.css + '\n'
        if ((result as any)._diagnostics) diag += (result as any)._diagnostics.length
      }
      if (css.trim() || js.includes('export const')) await writeOutput(sourceDir, baseName, js, css, generated)
    } catch (e) {
      ctx.emit({ type: 'error', code: 'FILE_PROCESS_FAILED', message: `Failed ${baseName}: ${(e as Error).message}`, sourceFile: file, originalError: e })
    }
    return diag
  }

  async function compileAll(components: string[], onProgress?: (msg: string) => void) {
    let processed = 0, totalDiags = 0
    const classFiles: string[] = []
    const aggregated = { totalStyles: 0, atomicStyles: 0, deadRulesEliminated: 0, pipelinePasses: 0, filesProcessed: 0 }

    if (!ctx.config.silent) console.log(chalk.blue('\n🏗  Building Component Styles...'))

    for (const file of components) {
      if (!file.endsWith('.chain.js') && !file.endsWith('.chain.ts') && !file.endsWith('.chain.jsx') && !file.endsWith('.chain.tsx')) continue
      const baseName = path.basename(file).replace(/\.chain\.(js|ts|jsx|tsx)$/, '')
      const sourceDir = path.dirname(file)
      const d = await compileOne(file, baseName, sourceDir, classFiles)
      totalDiags += d; processed++
    }

    if (!ctx.config.silent) console.log(chalk.blue('\n📋 Finalizing Manifest...'))

    ctx.manifestWriter.write({
      version: VERSION,
      timestamp: new Date().toISOString(),
      atomicMap: {},
      stats: ctx.getAggregatedStats(),
      pipelineEnabled: true,
      diagnosticsCount: totalDiags,
      classFiles: classFiles.map(f => path.relative(process.cwd(), f))
    })

    if (!ctx.config.silent) {
      console.log(chalk.green(`\n✅ Build Complete!`))
      console.log(chalk.gray(`   📁 Components: ${processed}`))
      console.log(chalk.gray(`   📁 Class files: ${classFiles.length}`))
    }

    return { processed, classFiles, totalDiags }
  }

  return { compileOne, compileAll, writeOutput }
}
