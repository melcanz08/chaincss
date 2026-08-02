// ============================================================================
// FILE: src/adapters/cli/commands/entanglement.ts
// ============================================================================

import fs from 'fs'
import path from 'path'
import { loadConfig } from "../utils/config-loader.js"
import { createLogger } from "@shared/logger/index.js"
import { TokenEntanglementEngine, type Relationship } from '@compiler/tokens/entanglement.js'
import { importFigmaTokens } from '@compiler/tokens/design-orchestrator.js'

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
  if (explicit) {
    const p = path.isAbsolute(explicit) ? explicit : path.join(root, explicit)
    return fs.existsSync(p) ? p : null
  }
  const cands = ['tokens.json', 'figma-tokens.json', 'design-tokens.json', 'src/tokens.json', 'tokens/tokens.json', '.chaincss/tokens.json', 'theme.json']
  for (const c of cands) {
    const p = path.join(root, c)
    if (fs.existsSync(p)) return p
  }
  return null
}

function loadTokens(filePath: string, isFigma?: boolean): { raw: any; flat: Record<string, any> } {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const isFigmaFormat = isFigma || !!raw.$themes || Object.values(raw).some((v: any) => v && typeof v === 'object' && '$value' in v)
  const flat = isFigmaFormat ? importFigmaTokens(raw) : raw.tokens || raw.values || raw
  return { raw, flat: flat as any }
}

/**
 * Deep merges mutated token changes back into original formatted wrapper configuration to prevent data loss.
 */
function mergeChangesBack(raw: any, changes: any[], flatTokens: any, isFigma: boolean): any {
  const isFigmaFormat = isFigma || !!raw.$themes || Object.values(raw).some((v: any) => v && typeof v === 'object' && '$value' in v)
  const out = JSON.parse(JSON.stringify(raw))

  if (isFigmaFormat || raw.tokens || raw.values) {
    for (const ch of changes) {
      const parts = ch.path.split('.')
      let cur = out

      if (!isFigmaFormat && raw.tokens && !parts[0].startsWith('tokens')) {
        if (cur.tokens) cur = cur.tokens
      } else if (!isFigmaFormat && raw.values && !parts[0].startsWith('values')) {
        if (cur.values) cur = cur.values
      }

      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {}
        cur = cur[parts[i]]
      }

      const last = parts[parts.length - 1]
      if (cur[last] && typeof cur[last] === 'object') {
        if ('$value' in cur[last]) {
          cur[last].$value = ch.to
        } else if ('value' in cur[last]) {
          cur[last].value = ch.to
        } else {
          cur[last] = ch.to
        }
      } else {
        cur[last] = ch.to
      }
    }
    return out
  }

  return flatTokens
}

/**
 * Optimized leaf-level value comparison avoiding heavy deep stringifications or reference mismatches.
 */
function detectChanges(oldTokens: any, newTokens: any, prefix = ''): string[] {
  const changed: string[] = []
  const keys = new Set([...Object.keys(oldTokens || {}), ...Object.keys(newTokens || {})])

  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k
    const ov = oldTokens?.[k]
    const nv = newTokens?.[k]

    const ovIsObj = ov && typeof ov === 'object'
    const nvIsObj = nv && typeof nv === 'object'

    if (ovIsObj && nvIsObj) {
      const isTokenNode = ('value' in ov || '$value' in ov) && ('value' in nv || '$value' in nv)
      if (isTokenNode) {
        const ovVal = ov.value !== undefined ? ov.value : ov.$value
        const nvVal = nv.value !== undefined ? nv.value : nv.$value
        if (ovVal !== nvVal) {
          changed.push(path)
        }
      } else {
        changed.push(...detectChanges(ov, nv, path))
      }
    } else if (!ovIsObj && !nvIsObj) {
      // Direct primitive comparison
      if (ov !== nv) {
        changed.push(path)
      }
    } else {
      // Type mismatch (one is an object structure, one is a primitive)
      changed.push(path)
    }
  }
  return changed
}

