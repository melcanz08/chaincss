// ============================================================================
// FILE: chaincss/src/cli/commands/audit.ts
// ============================================================================

import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { loadConfig } from '../utils/config-loader.js'
import { createLogger } from '../utils/logger.js'
import { auditContrast, parseColor, importFigmaTokens } from '../../compiler/tokens/design-orchestrator.js'
import { validateTheme } from '../../compiler/tokens/theme-contract.js'
import chalk from 'chalk'

type FailLevel = 'AA' | 'AAA' | 'none'

interface AuditOptions {
  theme?: string
  contract?: string
  failOn?: FailLevel
  json?: string
  strict?: boolean
  verbose?: boolean
  silent?: boolean
  fix?: boolean
  write?: boolean // --fix --write to update tokens file
  target?: number // default 4.5
}

// ------------------------------------------------------------------
// Color helpers for --fix
// ------------------------------------------------------------------
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const hue2rgb = (p: number, q: number, t: number) => { 
      if (t < 0) t += 1; 
      if (t > 1) t -= 1; 
      if (t < 1 / 6) return p + (q - p) * 6 * t; 
      if (t < 1 / 2) return q; 
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; 
      return p 
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
}

function contrastFromRgb(fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b) + 0.05, l2 = relativeLuminance(bg.r, bg.g, bg.b) + 0.05
  return Math.max(l1, l2) / Math.min(l1, l2)
}

/**
 * Finds the closest accessible color matching the target ratio by adjusting lightness only.
 * Employs a single highly-optimized binary search loop across the HSL L-channel.
 */
export function findClosestFix(foreground: string, background: string, target = 4.5): { fixed: string; ratio: number; method: string } | null {
  const fg = parseColor(foreground), bg = parseColor(background)
  if (!fg || !bg) return null
  
  const currentRatio = contrastFromRgb(fg, bg)
  if (currentRatio >= target) return null

  const [h, s, l] = rgbToHsl(fg.r, fg.g, fg.b)
  const bgLum = relativeLuminance(bg.r, bg.g, bg.b)
  
  // Light background requires darker text; dark background requires lighter text
  const shouldDarken = bgLum > 0.5

  let low = shouldDarken ? 0 : l
  let high = shouldDarken ? l : 1
  let bestL: number | null = null

  // 24 iterations provide ~0.00000006 precision
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    const [r, g, b] = hslToRgb(h, s, mid)
    const ratio = contrastFromRgb({ r, g, b }, bg)

    if (ratio >= target) {
      bestL = mid
      if (shouldDarken) {
        low = mid // Keep searching for higher (closer to original) passing lightness value
      } else {
        high = mid // Keep searching for lower (closer to original) passing lightness value
      }
    } else {
      if (shouldDarken) {
        high = mid // Too bright, needs to go darker
      } else {
        low = mid // Too dark, needs to go lighter
      }
    }
  }

  if (bestL !== null) {
    const [fr, fgG, fb] = hslToRgb(h, s, bestL)
    const finalRatio = contrastFromRgb({ r: fr, g: fgG, b: fb }, bg)
    return { 
      fixed: rgbToHex(fr, fgG, fb), 
      ratio: Math.round(finalRatio * 100) / 100, 
      method: shouldDarken ? 'darken' : 'lighten' 
    }
  }

  // Fallback: Extreme absolute contrast thresholding if saturation/hue restrictions lock output range
  const extreme = shouldDarken ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  const er = contrastFromRgb(extreme, bg)
  if (er >= target) {
    return { 
      fixed: shouldDarken ? '#000000' : '#ffffff', 
      ratio: Math.round(er * 100) / 100, 
      method: 'extreme' 
    }
  }

  return null
}

function findTokensFile(root: string, explicit?: string): string | null {
  if (explicit) {
    const p = path.isAbsolute(explicit) ? explicit : path.join(root, explicit);
    return fs.existsSync(p) ? p : null
  }
  const cands = [
    'theme.json', 'tokens.json', 'design-tokens.json', 'src/theme.json', 'src/tokens.json', 'tokens/tokens.json', '.chaincss/tokens.json'
  ]
  for (const c of cands) { const p = path.join(root, c); if (fs.existsSync(p)) return p }
  return null
}

const TEXT_RE = /text|foreground/i;
const BG_RE = /background|bg|surface/i;

// Recursively resolve design token alias references e.g., "{colors.neutral.900}"
function resolveTokenValue(value: string, flatTokens: Record<string, string>): string {
  if (typeof value !== 'string') return value;
  const match = value.match(/^\{([^}]+)\}$/);
  if (match) {
    const aliasPath = match[1];
    if (flatTokens[aliasPath]) {
      return resolveTokenValue(flatTokens[aliasPath], flatTokens);
    }
  }
  return value;
}

