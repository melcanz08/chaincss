// src/plugins/vite.ts
// Fixed: tmp extension, stale cache, python edits, F5 mismatch

import type { Plugin, ViteDevServer } from 'vite'
import path from 'path'
import fs from 'fs'
import { promises as fsp } from 'fs'
import { ChainCSSCompiler } from '../core/compiler.js'
import { formatCSS, ensureDir } from '../core/utils.js'
import { DEFAULT_CONFIG, ENVIRONMENT_PRESETS } from '../core/constants.js'
import type { ChainCSSConfig } from '../core/types.js'
import { createPipeline } from '../compiler/pipeline/unified-pipeline.js'
import { serializeForInspector } from '../compiler/pipeline/inspector/serializer.js'
import type { InspectorDiagnostic } from '../compiler/pipeline/inspector/types.js'
import { InspectorStore } from '../compiler/pipeline/inspector/store.js'

const CHAIN_FILE_RE = /\.chain\.(ts|js)x?$/
const TMP_MARKER = '.chaincss-tmp'
const isTmpFile = (p: string) => p.includes(TMP_MARKER)
const isGeneratedOutput = (p: string) => p.endsWith('.css') || p.endsWith('.class.js')

interface ChainCSSPluginOptions {
  verbose?: boolean
  pipelineReport?: boolean
  silent?: boolean
  disablePipeline?: boolean
  atomic?: boolean
  breakpoints?: Record<string, string>
  tokens?: ChainCSSConfig['tokens']
  minify?: boolean
  include?: string[]
  exclude?: string[]
}

