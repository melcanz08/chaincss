// src/plugins/vite.ts

import type { Plugin, ViteDevServer } from 'vite'
import path from 'path'
import fs from 'fs'
import { chain } from 'chaincss'
import { ChainCSSCompiler } from '../core/compiler.js'
import { formatCSS, ensureDir } from '../core/utils.js'
import { DEFAULT_CONFIG, ENVIRONMENT_PRESETS } from '../core/constants.js'
import type { ChainCSSConfig } from '../core/types.js'

const CHAIN_FILE_RE = /\.chain\.(ts|js)x?$/

// ============================================================================
// Types
// ============================================================================

interface ChainCSSPluginOptions {
  verbose?: boolean
  pipelineReport?: boolean
  silent?: boolean
  disablePipeline?: boolean
  useNewPipeline?: boolean
  atomic?: boolean
  breakpoints?: Record<string, string>
  tokens?: ChainCSSConfig['tokens']
  minify?: boolean
  include?: string[]
  exclude?: string[]
}

// ============================================================================
// Plugin
// ============================================================================

export default function chaincssPlugin(options: ChainCSSPluginOptions = {}): Plugin {
  const verbose = options.verbose !== false
  const pipelineReport = options.pipelineReport ?? verbose
  const silent = options.silent ?? false
  const disablePipeline = options.disablePipeline ?? false
  const useNewPipeline = options.useNewPipeline ?? false
  const atomic = options.atomic ?? true

  let compiler: ChainCSSCompiler
  let root: string = ''
  let cssCache = ''
  let totalDiagnostics = 0
  let totalAutoFixes = 0

  // ── Logging ──────────────────────────────────────────────

  function log(msg: string) {
    if (!silent && verbose) console.log(`[ChainCSS] ${msg}`)
  }

  function warn(msg: string) {
    if (!silent) console.warn(`[ChainCSS] ⚠️  ${msg}`)
  }

  function error(msg: string) {
    console.error(`[ChainCSS] ❌ ${msg}`)
  }

  function summary(msg: string) {
    if (!silent) console.log(`[ChainCSS] ${msg}`)
  }

  // ── Compilation ──────────────────────────────────────────

  /**
   * Compile a .chain.js file by reading its source, evaluating chain() calls
   * with the plugin's own chain reference, and compiling each style export.
   * 
   * Does NOT use ModuleLoader.import() — avoids ESM bundling Proxy issues.
   */
  async function compileFile(chainPath: string): Promise<{
    css: string
    classMap: Record<string, string>
    diagnostics: any[]
  }> {
    const source = fs.readFileSync(chainPath, 'utf8')
    const capturedExports: Record<string, any> = {}

    // Strip import statements, convert "export const X =" to "capturedExports.X ="
    const processedSource = source
      .replace(/import\s+\{.*\}\s+from\s+['"]chaincss['"];?\s*/g, '')
      .replace(/export\s+const\s+(\w+)\s*=\s*/g, 'capturedExports.$1 = ')
      .trim()

    // Evaluate with chain() from this module's import (works reliably)
    const fn = new Function('chain', 'capturedExports', processedSource)
    fn(chain, capturedExports)

    let css = ''
    const classMap: Record<string, string> = {}
    const allDiagnostics: any[] = []

    for (const [name, styleDef] of Object.entries(capturedExports)) {
      if (styleDef && typeof styleDef === 'object' && styleDef.selectors) {
        const compileResult = compiler.compileStyle(name, styleDef)

        if ((compileResult as any)._diagnostics) {
          for (const d of (compileResult as any)._diagnostics) {
            allDiagnostics.push({ ...d, styleName: name })
          }
        }

        if (compileResult.css) {
          let fileCss = compileResult.css
          const className = Object.values(compileResult.classMap)[0]

          if (className) {
            classMap[name] = className
            const firstSelector = fileCss.match(/^\.([a-zA-Z0-9_-]+)/)?.[1]
            if (firstSelector && firstSelector !== className) {
              fileCss = fileCss.replace(
                new RegExp('\\.' + firstSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                '.' + className
              )
            }
          }

          css += fileCss + '\n'
        }
      }
    }

    return { css, classMap, diagnostics: allDiagnostics }
  }

  function printDiagnostics(diagnostics: any[], fileName: string) {
    if (!verbose || silent) return

    const errors = diagnostics.filter(d => d.severity === 'error')
    const warnings = diagnostics.filter(d => d.severity === 'warning')
    const infos = diagnostics.filter(d => d.severity === 'info' || d.severity === 'hint')

    for (const d of errors) {
      console.log(`[ChainCSS]     ❌ ${d.message}`)
      if (d.suggestion) console.log(`[ChainCSS]        ↳ ${d.suggestion}`)
    }

    for (const d of warnings.slice(0, 3)) {
      console.log(`[ChainCSS]     ⚠️  ${d.message}`)
      if (d.suggestion) console.log(`[ChainCSS]        ↳ ${d.suggestion}`)
    }
    if (warnings.length > 3) {
      console.log(`[ChainCSS]     ... and ${warnings.length - 3} more warnings`)
    }

    if (pipelineReport && infos.length > 0) {
      for (const d of infos.slice(0, 2)) {
        console.log(`[ChainCSS]     ℹ️  ${d.message}`)
      }
      if (infos.length > 2) {
        console.log(`[ChainCSS]     ... and ${infos.length - 2} more info`)
      }
    }

    totalDiagnostics += diagnostics.length
    totalAutoFixes += diagnostics.filter(d => d.autoFixable).length
  }

  async function compileAllStyles(): Promise<string> {
    const startTime = Date.now()
    const srcDir = path.join(root, 'src')
    if (!fs.existsSync(srcDir)) return ''

    totalDiagnostics = 0
    totalAutoFixes = 0

    const chainFiles: string[] = []
    function walk(dir: string) {
      let entries: fs.Dirent[]
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
      catch { return }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'dist') continue
          walk(fullPath)
        } else if (CHAIN_FILE_RE.test(entry.name)) {
          chainFiles.push(fullPath)
        }
      }
    }
    walk(srcDir)

    if (!silent) {
      const mode = disablePipeline ? 'direct' : '5-stage pipeline'
      summary(`Building ${chainFiles.length} file(s) with ${mode}...`)
    }

    let allCSS = '/* ChainCSS Generated */\n'
    let successCount = 0

    for (const file of chainFiles) {
      try {
        const { css, classMap, diagnostics } = await compileFile(file)
        const fileName = path.basename(file)

        if (css.trim()) {
          allCSS += `\n/* ${path.relative(root, file)} */\n${css}`
        }

        // Write .css
        const cssPath = file.replace(CHAIN_FILE_RE, '.css')
        ensureDir(path.dirname(cssPath))
        fs.writeFileSync(cssPath, formatCSS(css, false), 'utf8')

        // Write .class.js
        const source = fs.readFileSync(file, 'utf8')
        const hasDynamic = source.includes('chain.dynamic()')

        const classPath = file.replace(CHAIN_FILE_RE, '.class.js')
        const classLines: string[] = [
          '/** ChainCSS Generated — DO NOT EDIT */',
          ''
        ]

        for (const [name, className] of Object.entries(classMap)) {
          classLines.push(`export const ${name} = '${className}'`)
        }

        if (hasDynamic) {
          classLines.push('')
          classLines.push('// Mixed mode: style objects for runtime use')
          classLines.push('// Import { useChainStyles } from "chaincss/runtime" to resolve dynamic values')
          for (const name of Object.keys(classMap)) {
            classLines.push(`export { ${name} as ${name}Styles }`)
          }
        }

        if (classLines.length > 2) {
          ensureDir(path.dirname(classPath))
          fs.writeFileSync(classPath, classLines.join('\n'), 'utf8')
        }

        if (verbose && !silent) {
          const classCount = Object.keys(classMap).length
          const cssSize = css.length
          const mode = hasDynamic ? 'mixed' : 'static'
          console.log(`[ChainCSS]   ✓ ${fileName} → ${classCount} class${classCount !== 1 ? 'es' : ''}, ${cssSize}B CSS [${mode}]`)
        }

        printDiagnostics(diagnostics, fileName)
        successCount++
      } catch (err) {
        error(`Failed: ${path.basename(file)} — ${(err as Error).message}`)
      }
    }

    const elapsed = Date.now() - startTime

    if (!silent) {
      const parts: string[] = [
        `Built ${successCount}/${chainFiles.length} files in ${elapsed}ms`
      ]
      if (!disablePipeline) parts.push('5-stage pipeline')
      if (totalDiagnostics > 0) parts.push(`${totalDiagnostics} diagnostic${totalDiagnostics !== 1 ? 's' : ''}`)
      if (totalAutoFixes > 0) parts.push(`${totalAutoFixes} auto-fix${totalAutoFixes !== 1 ? 'es' : ''}`)
      summary(parts.join(' • '))
    }

    if (pipelineReport && !disablePipeline && !silent) {
      console.log('')
      if (compiler.isPipelineEnabled()) {
        compiler.printPipelineReport()
      }
    }

    return allCSS
  }

  // =========================================================================
  // Plugin Hooks
  // =========================================================================

  return {
    name: 'chaincss',
    enforce: 'pre',

    resolveId(id) {
      if (id === 'vue') return '\0virtual:vue-shim'
      return null
    },

    load(id) {
      if (id === '\0virtual:vue-shim') {
        return `
          export const ref = (v) => ({ value: v });
          export const computed = (fn) => ({ get value() { return fn(); } });
          export const watch = () => {};
          export const onMounted = () => {};
          export const onUnmounted = () => {};
          export const inject = () => null;
          export const provide = () => {};
          export const reactive = (v) => v;
          export const h = () => null;
          export default {};
        `
      }
      return null
    },

    configResolved(config) {
      root = config.root
      const isProduction = config.mode === 'production'
      const preset = isProduction ? ENVIRONMENT_PRESETS.production : ENVIRONMENT_PRESETS.development

      compiler = new ChainCSSCompiler({
        ...DEFAULT_CONFIG,
        ...preset,
        atomic: {
          ...DEFAULT_CONFIG.atomic,
          ...preset.atomic,
          enabled: atomic
        },
        tokens: options.tokens || DEFAULT_CONFIG.tokens,
        output: {
          ...DEFAULT_CONFIG.output,
          minify: options.minify !== undefined ? options.minify : isProduction
        },
        breakpoints: options.breakpoints || DEFAULT_CONFIG.breakpoints,
        verbose,
        silent
      })

      if (disablePipeline) compiler.setPipelineEnabled(false)

      if (!silent) {
        const features: string[] = []
        if (!disablePipeline) features.push('5-stage pipeline')
        if (atomic) features.push('atomic CSS')
        if (options.tokens) features.push('design tokens')
        summary(`Initialized (${features.join(', ') || 'basic compilation'})`)
      }
    },

    async transform(code, id) {
      if (!CHAIN_FILE_RE.test(id)) return null

      try {
        const { classMap } = await compileFile(id)
        if (Object.keys(classMap).length === 0) return null

        const hasDynamic = code.includes('chain.dynamic()')

        if (hasDynamic) {
          const suffix = Object.entries(classMap)
            .map(([name, className]) => `export const ${name}Class = '${className}'`)
            .join('\n')

          const classPath = id.replace(CHAIN_FILE_RE, '.class.js')
          ensureDir(path.dirname(classPath))

          const classLines = [
            '/** ChainCSS Generated — DO NOT EDIT */',
            ''
          ]
          for (const [name, className] of Object.entries(classMap)) {
            classLines.push(`export const ${name}Class = '${className}'`)
          }
          fs.writeFileSync(classPath, classLines.join('\n'), 'utf8')

          return {
            code: code + '\n\n// ChainCSS auto-generated class names\n' + suffix,
            map: null
          }
        }

        const lines: string[] = [
          '// Auto-generated by ChainCSS Vite Plugin',
          '// DO NOT EDIT',
          ''
        ]
        for (const [name, className] of Object.entries(classMap)) {
          lines.push(`export const ${name} = '${className}'`)
        }

        const classPath = id.replace(CHAIN_FILE_RE, '.class.js')
        ensureDir(path.dirname(classPath))
        fs.writeFileSync(classPath, lines.join('\n'), 'utf8')

        return { code: lines.join('\n'), map: null }
      } catch (err) {
        error(`Transform failed for ${path.basename(id)}: ${(err as Error).message}`)
        return null
      }
    },

    configureServer(devServer: ViteDevServer) {
      devServer.httpServer?.once('listening', async () => {
        try {
          cssCache = await compileAllStyles()
        } catch (err) {
          error(`Build failed: ${(err as Error).message}`)
        }
      })

      devServer.middlewares.use('/__chaincss.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(cssCache || '/* ChainCSS: no styles yet */')
      })

      devServer.watcher.on('change', async (filePath: string) => {
        if (CHAIN_FILE_RE.test(filePath)) {
          log(`Change detected: ${path.basename(filePath)}`)
          await compileFile(filePath)
          cssCache = await compileAllStyles()

          const mod = devServer.moduleGraph.getModuleById(filePath)
          if (mod) devServer.moduleGraph.invalidateModule(mod)

          devServer.ws.send({ type: 'full-reload' })
        }
      })
    },

    async generateBundle(_opts: any, bundle: any) {
      // Compile all styles and emit as a static CSS asset
      const css = await compileAllStyles();
      if (css && css.trim()) {
        this.emitFile({
          type: "asset",
          fileName: "assets/chaincss.css",
          source: css,
        });
      }
    },

    transformIndexHtml() {
      return [{
        tag: 'link',
        attrs: {
          rel: 'stylesheet',
          href: '/assets/chaincss.css',
          'data-chaincss': ''
        },
        injectTo: 'head'
      }];
    }
  }
}