export async function entanglementCommand(opts: EntanglementOptions = {}) {
  const logger = createLogger(!!opts.verbose)
  const root = process.cwd()
  const inputPath = findTokensFile(root, opts.input)
  if (!inputPath) {
    logger.error('[entanglement] No tokens file found. Use --input tokens.json')
    process.exit(1)
  }

  const outputPath = opts.output ? (path.isAbsolute(opts.output) ? opts.output : path.join(root, opts.output)) : inputPath

  logger.info('[entanglement] Loading config...')
  const config: any = await loadConfig()
  let relationships: Relationship[] = config.tokens?.relationships || config.entanglement?.relationships || []
  if (!relationships.length) {
    logger.warn('[entanglement] No relationships found in chaincss.config.ts -> tokens.relationships.')
  }

  let engine = new TokenEntanglementEngine(relationships)
  let lastTokens: any = null
  let isWriting = false // State-gate to block self-induced file changes in watch-mode

  const run = async (changedFile?: string) => {
    try {
      const { raw, flat } = loadTokens(inputPath, opts.figma)
      const tokensObj = flat

      if (!lastTokens) {
        // First run: Propagate design tokens & establish baseline
        const report = engine.fixAll(tokensObj)
        if (report.changes.length) {
          logger.success(`[entanglement] Fixed ${report.changes.length} tokens`)
          for (const c of report.changes) {
            logger.info(`  ${c.path}: ${c.from} -> ${c.to} (${c.reason})`)
          }
          
          isWriting = true
          const out = mergeChangesBack(raw, report.changes, report.tokens, !!opts.figma)
          fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8')
          isWriting = false
          
          logger.success(`[entanglement] Wrote ${path.relative(root, outputPath)}`)
        } else {
          logger.success('[entanglement] All tokens valid, no changes needed')
        }
        
        lastTokens = JSON.parse(JSON.stringify(report.tokens))
        return
      }

      // Watch execution context: Detect mutated values
      const changedPaths = detectChanges(lastTokens, tokensObj)
      if (!changedPaths.length) return

      logger.info(`[entanglement] Detected change in ${changedPaths.join(', ')}${changedFile ? ` (${path.basename(changedFile)})` : ''}`)

      let workingTokens = JSON.parse(JSON.stringify(tokensObj))
      const allChanges: any[] = []

      for (const changedPath of changedPaths) {
        const newVal = (() => {
          let cur: any = tokensObj
          for (const p of changedPath.split('.')) cur = cur?.[p]
          return cur && typeof cur === 'object' && 'value' in cur ? cur.value : cur
        })()
        if (newVal === undefined || typeof newVal === 'object') continue
        
        const rep = engine.propagate(workingTokens, changedPath, String(newVal), { autoFixContrast: opts.fix !== false })
        workingTokens = rep.tokens
        allChanges.push(...rep.changes)
        
        if (rep.violations.length && opts.verbose) {
          for (const v of rep.violations) logger.warn(`  ⚠ ${v.message}`)
        }
      }

      if (allChanges.length) {
        for (const c of allChanges) {
          logger.info(`  ${c.path}: ${c.from} -> ${c.to} (${c.reason})`)
        }
        
        isWriting = true
        const out = mergeChangesBack(raw, allChanges, workingTokens, !!opts.figma)
        fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8')
        isWriting = false
        
        logger.success(`[entanglement] Propagated ${allChanges.length} changes -> ${path.relative(root, outputPath)}`)
      }

      lastTokens = JSON.parse(JSON.stringify(workingTokens))
    } catch (e: any) {
      isWriting = false
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
    // If the change was written by this engine, ignore it to prevent infinite update loop
    if (isWriting) return;
    
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => run(filename || undefined), debounceMs)
  })

  // Watch config file for changes to relationships
  const configPath = path.join(root, 'chaincss.config.ts')
  const configJs = path.join(root, 'chaincss.config.js')
  const cfgFile = fs.existsSync(configPath) ? configPath : fs.existsSync(configJs) ? configJs : null
  
  if (cfgFile) {
    fs.watch(cfgFile, () => {
      logger.info('[entanglement] Config changed, reloading relationships...')
      loadConfig().then((c: any) => {
        relationships = c.tokens?.relationships || c.entanglement?.relationships || []
        
        // Reset and re-instantiate clean state instead of appending to prevent memory leaks/duplicate rule clashes
        engine = new TokenEntanglementEngine(relationships)
        lastTokens = null // Evict baseline cache to force fresh propagation rules
        run()
        
        logger.success(`[entanglement] Re-initialized with ${relationships.length} relationships`)
      }).catch((e) => {
        logger.error(`[entanglement] Failed to reload config: ${e.message}`)
      })
    })
  }
}

export default entanglementCommand