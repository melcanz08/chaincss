// src/plugins/figma-sync.ts — ChainCSS Figma Sync Plugin v1.0
// Direct Figma -> ChainCSS without manual export. Only possible because ChainCSS has Entanglement Engine.
// Supports 3 modes:
// 1. url: Tokens Studio -> GitHub -> raw.githubusercontent URL (recommended)
// 2. figmaVariables: Figma Variables API (Figma's native variables, no plugin needed)
// 3. figmaApi: Legacy Figma file styles API

import type { Plugin, ViteDevServer } from 'vite'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

export interface FigmaSyncOptions {
  mode?: 'url' | 'figmaVariables' | 'figmaApi'
  // url mode: raw JSON URL from Tokens Studio GitHub sync
  url?: string
  // figma modes
  fileId?: string
  token?: string // FIGMA_TOKEN or X-Figma-Token
  tokenSet?: string // e.g. 'global', 'light', 'dark'
  // output
  output?: string // default: tokens.json or src/tokens.json
  pollMs?: number // default 5000
  autoFix?: boolean // run entanglement autoFix, default true
  verbose?: boolean
  debounceMs?: number
}

function hash(str: string) { return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16) }

async function fetchUrl(url: string, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Accept': 'application/json' }
  if (token) headers['X-Figma-Token'] = token
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`)
  return await res.json()
}

async function fetchFigmaVariables(fileId: string, token: string): Promise<any> {
  // Figma Variables API - https://api.figma.com/v1/files/:fileId/variables/local
  const url = `https://api.figma.com/v1/files/${fileId}/variables/local`
  const data = await fetchUrl(url, token)
  // data.meta.variables is Record<id, { name, variableCollectionId, valuesByMode, ... }>
  // Convert to flat tokens: collections become prefixes
  const tokens: Record<string, any> = {}
  const vars = data?.meta?.variables || data?.variables || {}
  for (const [id, v] of Object.entries(vars as any)) {
    const name = (v as any).name?.replace(/\//g, '.').replace(/\s+/g, '-').toLowerCase() || id
    const valuesByMode = (v as any).valuesByMode || {}
    const firstModeId = Object.keys(valuesByMode)[0]
    let value = valuesByMode[firstModeId]
    // Figma variables can be alias { type: 'VARIABLE_ALIAS', id: ... } - skip for now, keep raw
    if (value && typeof value === 'object' && 'type' in value) continue
    // RGBA is { r,g,b,a } 0-1
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
  const autoFix = opts.autoFix !== false

  let root = ''
  let devServer: ViteDevServer | null = null
  let timer: NodeJS.Timeout | null = null
  let lastHash = ''

  const log = (m: string) => { if (verbose) console.log(`[FigmaSync] ${m}`) }
  const logOk = (m: string) => console.log(`\x1b[32m[FigmaSync] ${m}\x1b[0m`)
  const logErr = (m: string) => console.error(`\x1b[31m[FigmaSync] ${m}\x1b[0m`)

  async function loadRelationships(): Promise<any[]> {
    try {
      // dynamic import config, avoid circular
      const configPathTs = path.join(root, 'chaincss.config.ts')
      const configPathJs = path.join(root, 'chaincss.config.js')
      let configMod: any = null
      if (fs.existsSync(configPathJs)) {
        const url = `file://${configPathJs}?t=${Date.now()}`
        configMod = await import(url)
      }
      const cfg = configMod?.default || configMod || {}
      return cfg.tokens?.relationships || cfg.entanglement?.relationships || []
    } catch { return [] }
  }

  async function fetchTokens(): Promise<any> {
    if (mode === 'url') {
      if (!opts.url) throw new Error('url mode requires opts.url (e.g. https://raw.githubusercontent.com/org/repo/main/tokens.json)')
      return await fetchUrl(opts.url)
    }
    if (mode === 'figmaVariables') {
      if (!opts.fileId || !opts.token) throw new Error('figmaVariables mode requires fileId and token')
      return await fetchFigmaVariables(opts.fileId, opts.token)
    }
    if (mode === 'figmaApi') {
      if (!opts.fileId || !opts.token) throw new Error('figmaApi requires fileId and token')
      // Fallback to variables API
      return await fetchFigmaVariables(opts.fileId, opts.token)
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

      // Convert Figma/Tokens Studio format to flat tokens
      let flat: any = raw
      try {
        const { importFigmaTokens } = await import('../compiler/tokens/design-orchestrator.js')
        const isFigmaLike = !!(raw.$themes || raw.$metadata || Object.values(raw).some((v: any) => v && typeof v === 'object' && '$value' in v))
        if (isFigmaLike) flat = importFigmaTokens(raw)
      } catch {}

      // Run entanglement if available
      let outTokens = flat
      try {
        const { TokenEntanglementEngine } = await import('../compiler/tokens/entanglement.js')
        const relationships = await loadRelationships()
        if (relationships.length) {
          const engine = new TokenEntanglementEngine(relationships)
          const report = engine.fixAll(flat)
          if (report.changes.length) {
            logOk(`Entanglement fixed ${report.changes.length} tokens`)
            for (const c of report.changes) log(`  ${c.path}: ${c.from} -> ${c.to}`)
          }
          outTokens = report.tokens
        } else {
          log('No relationships, skipping entanglement, writing raw tokens')
        }
      } catch (e: any) {
        log(`Entanglement not available: ${e.message}, writing raw`)
      }

      const absOut = path.isAbsolute(outputFile) ? outputFile : path.join(root, outputFile)
      fs.mkdirSync(path.dirname(absOut), { recursive: true })
      fs.writeFileSync(absOut, JSON.stringify(outTokens, null, 2), 'utf8')
      logOk(`Wrote ${path.relative(root, absOut)} (${Object.keys(outTokens).length} tokens)`)

      // Trigger ChainCSS HMR - the existing vite.ts watcher will see tokens.json change if it's watched,
      // but we also send a custom event to force ChainCSS CSS rebuild
      if (devServer) {
        devServer.ws.send({ type: 'custom', event: 'chaincss:tokens-updated', data: { file: absOut, hash: h, timestamp: Date.now() } })
        // Also trigger chaincss-update so /__chaincss.css is refetched
        devServer.ws.send({ type: 'custom', event: 'chaincss-update', data: { timestamp: Date.now() } })
        // Invalidate chain files that might depend on tokens
        for (const mod of devServer.moduleGraph.fileToModulesMap.values()) {
          for (const m of mod) {
            if (m.id && m.id.includes('.chain.')) devServer.moduleGraph.invalidateModule(m)
          }
        }
      }
    } catch (e: any) {
      logErr(`Sync failed: ${e.message}`)
      if (verbose && e.stack) console.error(e.stack)
    }
  }

  return {
    name: 'chaincss:figma-sync',
    enforce: 'pre',

    configResolved(config) {
      root = config.root || process.cwd()
    },

    async buildStart() {
      // Production build: sync once before build
      if (process.env.NODE_ENV === 'production' || (this as any).meta?.watchMode === false) {
        await syncOnce()
      }
    },

    configureServer(server) {
      devServer = server
      // Initial sync
      syncOnce()

      // Polling loop
      timer = setInterval(syncOnce, pollMs)

      // Expose endpoint to manually trigger sync via fetch('/__figma-sync')
      server.middlewares.use('/__figma-sync', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        await syncOnce()
        res.end(JSON.stringify({ ok: true, hash: lastHash, timestamp: Date.now() }))
      })

      logOk(`Watching Figma source (mode=${mode}, poll=${pollMs}ms) -> ${outputFile}`)
      if (mode === 'url') log(`  URL: ${opts.url}`)
      if (mode === 'figmaVariables') log(`  File: ${opts.fileId}, tokenSet: ${opts.tokenSet || 'default'}`)
    },

    closeBundle() {
      if (timer) clearInterval(timer)
      timer = null
    }
  }
}

export default figmaSyncPlugin
// Example vite.config.ts usage:
// import { defineConfig } from 'vite'
// import chaincss from './src/plugins/vite.ts'
// import figmaSync from './src/plugins/figma-sync.ts'
// export default defineConfig({
//   plugins: [
//     figmaSync({
//       mode: 'url',
//       url: 'https://raw.githubusercontent.com/your-org/design-tokens/main/tokens.json',
//       output: 'tokens.json',
//       pollMs: 3000,
//       autoFix: true,
//       verbose: true
//     }),
//     chaincss({ verbose: true })
//   ]
// })
//
// Figma Variables mode:
// figmaSync({
//   mode: 'figmaVariables',
//   fileId: 'abc123DEF456',
//   token: process.env.FIGMA_TOKEN!, // personal access token
//   output: 'tokens.json',
//   pollMs: 10000
// })