function extractPairs(tokens: any): Array<{ selector: string; color: string; backgroundColor: string; fgPath?: string; bgPath?: string }> {
  const flat: Record<string, string> = {}
  
  function flatten(o: any, pfx = '') {
    for (const [k, v] of Object.entries(o || {})) {
      const np = pfx ? `${pfx}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && !('value' in v)) {
        flatten(v, np)
      } else if (typeof v === 'string' || typeof v === 'number') {
        flat[np] = String(v);
      } else if (v && typeof v === 'object' && 'value' in v) {
        flat[np] = String((v as any).value)
      }
    }
  }
  flatten(tokens)

  // Resolve references before validating
  const resolvedFlat: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    resolvedFlat[k] = resolveTokenValue(v, flat);
  }

  const textKeys = Object.keys(resolvedFlat).filter(k => TEXT_RE.test(k))
  const bgKeys = Object.keys(resolvedFlat).filter(k => BG_RE.test(k))
  const pairs: any[] = []
  const seen = new Set<string>()

  for (const tk of textKeys) {
    for (const bk of bgKeys) {
      if (tk === bk) continue;
      
      // OPTIMIZATION: Ensure namespace/component alignment (e.g. "button.primary.text" matches "button.primary.bg")
      // Only pair if they share a common ancestor or both belong to the top-level global space
      const tkParts = tk.split('.');
      const bkParts = bk.split('.');
      const tkNamespace = tkParts.slice(0, -1).join('.');
      const bkNamespace = bkParts.slice(0, -1).join('.');
      
      const isGlobalCompare = tkParts.length <= 2 && bkParts.length <= 2;
      const isSameComponent = tkNamespace === bkNamespace;
      
      if (!isGlobalCompare && !isSameComponent) continue;

      const fg = resolvedFlat[tk], bg = resolvedFlat[bk];
      if (!fg || !bg) continue;
      if (!parseColor(fg) || !parseColor(bg)) continue;
      
      const id = `${tk}|${bk}`;
      if (seen.has(id)) continue;
      seen.add(id);

      pairs.push({
        selector: `${tk} on ${bk}`,
        color: fg,
        backgroundColor: bg,
        fgPath: tk,
        bgPath: bk
      })
    }
  }
  return pairs
}

export async function auditCommand(opts: AuditOptions = {}) {
  const logger = createLogger(!!opts.verbose)
  const root = process.cwd()
  const failOn: FailLevel = (opts.failOn as FailLevel) || 'AA'
  const target = opts.target || (failOn === 'AAA' ? 7 : 4.5)
  const strict = !!opts.strict

  logger.info('[chaincss audit] Loading config...')
  const config = await loadConfig() as any

  let tokens: any = config.tokens?.values || config.theme || null
  const tokensPath = findTokensFile(root, opts.theme)
  let rawTokens: any = null

  if (tokensPath) {
    rawTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    tokens = rawTokens.tokens || rawTokens.values || rawTokens;
    if (rawTokens.$themes || Object.values(rawTokens).some((v: any) => v && typeof v === 'object' && 'value' in v)) {
      logger.info('[audit] Figma format detected'); tokens = importFigmaTokens(rawTokens)
    }
  }

  let contract: any = null
  if (opts.contract) {
    const cp = path.isAbsolute(opts.contract) ? opts.contract : path.join(root, opts.contract);
    if (fs.existsSync(cp)) {
      try {
        const mod = await import(pathToFileURL(cp).href + `?t=${Date.now()}`);
        contract = mod.default || mod.contract || mod
      } catch (importErr: any) {
        if (cp.endsWith('.ts')) {
          logger.warn(`\n⚠️ Cannot directly import TypeScript contract files in ESM without loaders.`);
          logger.warn(`  Ensure you compile '${path.relative(root, cp)}' to JavaScript or run using a wrapper like tsx.\n`);
        }
        throw importErr;
      }
    }
  } else if (config.themeContract) {
    contract = config.themeContract
  }

  if (contract && tokens) {
    try {
      validateTheme(contract, tokens, '', { strict });
      logger.success('[audit] Contract PASSED')
    } catch (e: any) {
      logger.error('[audit] Contract FAILED');
      logger.error(e.message);
      if (failOn !== 'none') process.exit(1)
    }
  }

  let pairs: any[] = []
  if (Array.isArray(config.a11y?.pairs)) {
    for (const p of config.a11y.pairs) {
      const resolve = (dot: string, o: any) => {
        const ps = dot.split('.');
        let cur = o;
        for (const pt of ps) {
          if (!cur) return null;
          cur = cur[pt]
        }
        return typeof cur === 'string' ? cur : null
      };
      const fgVal = p.foreground?.startsWith('#') || p.foreground?.startsWith('rgb') ? p.foreground : (resolve(p.foreground, tokens) || p.foreground);
      const bgVal = p.background?.startsWith('#') || p.background?.startsWith('rgb') ? p.background : (resolve(p.background, tokens) || p.background);
      if (fgVal && bgVal)
        pairs.push({
          selector: p.label || `${p.foreground} on ${p.background}`,
          color: fgVal, backgroundColor: bgVal,
          fgPath: p.foreground,
          bgPath: p.background
        })
    }
  } else {
    pairs = extractPairs(tokens || {})
  }

  if (pairs.length === 0) { logger.warn('[audit] No pairs found. Add a11y.pairs in config.'); return { pass: true, checks: [] } }

  const report = auditContrast(pairs)
  const fixes: Array<{ selector: string; original: string; background: string; fixed: string; ratio: number; method: string }> = []

  if (!opts.silent) {
    console.log('\n=== ChainCSS Contrast Audit ===\n')
    for (const c of report.checks) {
      const failing = !c.passes.AA
      if (failing && opts.fix) {
        const pair = pairs.find((p: any) => p.color === c.foreground && p.backgroundColor === c.background)
        const fix = findClosestFix(c.foreground, c.background, target)
        if (fix) {
          fixes.push({
            selector: pair?.selector || `${c.foreground} on ${c.background}`,
            original: c.foreground,
            background: c.background,
            fixed: fix.fixed,
            ratio: fix.ratio,
            method: fix.method
          });
          logger.error(`✗ ${c.foreground} on ${c.background} → ${c.ratio}:1 FAIL — fix: ${fix.fixed} → ${fix.ratio}:1 (${fix.method})`); continue
        }
      }
      const status = !c.passes.AA ? 'FAIL' : !c.passes.AAA ? 'WARN' : 'PASS'
      const icon = status === 'FAIL' ? '✗' : status === 'WARN' ? '⚠' : '✓'
      const line = `${icon} ${c.foreground} on ${c.background} → ${c.ratio}:1 ${status}${c.suggestion ?` (${c.suggestion})` : ''}`
      if (status === 'FAIL') logger.error(line); else if (status === 'WARN') logger.warn(line); else logger.success(line)
    }
    console.log(`\n${report.summary} — ${report.passCount} pass, ${report.failCount} fail, ${report.warnings.length} warn\n`)
    if (fixes.length) {
      console.log(`--fix suggestions (${fixes.length}):\n`);
      for (const f of fixes) {
        console.log(` ${f.selector}: ${f.original} → ${f.fixed} (${f.method}, ${f.ratio}:1 on ${f.background})`)
      }
      console.log('')
    }
  }

  if (opts.json) {
    const out = path.isAbsolute(opts.json) ? opts.json : path.join(root, opts.json);
    fs.writeFileSync(out, JSON.stringify({ ...report, fixes, pairs }, null, 2), 'utf8');
    logger.info(`[audit] JSON written to ${out}`)
  }

  if (opts.fix && opts.write && tokensPath && fixes.length) {
    let mutated = false
    const targetRoot = rawTokens || tokens
    
    for (const f of fixes) {
      const pair = pairs.find((p: any) => p.selector === f.selector)
      if (!pair?.fgPath) continue
      
      const parts = pair.fgPath.split('.')
      let targetObj = targetRoot
      let resolutionFailed = false
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!targetObj[parts[i]]) {
          resolutionFailed = true
          break
        }
        targetObj = targetObj[parts[i]]
      }
      
      if (resolutionFailed) continue
      const last = parts[parts.length - 1]
      
      if (targetObj && last in targetObj) {
        if (typeof targetObj[last] === 'object' && 'value' in targetObj[last]) {
          (targetObj[last] as any).value = f.fixed
        } else {
          targetObj[last] = f.fixed
        }
        mutated = true
      }
    }
    if (mutated) {
      fs.writeFileSync(tokensPath, JSON.stringify(targetRoot, null, 2), 'utf8');
      logger.success(`[audit] --write applied ${fixes.length} fix(es) to ${path.relative(root, tokensPath)}`)
    }
  }

  if (failOn === 'AA' && report.failCount > 0 && !opts.fix) {
    logger.error(`[audit] Failing build: ${report.failCount} AA failure(s)`);
    process.exit(1)
  }
  if (failOn === 'AAA' && (report.failCount > 0 || report.warnings.length > 0) && !opts.fix) {
    process.exit(1)
  }

  if (opts.fix && fixes.length && !opts.write) {
    logger.info('[audit] Run with --write to apply fixes, or --fail-on none to not block CI while fixing')
  }

  return { ...report, fixes }
}

export default auditCommand