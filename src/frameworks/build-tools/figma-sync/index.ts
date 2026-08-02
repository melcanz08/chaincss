// ============================================================================
// FILE: src/frameworks/build-tools/figma-sync/index.ts
// ============================================================================
export type Plugin = any;
export type ViteDevServer = any;
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface FigmaSyncOptions {
  mode?: 'url' | 'figmaVariables' | 'figmaApi'
  url?: string
  fileId?: string
  token?: string 
  tokenSet?: string 
  output?: string 
  pollMs?: number 
  autoFix?: boolean 
  verbose?: boolean
  debounceMs?: number
}

function hash(str: string) { return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16) }

async function fetchUrl(url: string, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Accept': 'application/json' }
  if (token && url.includes("figma.com")) headers["X-Figma-Token"] = token
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`)
  return await res.json()
}

async function fetchFigmaVariables(fileId: string, token: string): Promise<any> {
  const url = `https://api.figma.com/v1/files/${fileId}/variables/local`
  const data = await fetchUrl(url, token)
  const tokens: Record<string, any> = {}
  const vars = data?.meta?.variables || data?.variables || {}
  
  for (const [id, v] of Object.entries(vars)) {
    const name = (v as any).name?.replace(/\//g, '.').replace(/\s+/g, '-').toLowerCase() || id
    const valuesByMode = (v as any).valuesByMode || {}
    const firstModeId = Object.keys(valuesByMode)[0]
    let value = valuesByMode[firstModeId]
    
    if (value && typeof value === 'object' && 'type' in value) continue
    
    if (value && typeof value === 'object' && 'r' in value) {
      const r = Math.round(value.r * 255), g = Math.round(value.g * 255), b = Math.round(value.b * 255)
      value = `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
    }
    tokens[name] = value
  }
  return tokens
}

export function figmaSyncPlugin(opts: FigmaSyncOptions = {}): Plugin {
  const mode = opts.mode || (opts.url ? 'url' : opts.fileId ? 'figmaVariables' : 'url')
  const pollMs = opts.pollMs ?? 5000
  const outputFile = opts.output || 'tokens.json'
  const verbose = !!opts.verbose

  let root = ''
  let devServer: ViteDevServer | null = null
  let timer: NodeJS.Timeout | null = null
  let lastHash = ''
  let lastConfigMtime = 0
  let cachedRelationships: any[] = []

  const log = (m: string) => { if (verbose) console.log(`[FigmaSync] ${m}`) }
  const logOk = (m: string) => console.log(`\x1b[32m[FigmaSync] ${m}\x1b[0m`)
  const logErr = (m: string) => console.error(`\x1b[31m[FigmaSync] ${m}\x1b[0m`)

  async function loadRelationships(): Promise<any[]> {
    try {
      const configPathJs = path.join(root, 'chaincss.config.js')
      if (!fs.existsSync(configPathJs)) return []

      const stat = fs.statSync(configPathJs)
      // Only perform import cycle if file has physically been changed
      if (stat.mtimeMs > lastConfigMtime) {
        lastConfigMtime = stat.mtimeMs
        const url = `file://${configPathJs}?t=${stat.mtimeMs}`
        const configMod = await import(url)
        const cfg = configMod?.default || configMod || {}
        cachedRelationships = cfg.tokens?.relationships || cfg.entanglement?.relationships || []
      }
      return cachedRelationships;
    } catch { 
      return cachedRelationships 
    }
  }

  async function fetchTokens(): Promise<any> {
    if (mode === 'url') {
      if (!opts.url) throw new Error('url mode requires opts.url')
      return await fetchUrl(opts.url)
    }
    if (mode === 'figmaVariables') {
      if (!opts.fileId || !opts.token) throw new Error('figmaVariables mode requires fileId and token')
      return await fetchFigmaVariables(opts.fileId, opts.token)
    }
    if (mode === 'figmaApi') {
      throw new Error('figmaApi legacy mode is currently unsupported. Use figmaVariables mode instead.')
    }
    throw new Error(`Unknown mode ${mode}`)
  }

  async function syncOnce() {
    try {
      const raw = await fetchTokens()
      const rawStr = JSON.stringify(raw)
      const h = hash(rawStr)
      if (h === lastHash) { log('No change'); return }
      lastHash = h
      log(`Fetched ${rawStr.length} bytes, hash ${h}`)

      let flat: any = raw
      try {
        const { importFigmaTokens } = await import('@compiler/tokens/design-orchestrator.js')
        const isFigmaLike = !!(raw.$themes || raw.$metadata || Object.values(raw).some((v: any) => v && typeof v === 'object' && '$value' in v))
        if (isFigmaLike) flat = importFigmaTokens(raw)
      } catch {}

      let outTokens = flat
      try {
        const { TokenEntanglementEngine } = await import('@compiler/tokens/entanglement.js')
        const relationships = await loadRelationships()
        if (relationships.length) {
          const engine = new TokenEntanglementEngine(relationships)
          const report = engine.fixAll(flat)
          if (report.changes.length) {
            logOk(`Entanglement fixed ${report.changes.length} tokens`)
          }
          outTokens = report.tokens
        } else {
          log('No relationships found, skipping entanglement')
        }
      } catch (e: any) {
        log(`Entanglement execution bypassed: ${e.message}`)
      }

      const absOut = path.isAbsolute(outputFile) ? outputFile : path.join(root, outputFile)
      fs.mkdirSync(path.dirname(absOut), { recursive: true })
      fs.writeFileSync(absOut, JSON.stringify(outTokens, null, 2), 'utf8')
      logOk(`Wrote ${path.relative(root, absOut)} (${Object.keys(outTokens).length} tokens)`)

      if (devServer?.ws) {
        devServer.ws.send({ type: 'custom', event: 'chaincss:tokens-updated', data: { file: absOut, hash: h, timestamp: Date.now() } })
        devServer.ws.send({ type: 'custom', event: 'chaincss-update', data: { timestamp: Date.now() } })
        for (const mod of devServer.moduleGraph.fileToModulesMap.values()) {
          for (const m of mod) {
            if (m.id && m.id.includes('.chain.')) devServer.moduleGraph.invalidateModule(m)
          }
        }
      }
    } catch (e: any) {
      logErr(`Sync failed: ${e.message}`)
    }
  }

  return {
    name: 'chaincss:figma-sync',
    enforce: 'pre',

    configResolved(config: any) {
      root = config.root || process.cwd()
    },

    async buildStart() {
      if (process.env.NODE_ENV === 'production' || (this as any).meta?.watchMode === false) {
        await syncOnce()
      }
    },

    configureServer(server: any) {
      devServer = server
      syncOnce()

      if (timer) clearInterval(timer)
      timer = setInterval(syncOnce, pollMs)
      timer.unref()

      server.middlewares.use('/__figma-sync', async (_req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json')
        await syncOnce()
        res.end(JSON.stringify({ ok: true, hash: lastHash, timestamp: Date.now() }))
      })

      logOk(`Watching Figma source (mode=${mode}, poll=${pollMs}ms) -> ${outputFile}`)
    },

    closeBundle() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }
}

export default figmaSyncPlugin

// Example vite.config.ts usage:
//import { defineConfig } from 'vite'
//import chaincss from './src/plugins/vite.ts'
//import { figmaSyncPlugin } from './src/plugins/figma-sync.ts' // Explicit named hook

//export default defineConfig({
//  plugins: [
      // Must be placed before chaincss so files are bootstrapped on build/dev spin-up
//    figmaSyncPlugin({
//      mode: 'url',
//      url: 'https://raw.githubusercontent.com/your-org/design-tokens/main/tokens.json',
//      output: 'tokens.json',
//      pollMs: 3000,
//      autoFix: true,
//      verbose: true
//    }),
//    chaincss({ verbose: true })
//  ]
//  })

// Alternative - Figma Variables mode:
// figmaSyncPlugin({
//   mode: 'figmaVariables',
//   fileId: 'abc123DEF456',
//   token: process.env.FIGMA_TOKEN!, // personal access token
//   output: 'tokens.json',
//   pollMs: 10000
// })