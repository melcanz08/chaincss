// src/cli/commands/entanglement.ts — Live Figma Tokens Studio -> ChainCSS entanglement watcher
// Watches tokens.json (or Figma export) and auto propagates derived + contrast fixes

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'
import { createLogger } from '../utils/logger.js'
import { TokenEntanglementEngine, type Relationship } from '../../compiler/tokens/entanglement.js'
import { importFigmaTokens } from '../../compiler/tokens/design-orchestrator.js'

interface EntanglementOptions {
  input?: string
  output?: string
  watch?: boolean
  figma?: boolean
  fix?: boolean
  verbose?: boolean
  debounceMs?: number
}

function findTokensFile(root: string, explicit?: string): string | null {
  if (explicit) { const p = path.isAbsolute(explicit) ? explicit : path.join(root, explicit); return fs.existsSync(p) ? p : null }
  const cands = ['tokens.json','figma-tokens.json','design-tokens.json','src/tokens.json','tokens/tokens.json','.chaincss/tokens.json','theme.json']
  for (const c of cands) { const p = path.join(root, c); if (fs.existsSync(p)) return p }
  return null
}

function loadTokens(filePath: string, isFigma?: boolean): { raw: any; flat: Record<string, any> } {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const isFigmaFormat = isFigma || !!raw.$themes || Object.values(raw).some((v: any) => v && typeof v === 'object' && '$value' in v)
  const flat = isFigmaFormat ? importFigmaTokens(raw) : raw.tokens || raw.values || raw
  // if flat is still nested, keep as nested object for path resolution, engine supports dot paths
  return { raw, flat: flat as any }
}

function detectChanges(oldTokens: any, newTokens: any, prefix = ''): string[] {
  const changed: string[] = []
  const keys = new Set([...Object.keys(oldTokens || {}), ...Object.keys(newTokens || {})])
  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k
    const ov = oldTokens?.[k], nv = newTokens?.[k]
    if (ov && typeof ov === 'object' && nv && typeof nv === 'object' && !('value' in ov) && typeof ov !== 'string') {
      changed.push(...detectChanges(ov, nv, path))
    } else if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      changed.push(path)
    }
  }
  return changed
}

export async function entanglementCommand(opts: EntanglementOptions = {}) {
  const logger = createLogger(!!opts.verbose)
  const root = process.cwd()
  const inputPath = findTokensFile(root, opts.input)
  if (!inputPath) { logger.error('[entanglement] No tokens file found. Use --input tokens.json'); process.exit(1) }

  const outputPath = opts.output ? (path.isAbsolute(opts.output) ? opts.output : path.join(root, opts.output)) : inputPath

  logger.info('[entanglement] Loading config...')
  const config: any = await loadConfig()
  const relationships: Relationship[] = config.tokens?.relationships || config.entanglement?.relationships || []
  if (!relationships.length) { logger.warn('[entanglement] No relationships found in chaincss.config.ts -> tokens.relationships. Using empty set, only contrast fix will run if --fix.') }

  const engine = new TokenEntanglementEngine(relationships)

  let lastTokens: any = null

  const run = async (changedFile?: string) => {
    try {
      const { raw, flat } = loadTokens(inputPath, opts.figma)
      const tokensObj = flat

      if (!lastTokens) {
        // first run: just fixAll and propagate derived
        const report = engine.fixAll(tokensObj)
        if (report.changes.length) {
          logger.success(`[entanglement] Fixed ${report.changes.length} tokens`)
          for (const c of report.changes) logger.info(`  ${c.path}: ${c.from} -> ${c.to} (${c.reason})`)
          // write back preserving original format if Figma
          let out: any = report.tokens
          if (raw.$themes || opts.figma) {
            // merge back into original structure, keep $themes
            out = raw
            for (const ch of report.changes) {
              const parts = ch.path.split('.'); let cur = out
              for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]]) cur[parts[i]] = {}; cur = cur[parts[i]] }
              const last = parts[parts.length - 1]
              if (cur[last] && typeof cur[last] === 'object' && '$value' in cur[last]) cur[last].$value = ch.to
              else if (cur[last] && typeof cur[last] === 'object' && 'value' in cur[last]) cur[last].value = ch.to
              else cur[last] = ch.to
            }
          }
          fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8')
          logger.success(`[entanglement] Wrote ${path.relative(root, outputPath)}`)
        } else {
          logger.success('[entanglement] All tokens valid, no changes needed')
        }
        lastTokens = tokensObj
        return
      }

      // watch mode: detect which token changed
      const changedPaths = detectChanges(lastTokens, tokensObj)
      if (!changedPaths.length) return

      logger.info(`[entanglement] Detected change in ${changedPaths.join(', ')}${changedFile ? ` (${path.basename(changedFile)})` : ''}`)

      let workingTokens = { ...tokensObj }
      let allChanges: any[] = []

      // propagate from each changed path in order
      for (const changedPath of changedPaths) {
        const newVal = (() => { let cur: any = tokensObj; for (const p of changedPath.split('.')) cur = cur?.[p]; return cur && typeof cur === 'object' && 'value' in cur ? cur.value : cur })()
        if (!newVal || typeof newVal !== 'string') continue
        const rep = engine.propagate(workingTokens, changedPath, String(newVal), { autoFixContrast: opts.fix !== false })
        workingTokens = rep.tokens
        allChanges.push(...rep.changes)
        if (rep.violations.length && opts.verbose) {
          for (const v of rep.violations) logger.warn(`  ⚠ ${v.message}`)
        }
      }

      if (allChanges.length) {
        for (const c of allChanges) logger.info(`  ${c.path}: ${c.from} -> ${c.to} (${c.reason})`)
        fs.writeFileSync(outputPath, JSON.stringify(workingTokens, null, 2), 'utf8')
        logger.success(`[entanglement] Propagated ${allChanges.length} changes -> ${path.relative(root, outputPath)}`)
      }

      lastTokens = workingTokens
    } catch (e: any) {
      logger.error(`[entanglement] Failed: ${e.message}`)
      if (opts.verbose) console.error(e.stack)
    }
  }

  await run()

  if (!opts.watch) return

  const debounceMs = opts.debounceMs ?? 150
  let timer: NodeJS.Timeout | null = null
  logger.info(`[entanglement] Watching ${path.relative(root, inputPath)} for changes... (Ctrl+C to exit)`)

  fs.watch(inputPath, { persistent: true }, (_event, filename) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => run(filename || undefined), debounceMs)
  })

  // also watch config for relationship changes
  const configPath = path.join(root, 'chaincss.config.ts')
  const configJs = path.join(root, 'chaincss.config.js')
  const cfgFile = fs.existsSync(configPath) ? configPath : fs.existsSync(configJs) ? configJs : null
  if (cfgFile) {
    fs.watch(cfgFile, () => {
      logger.info('[entanglement] Config changed, reloading relationships...')
      loadConfig().then((c: any) => {
        const rels = c.tokens?.relationships || []
        engine.addMany(rels.filter((r: any) => !relationships.some((e: any) => JSON.stringify(e) === JSON.stringify(r))))
        logger.success(`[entanglement] Reloaded ${rels.length} relationships`)
      }).catch(()=>{})
    })
  }
}

export default entanglementCommand