export default function chaincssPlugin(options: ChainCSSPluginOptions = {}): Plugin {
  const verbose = options.verbose !== false
  const silent = options.silent ?? false
  const atomic = options.atomic ?? true

  let compiler: ChainCSSCompiler
  let root = ''
  let isProduction = false
  let base = '/'

  const cssFileCache = new Map<string, string>()
  let _cachedCSS = ''

  // Track files currently being compiled to avoid self-triggered loops
  const compiling = new Set<string>()

  function updateCSS(file: string, css: string) {
    cssFileCache.set(path.resolve(file), css)
    rebuildCache()
  }
  function removeCSS(file: string) {
    cssFileCache.delete(path.resolve(file))
    rebuildCache()
  }
  function rebuildCache() {
    _cachedCSS = Array.from(cssFileCache.values()).filter(Boolean).join('\n')
  }
  function getCSS() { return _cachedCSS }

  const inspectorStore = new InspectorStore()

  function log(msg: string) { if (!silent && verbose) console.log(`[ChainCSS] ${msg}`) }
  function logError(msg: string) { console.error(`[ChainCSS] ❌ ${msg}`) }
  function summary(msg: string) { if (!silent) console.log(`[ChainCSS] ${msg}`) }

  async function compileFile(chainPath: string, forcedContent?: string) {
    const absPath = path.resolve(chainPath)
    const source = forcedContent ?? fs.readFileSync(absPath, 'utf8')
    const ext = path.extname(absPath) || '.ts'
    // Must end with .ts/.js to be transpiled, but must NOT end with .chain.ts to avoid watcher loop
    const tmpPath = `${absPath}.${TMP_MARKER}-${Date.now()}${ext}`

    fs.writeFileSync(tmpPath, source, 'utf8')
    try {
      const results = (await (compiler as any).compileFile(tmpPath)) as Record<string, any>
      let css = ''
      const classMap: Record<string, string> = {}
      const allDiagnostics: InspectorDiagnostic[] = []

      for (const [name, compileResult] of Object.entries(results) as [string, any][]) {
        const diags = (compileResult?.inspector?.diagnostics || []) as InspectorDiagnostic[]
        if (diags.length) allDiagnostics.push(...diags)
        if (compileResult?.css) css += compileResult.css + '\n'
        const className = Object.values(compileResult.classMap || {})[0] as string | undefined
        if (className) classMap[name] = className
        const inspector = compileResult?.inspector
        if (inspector?.ir) {
          const rules = serializeForInspector(inspector.ir, inspector.pipelineReport || [], inspector.diagnostics || [], absPath, name)
          inspectorStore.addAll(rules)
        }
      }
      return { css, classMap, diagnostics: allDiagnostics, rawResults: results }
    } finally {
      try { fs.unlinkSync(tmpPath) } catch {}
    }
  }

  async function compileAllStyles() {
    const srcDir = path.join(root, 'src')
    if (!fs.existsSync(srcDir)) return ''

    // Fix ENOTDIR bug: .chaincss-cache might exist as a file from old version
    const cachePath = path.join(root, '.chaincss-cache')
    try {
      const stat = fs.statSync(cachePath)
      if (stat.isFile()) fs.unlinkSync(cachePath)
    } catch {}

    cssFileCache.clear()
    inspectorStore.clear()

    const chainFiles: string[] = []
    function walk(dir: string) {
      let entries: fs.Dirent[]
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (isTmpFile(fullPath)) continue
        if (isGeneratedOutput(fullPath)) continue
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'dist') continue
          walk(fullPath)
        } else if (CHAIN_FILE_RE.test(entry.name)) {
          chainFiles.push(fullPath)
        }
      }
    }
    walk(srcDir)

    if (!silent) summary(`Building ${chainFiles.length} file(s)...`)
    let successCount = 0
    for (const file of chainFiles) {
      try {
        const { css, classMap, rawResults } = await compileFile(file)
        if (css.trim()) {
          updateCSS(file, css)
          const cssPath = file.replace(CHAIN_FILE_RE, '.css')
          ensureDir(path.dirname(cssPath))
          await fsp.writeFile(cssPath, formatCSS(css, false), 'utf8').catch(() => {})
        }
        const classPath = file.replace(CHAIN_FILE_RE, '.class.js')
        const lines: string[] = ['// Auto-generated by ChainCSS Vite Plugin', '// DO NOT EDIT', '']
        for (const [name, className] of Object.entries(classMap)) {
          const r = (rawResults as any)[name]
          if (r?.dynamic && Object.keys(r.dynamic).length) {
            const fns = Object.entries(r.dynamic).map(([k, v]) => 
            `"${k}": ${(v as Function).toString()}`
          ).join(', ')
            lines.push(`export const ${name} = { className: '${className}', dynamic: { ${fns} } };`)
          } else {
            lines.push(`export const ${name} = '${className}'`)
          }
        }
        if (lines.length > 2) {
          ensureDir(path.dirname(classPath))
          await fsp.writeFile(classPath, lines.join('\n'), 'utf8').catch(() => {})
        }
        successCount++
      } catch (err) {
        logError(`Failed ${path.basename(file)}: ${(err as Error).message}`)
      }
    }
    if (!silent) summary(`Built ${successCount}/${chainFiles.length} files`)
    return getCSS()
  }

  function exportIRData() { return inspectorStore.export() }

  return {
    name: 'chaincss',
    enforce: 'pre',

    configResolved(config) {
      root = config.root
      base = config.base || '/'
      isProduction = config.mode === 'production'
      const preset = isProduction ? (ENVIRONMENT_PRESETS as any).production : (ENVIRONMENT_PRESETS as any).development
      const dc = DEFAULT_CONFIG as any
      const ps = preset as any
      compiler = new ChainCSSCompiler({
        ...dc,
        ...ps,
        atomic: { ...dc.atomic, ...ps.atomic, enabled: atomic },
        tokens: options.tokens || dc.tokens,
        output: { ...dc.output, minify: options.minify !== undefined ? options.minify : isProduction },
        breakpoints: options.breakpoints || dc.breakpoints,
        verbose, silent
      })
      const envPipeline = createPipeline(isProduction ? 'production' : 'default')
      ;(compiler as any).pipeline = envPipeline
      ;(compiler as any).setPipelineEnabled(true)
      if (!silent) summary(`Initialized (atomic: ${atomic})`)
    },

    // IMPORTANT: Use tmp file here too to bypass compiler's internal cache that causes F5 mismatch
    async transform(_code, id) {
      if (!CHAIN_FILE_RE.test(id) || isTmpFile(id)) return null
      try {
        const source = fs.readFileSync(id, 'utf8')
        const ext = path.extname(id) || '.ts'
        const tmpPath = `${id}.${TMP_MARKER}-${Date.now()}${ext}`
        fs.writeFileSync(tmpPath, source, 'utf8')
        try {
          const results = (await (compiler as any).compileFile(tmpPath)) as Record<string, any>
          const classMap: Record<string, string> = {}
          for (const [name, r] of Object.entries(results) as [string, any][]) {
            const cn = Object.values(r.classMap || {})[0] as string | undefined
            if (cn) classMap[name] = cn
          }
          const lines: string[] = ['// Auto-generated', '// DO NOT EDIT', '']
          let collectedCSS = ''
          for (const [name, r] of Object.entries(results) as [string, any][]) {
            if (r?.css) collectedCSS += r.css + '\n'
          }
          if (collectedCSS.trim()) {
            updateCSS(id, collectedCSS)
          }
          for (const [name, cn] of Object.entries(classMap)) {
            const r = results[name] as any
            if (r?.dynamic && Object.keys(r.dynamic).length) {
              const fns = Object.entries(r.dynamic).map(([k, v]) => 
              `"${k}": ${(v as Function).toString()}`
            ).join(', ')
              lines.push(`export const ${name} = { className: '${cn}', dynamic: { ${fns} } };`)
            } else {
              lines.push(`export const ${name} = '${cn}'`)
            }
          }
          return { code: lines.join('\n'), map: null }
        } finally {
          try { fs.unlinkSync(tmpPath) } catch {}
        }
      } catch (err) {
        logError(`Transform failed ${path.basename(id)}: ${(err as Error).message}`)
        return null
      }
    },

    async buildStart() {
      if (isProduction) {
        // In production, configureServer never runs, so we need to build CSS cache here
        // Clear any dev cache and rebuild from src
        cssFileCache.clear()
        _cachedCSS = ''
        try {
          await compileAllStyles()
        } catch (e) {
          logError(`buildStart failed: ${(e as Error).message}`)
        }
      }
    },

    configureServer(devServer: ViteDevServer) {
      devServer.httpServer?.once('listening', async () => {
        try { await compileAllStyles() } catch (e) { logError((e as Error).message) }
      })

      devServer.middlewares.use('/__chaincss.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css')
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.end(getCSS() || '/* ChainCSS empty */')
      })

      devServer.middlewares.use('/@chaincss/client.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(`
import { createHotContext } from "/@vite/client";
const STYLE_ID = 'chaincss-styles';
function ensureStyleEl() {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    el.setAttribute('data-chaincss','');
    document.head.appendChild(el);
  }
  return el;
}
function applyCSS(css) {
  const el = ensureStyleEl();
  el.textContent = css;
}
fetch('/__chaincss.css', { cache: 'no-store' }).then(r=>r.text()).then(applyCSS).catch(()=>{});
const hot = createHotContext('/@chaincss/client.js');
hot.on('chaincss-update', (data) => {
  const url = '/__chaincss.css?v=' + (data?.timestamp || Date.now());
  fetch(url, { cache: 'no-store' }).then(r=>r.text()).then((css)=>{
    applyCSS(css);
    console.log('[ChainCSS] HMR updated', css.length + 'B');
  });
});
hot.accept();
`)
      })

      devServer.middlewares.use('/__chaincss-ir.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(JSON.stringify(exportIRData() || {}))
      })

      // Handle python-style atomic writes (unlink+add) and normal changes
      const handleFileChange = async (fp: string) => {
        // Ignore generated output files
        if (isGeneratedOutput(fp)) return
        if (!CHAIN_FILE_RE.test(fp) || isTmpFile(fp)) return
        
        const abs = path.resolve(fp)
        
        // Security: prevent path traversal outside project root
        if (!abs.startsWith(root)) { logError(`Rejected path outside root: ${abs}`); return }
        
        // Skip if this file is already being compiled
        if (compiling.has(abs)) return
        
        compiling.add(abs)
        log(`Change detected (watcher): ${path.basename(abs)}`)
        try {
          if ((compiler as any)?.invalidateFileCache) {
            ;(compiler as any).invalidateFileCache(abs)
          }
          const mod = devServer.moduleGraph.getModuleById(abs)
          if (mod) devServer.moduleGraph.invalidateModule(mod)

          const { css } = await compileFile(abs, fs.readFileSync(abs, 'utf8'))
          updateCSS(abs, css)
          devServer.ws.send({ type: 'custom', event: 'chaincss-update', data: { timestamp: Date.now() } })
        } catch (err) {
          logError(`Watcher HMR failed ${path.basename(abs)}: ${(err as Error).message}`)
        } finally {
          // Delay removal to debounce rapid re-triggers
          setTimeout(() => compiling.delete(abs), 500)
        }
      }

      devServer.watcher.on('change', handleFileChange)
      devServer.watcher.on('add', handleFileChange)
      devServer.watcher.on('unlink', (fp: string) => {
        if (isGeneratedOutput(fp)) return
        if (CHAIN_FILE_RE.test(fp) && !isTmpFile(fp)) {
          removeCSS(fp)
          devServer.ws.send({ type: 'custom', event: 'chaincss-update', data: { timestamp: Date.now() } })
        }
      })
    },

    async handleHotUpdate(ctx) {
      const filePath = path.resolve(ctx.file)
      // Ignore generated output files
      if (isGeneratedOutput(filePath)) return
      if (!CHAIN_FILE_RE.test(filePath) || isTmpFile(filePath)) return
      
      // Skip if already compiling this file
      if (compiling.has(filePath)) return
      compiling.add(filePath)

      log(`Change detected: ${path.basename(filePath)}`)
      try {
        const newContent = await ctx.read()
        const mod = ctx.server.moduleGraph.getModuleById(filePath)
        if (mod) ctx.server.moduleGraph.invalidateModule(mod)
        if ((compiler as any)?.invalidateFileCache) {
          ;(compiler as any).invalidateFileCache(filePath)
        }
        const { css } = await compileFile(filePath, newContent)
        updateCSS(filePath, css)
        ctx.server.ws.send({ type: 'custom', event: 'chaincss-update', data: { timestamp: Date.now() } })
        return ctx.modules
      } catch (err) {
        logError(`HMR failed: ${(err as Error).message}`)
        return []
      } finally {
        setTimeout(() => compiling.delete(filePath), 500)
      }
    },

    async generateBundle() {
      const css = getCSS()
      if (css.trim()) this.emitFile({ type: 'asset', fileName: 'assets/chaincss.css', source: css })
      const ir = exportIRData()
      if (ir) this.emitFile({ type: 'asset', fileName: 'assets/chaincss-ir.json', source: JSON.stringify(ir) })
    },

    transformIndexHtml() {
      if (isProduction) {
        return [{ tag: 'link', attrs: { rel: 'stylesheet', href: `${base}assets/chaincss.css`, 'data-chaincss': '' }, injectTo: 'head' }]
      }
      return [
        { tag: 'style', attrs: { id: 'chaincss-styles', 'data-chaincss': '' }, children: '/* ChainCSS HMR */', injectTo: 'head' },
        { tag: 'script', attrs: { type: 'module', src: '/@chaincss/client.js' }, injectTo: 'head' }
      ]
    }
  }
}