// chaincss/src/plugins/vite.ts

import type { Plugin, ViteDevServer } from 'vite'
import path from 'path'
import fs from 'fs'
import { promises as fsp } from 'fs'
import { ChainCSSCompiler } from '../core/compiler.js'
import { formatCSS, ensureDir } from '../core/utils.js'
import { DEFAULT_CONFIG, ENVIRONMENT_PRESETS } from '../core/constants.js'
import type { ChainCSSConfig } from '../core/types.js'
import { createPipeline } from '../compiler/pipeline/unified-pipeline.js';
import { serializeForInspector } from '../compiler/pipeline/inspector/serializer.js';
import type { InspectorDiagnostic } from '../compiler/pipeline/inspector/types.js';

import { InspectorStore } from '../compiler/pipeline/inspector/store.js';

const CHAIN_FILE_RE = /\.chain\.(ts|js)x?$/

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Plugin
// ============================================================================

export default function chaincssPlugin(options: ChainCSSPluginOptions = {}): Plugin {
  const verbose = options.verbose !== false
  const pipelineReport = options.pipelineReport ?? verbose
  const silent = options.silent ?? false
  const disablePipeline = options.disablePipeline ?? false
  const atomic = options.atomic ?? true

  let compiler: ChainCSSCompiler
  let root: string = ''
  let isProduction = false
  let cssCache = ''
  const cssFileCache = new Map<string, string>()
  const inspectorStore = new InspectorStore();
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

  async function compileFile(chainPath: string): Promise<{
    css: string
    classMap: Record<string, string>
    diagnostics: InspectorDiagnostic[]
    rawResults: any
  }> {
    const results = await compiler.compileFile(chainPath)
    let css = ''
    const classMap: Record<string, string> = {}
    const allDiagnostics: InspectorDiagnostic[] = []

    for (const [name, compileResult] of Object.entries(results)) {
      const diags = (compileResult.inspector?.diagnostics || []) as InspectorDiagnostic[];
      if (diags.length > 0) {
        for (const d of diags) {
          allDiagnostics.push({ ...d })
        }
      }

      if (compileResult.css) {
        css += compileResult.css + '\n'
      }

      const className = Object.values(compileResult.classMap)[0]
      if (className) {
        classMap[name] = className
      }

      const inspector = compileResult.inspector;
      if (inspector?.ir) {
        const rules = serializeForInspector(
          inspector.ir,
          inspector.pipelineReport || [],
          inspector.diagnostics || [],
          chainPath,
          name
        );
        inspectorStore.addAll(rules);
      }
    }

    return { css, classMap, diagnostics: allDiagnostics, rawResults: results }
  }

  function printDiagnostics(diagnostics: InspectorDiagnostic[], fileName: string) {
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
    cssFileCache.clear()
    inspectorStore.clear();

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
        const rawResults = await compiler.compileFile(file)  // Single compilation — rawResults from compileFile above
        const fileName = path.basename(file)

        if (css.trim()) {
          allCSS += `\n/* ${path.relative(root, file)} */\n${css}`
          cssFileCache.set(file, css)
        }

        const cssPath = file.replace(CHAIN_FILE_RE, '.css')
        ensureDir(path.dirname(cssPath))
        fsp.writeFile(cssPath, formatCSS(css, false), 'utf8').catch(() => {})

        const source = fs.readFileSync(file, 'utf8')
        const hasDynamic = source.includes('chain.dynamic()')

        const classPath = file.replace(CHAIN_FILE_RE, '.class.js')
        const classLines: string[] = [
          '/** ChainCSS Generated — DO NOT EDIT */',
          ''
        ]

        for (const [name, className] of Object.entries(classMap)) {
          // Check if this style has dynamic functions
          const compileResult = Object.values(rawResults).find((r: any) => 
            r.classMap && Object.values(r.classMap)[0] === className
          );
          if ((compileResult as any)?.dynamic && Object.keys((compileResult as any).dynamic).length > 0) {
            const fnEntries: string[] = [];
            for (const [prop, fn] of Object.entries((compileResult as any).dynamic)) {
              fnEntries.push(`${prop}: ${(fn as Function).toString()}`);
            }
            classLines.push(`export const ${name} = { className: '${className}', dynamic: { ${fnEntries.join(', ')} } };`);
          } else {
            classLines.push(`export const ${name} = '${className}'`);
          }
        }

        if (classLines.length > 2) {
          ensureDir(path.dirname(classPath))
          fsp.writeFile(classPath, classLines.join('\n'), 'utf8').catch(() => {})
        }

        if (verbose && !silent) {
          const classCount = Object.keys(classMap).length
          const cssSize = css.length
          const modeLabel = hasDynamic ? 'mixed' : 'static'
          console.log(`[ChainCSS]   ✓ ${fileName} → ${classCount} class${classCount !== 1 ? 'es' : ''}, ${cssSize}B CSS [${modeLabel}]`)
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

  function exportIRData() {
      return inspectorStore.export();
  }

  // =========================================================================
  // Plugin Hooks
  // =========================================================================

  let base = '/';
  return {
    name: 'chaincss',
    enforce: 'pre',

    resolveId(id) {
      if (id === 'virtual:chaincss-vue-shim') return '\0virtual:chaincss-vue-shim'
      return null
    },

    load(id) {
      if (id === '\0virtual:chaincss-vue-shim') {
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
      isProduction = config.mode === 'production'
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

      // Use appropriate pipeline for the environment
      const presetName = isProduction ? 'production' : 'default';
      const envPipeline = createPipeline(presetName);
      (compiler as any).pipeline = envPipeline;
      compiler.setPipelineEnabled(true);

      if (!silent) {
        const features: string[] = []
        features.push('5-stage CI pipeline')
        if (atomic) features.push('atomic CSS')
        if (options.tokens) features.push('design tokens')
        summary(`Initialized (${features.join(', ') || 'basic compilation'})`)
      }
    },

    async transform(code, id) {
      if (!CHAIN_FILE_RE.test(id)) return null

      try {
        const results = await compiler.compileFile(id)
        if (Object.keys(results).length === 0) return null

        const hasDynamic = code.includes('chain.dynamic()')
        const classMap: Record<string, string> = {}

        for (const [name, result] of Object.entries(results)) {
          const className = Object.values(result.classMap)[0]
          if (className) classMap[name] = className
        }

        const lines: string[] = [
          '// Auto-generated by ChainCSS Vite Plugin',
          '// DO NOT EDIT',
          ''
        ]
        for (const [name, className] of Object.entries(classMap)) {
          const result = results[name];
          if (result?.dynamic && Object.keys(result.dynamic).length > 0) {
            const fnEntries: string[] = [];
            for (const [prop, fn] of Object.entries((result as any).dynamic)) {
              fnEntries.push(`${prop}: ${(fn as Function).toString()}`);
            }
            lines.push(`export const ${name} = { className: '${className}', dynamic: { ${fnEntries.join(', ')} } };`);
          } else {
            lines.push(`export const ${name} = '${className}'`);
          }
        }

        const classPath = id.replace(CHAIN_FILE_RE, '.class.js')
        ensureDir(path.dirname(classPath))
        fsp.writeFile(classPath, lines.join('\n'), 'utf8').catch(() => {})

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
          try {
            const { css } = await compileFile(filePath)
            cssFileCache.set(filePath, css)
            // Incremental: join cached values instead of re-scanning all files
            cssCache = Array.from(cssFileCache.values()).join('\n')

            // Invalidate Vite's module graph for this file
            const mod = devServer.moduleGraph.getModuleById(filePath)
            if (mod) devServer.moduleGraph.invalidateModule(mod)

            // Hot-update CSS without full page reload (preserves app state)
            devServer.ws.send({
              type: 'custom',
              event: 'chaincss-update',
              data: { url: '/__chaincss.css', timestamp: Date.now() }
            })
          } catch (err) {
            error(`Recompile failed: ${(err as Error).message}`)
          }
        }
      })

      devServer.middlewares.use('/__chaincss-ir.json', (_req, res) => {
        const irData = exportIRData();
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(JSON.stringify(irData || {}))
      })
    },

    async generateBundle(_opts: any, bundle: any) {
      // Stitch CSS from in-memory cache (populated during transform)
      const css = Array.from(cssFileCache.values()).filter(Boolean).join('\n');
      if (css && css.trim()) {
        this.emitFile({
          type: "asset",
          fileName: "assets/chaincss.css",
          source: css,
        });
      }

      const irData = exportIRData();
      if (irData) {
        this.emitFile({
          type: "asset",
          fileName: "assets/chaincss-ir.json",
          source: JSON.stringify(irData),
        });
      }
    },

    transformIndexHtml() {
      return [
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: isProduction ? `${base}assets/chaincss.css` : '/__chaincss.css',
            'data-chaincss': '',
            id: 'chaincss-styles'
          },
          injectTo: 'head'
        },
        // Client-side HMR: hot-updates CSS without full page reload
        {
          tag: 'script',
          children: `
            if (import.meta.hot) {
              import.meta.hot.on('chaincss-update', () => {
                const link = document.getElementById('chaincss-styles');
                if (link) link.href = '/__chaincss.css?t=' + Date.now();
              });
            }
          `,
          injectTo: 'head'
        }
      ];
    }
  }
}