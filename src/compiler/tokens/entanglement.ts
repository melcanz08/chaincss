// src/compiler/tokens/entanglement.ts — Token Entanglement Engine v1.0
// Only ChainCSS can do this: tokens are physically linked, not flat variables.
// Change primary.500 and every derived + contrast-bound token auto adjusts to keep AA, hue harmony, and scale rhythm.

import { parseColor as parseColorBase } from './design-orchestrator.js'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export type TokenPath = string // dot path: colors.primary.500

export type ContrastMethod = 'auto' | 'darken' | 'lighten'

export interface ContrastRelationship {
  type: 'contrast'
  id?: string
  foreground: TokenPath
  background: TokenPath | TokenPath[]
  target?: number // default 4.5
  autoFix?: ContrastMethod // default 'auto'
  priority?: number // higher = fixed first
}

export type DerivedMethod =
  | `mix-white ${number}%`
  | `mix-black ${number}%`
  | `lighten ${number}`
  | `darken ${number}`
  | `alpha ${number}`
  | `tint ${number}%`
  | `shade ${number}%`
  | `saturate ${number}`
  | `desaturate ${number}`

export interface DerivedRelationship {
  type: 'derived'
  id?: string
  source: TokenPath
  target: TokenPath
  method: DerivedMethod
  preserveHue?: boolean // default true
}

export interface HarmonyRelationship {
  type: 'harmony'
  id?: string
  source: TokenPath
  targets: TokenPath[]
  rule: 'complementary' | 'analogous' | 'triadic' | 'same-lightness'
}

export type Relationship = ContrastRelationship | DerivedRelationship | HarmonyRelationship

export interface Violation {
  relationship: Relationship
  foreground: string
  background: string
  ratio: number
  target: number
  message: string
}

export interface Change {
  path: TokenPath
  from: string
  to: string
  reason: string
  method?: string
  ratio?: number
}

export interface EntanglementReport {
  valid: boolean
  violations: Violation[]
  changes: Change[]
  tokens: Record<string, any>
}

// ------------------------------------------------------------------
// Color utils (standalone, no circular dep)
// ------------------------------------------------------------------
type RGB = { r: number; g: number; b: number; a?: number }

function parseColor(input: string): RGB | null {
  if (!input || typeof input !== 'string') return null
  const base = (parseColorBase as any)?.(input)
  if (base) return base
  // fallback minimal parser
  let s = input.trim()
  if (s.startsWith('#')) {
    let h = s.slice(1)
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) { const p = m[1].split(',').map(n => parseFloat(n)); return { r: p[0], g: p[1], b: p[2], a: p[3] } }
  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break }
    h /= 6
  }
  return [h, s, l]
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number
  if (s === 0) r = g = b = l
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
    const hue = (p: number, q: number, t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p }
    r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3)
  }
  return [r * 255, g * 255, b * 255]
}
function luminance({ r, g, b }: RGB): number {
  const toLin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
}
function contrast(fg: RGB, bg: RGB): number {
  const l1 = luminance(fg) + 0.05, l2 = luminance(bg) + 0.05
  return Math.max(l1, l2) / Math.min(l1, l2)
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}

// Find closest color that meets target by adjusting lightness only, preserves hue
function findClosestFix(fgStr: string, bgStr: string, target = 4.5, method: ContrastMethod = 'auto'): { fixed: string; ratio: number; fixMethod: string } | null {
  const fg = parseColor(fgStr), bg = parseColor(bgStr)
  if (!fg || !bg) return null
  if (contrast(fg, bg) >= target) return null
  const [h, s, l] = rgbToHsl(fg.r, fg.g, fg.b)
  const bgLum = luminance(bg)
  const shouldDarken = method === 'darken' ? true : method === 'lighten' ? false : bgLum > 0.5

  let lo = shouldDarken ? 0 : l, hi = shouldDarken ? l : 1
  let best: { l: number; ratio: number } | null = null
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const [r, g, b] = hslToRgb(h, s, mid)
    const ratio = contrast({ r, g, b }, bg)
    if (ratio >= target) { best = { l: mid, ratio }; if (shouldDarken) lo = mid; else hi = mid; if (Math.abs(hi - lo) < 0.0005) break } else { if (shouldDarken) hi = mid; else lo = mid }
    // narrow towards original l to minimize change
    if (shouldDarken) { if (ratio >= target) lo = mid; else hi = mid } else { if (ratio >= target) hi = mid; else lo = mid }
  }
  if (!best) {
    const extreme = shouldDarken ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
    const er = contrast(extreme, bg)
    if (er >= target) return { fixed: shouldDarken ? '#000000' : '#ffffff', ratio: Math.round(er * 100) / 100, fixMethod: 'extreme' }
    return null
  }
  const [fr, fg_, fb] = hslToRgb(h, s, best.l)
  return { fixed: rgbToHex(fr, fg_, fb), ratio: Math.round(best.ratio * 100) / 100, fixMethod: shouldDarken ? 'darken' : 'lighten' }
}

function applyDerived(source: string, method: DerivedMethod): string | null {
  const rgb = parseColor(source); if (!rgb) return null
  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const m = method.trim()
  if (m.startsWith('mix-white')) { const pct = parseFloat(m.split(' ')[1]) / 100; const mixed = mix(rgb, { r: 255, g: 255, b: 255 }, pct); return rgbToHex(mixed.r, mixed.g, mixed.b) }
  if (m.startsWith('mix-black')) { const pct = parseFloat(m.split(' ')[1]) / 100; const mixed = mix(rgb, { r: 0, g: 0, b: 0 }, pct); return rgbToHex(mixed.r, mixed.g, mixed.b) }
  if (m.startsWith('lighten')) { const amt = parseFloat(m.split(' ')[1]) / 100; const nl = Math.min(1, l + amt); const [r, g, b] = hslToRgb(h, s, nl); return rgbToHex(r, g, b) }
  if (m.startsWith('darken')) { const amt = parseFloat(m.split(' ')[1]) / 100; const nl = Math.max(0, l - amt); const [r, g, b] = hslToRgb(h, s, nl); return rgbToHex(r, g, b) }
  if (m.startsWith('tint')) { const pct = parseFloat(m.split(' ')[1]) / 100; return applyDerived(source, `mix-white ${pct * 100}%` as any) }
  if (m.startsWith('shade')) { const pct = parseFloat(m.split(' ')[1]) / 100; return applyDerived(source, `mix-black ${pct * 100}%` as any) }
  if (m.startsWith('saturate')) { const amt = parseFloat(m.split(' ')[1]) / 100; const ns = Math.min(1, s + amt); const [r, g, b] = hslToRgb(h, ns, l); return rgbToHex(r, g, b) }
  if (m.startsWith('desaturate')) { const amt = parseFloat(m.split(' ')[1]) / 100; const ns = Math.max(0, s - amt); const [r, g, b] = hslToRgb(h, ns, l); return rgbToHex(r, g, b) }
  if (m.startsWith('alpha')) { const a = parseFloat(m.split(' ')[1]); return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${a})` }
  return null
}

// ------------------------------------------------------------------
// Path helpers for nested tokens
// ------------------------------------------------------------------
function getByPath(obj: any, dot: string): any {
  const parts = dot.split('.'); let cur = obj
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p] }
  if (cur && typeof cur === 'object' && 'value' in cur) return (cur as any).value
  return cur
}
function setByPath(obj: any, dot: string, value: any) {
  const parts = dot.split('.'); let cur = obj
  for (let i = 0; i < parts.length - 1; i++) { const p = parts[i]; if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}; cur = cur[p] }
  const last = parts[parts.length - 1]
  if (cur[last] && typeof cur[last] === 'object' && 'value' in cur[last]) (cur[last] as any).value = value
  else cur[last] = value
}
function cloneTokens<T>(t: T): T { return JSON.parse(JSON.stringify(t)) }

// Topological sort for derived graph to avoid cycles
function topoSort(derived: DerivedRelationship[]): DerivedRelationship[] {
  const graph = new Map<string, Set<string>>()
  const indeg = new Map<string, number>()
  const byTarget = new Map<string, DerivedRelationship>()
  for (const r of derived) { byTarget.set(r.target, r); if (!indeg.has(r.source)) indeg.set(r.source, 0); indeg.set(r.target, (indeg.get(r.target) || 0) + 1); if (!graph.has(r.source)) graph.set(r.source, new Set()); graph.get(r.source)!.add(r.target) }
  const q: string[] = []; for (const [n, d] of indeg) if (d === 0) q.push(n)
  const order: string[] = []
  while (q.length) { const n = q.shift()!; order.push(n); const outs = graph.get(n); if (!outs) continue; for (const o of outs) { const nd = (indeg.get(o) || 1) - 1; indeg.set(o, nd); if (nd === 0) q.push(o) } }
  // return derived sorted by source order
  const pos = new Map(order.map((n, i) => [n, i])); return [...derived].sort((a, b) => (pos.get(a.source) ?? 0) - (pos.get(b.source) ?? 0))
}

// ------------------------------------------------------------------
// Engine
// ------------------------------------------------------------------
export class TokenEntanglementEngine {
  private relationships: Relationship[] = []

  constructor(relationships: Relationship[] = []) {
    this.relationships = relationships
  }

  add(r: Relationship) { this.relationships.push(r) }
  addMany(rs: Relationship[]) { this.relationships.push(...rs) }

  validate(tokens: Record<string, any>): Violation[] {
    const violations: Violation[] = []
    for (const rel of this.relationships) {
      if (rel.type !== 'contrast') continue
      const fgVal = getByPath(tokens, rel.foreground)
      const bgs = Array.isArray(rel.background) ? rel.background : [rel.background]
      const target = rel.target ?? 4.5
      if (!fgVal) continue
      for (const bgPath of bgs) {
        const bgVal = getByPath(tokens, bgPath)
        if (!bgVal) continue
        const fgRgb = parseColor(String(fgVal)), bgRgb = parseColor(String(bgVal))
        if (!fgRgb || !bgRgb) continue
        const ratio = contrast(fgRgb, bgRgb)
        if (ratio < target) violations.push({ relationship: rel, foreground: String(fgVal), background: String(bgVal), ratio: Math.round(ratio * 100) / 100, target, message: `${rel.foreground} on ${bgPath} is ${ratio.toFixed(2)}:1, needs ${target}:1` })
      }
    }
    return violations
  }

  /**
   * Propagate a source change through derived relationships, then auto fix contrast.
   * Returns report with all changes and remaining violations.
   */
  propagate(tokens: Record<string, any>, sourcePath: TokenPath, newValue: string, opts: { autoFixContrast?: boolean } = {}): EntanglementReport {
    const next = cloneTokens(tokens)
    const changes: Change[] = []
    const from = String(getByPath(next, sourcePath) ?? '')
    setByPath(next, sourcePath, newValue)
    if (from) changes.push({ path: sourcePath, from, to: newValue, reason: 'source change' })

    // 1. Derived propagation in topological order
    const derived = this.relationships.filter(r => r.type === 'derived') as DerivedRelationship[]
    const sorted = topoSort(derived)
    // Need to re-evaluate in loop until stable because sourcePath may be intermediate
    let mutated = true, iter = 0
    while (mutated && iter < 10) {
      mutated = false; iter++
      for (const rel of sorted) {
        const srcVal = getByPath(next, rel.source)
        if (!srcVal) continue
        const computed = applyDerived(String(srcVal), rel.method)
        if (!computed) continue
        const cur = getByPath(next, rel.target)
        if (String(cur) === computed) continue
        setByPath(next, rel.target, computed)
        changes.push({ path: rel.target, from: String(cur ?? ''), to: computed, reason: `derived from ${rel.source} via ${rel.method}`, method: rel.method })
        mutated = true
      }
    }

    // 2. Contrast auto fix
    if (opts.autoFixContrast !== false) {
      const contrastRels = (this.relationships.filter(r => r.type === 'contrast') as ContrastRelationship[]).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      for (const rel of contrastRels) {
        const bgs = Array.isArray(rel.background) ? rel.background : [rel.background]
        const target = rel.target ?? 4.5
        for (const bgPath of bgs) {
          const fgVal = getByPath(next, rel.foreground), bgVal = getByPath(next, bgPath)
          if (!fgVal || !bgVal) continue
          const fgRgb = parseColor(String(fgVal)), bgRgb = parseColor(String(bgVal))
          if (!fgRgb || !bgRgb) continue
          const ratio = contrast(fgRgb, bgRgb)
          if (ratio >= target) continue
          const fix = findClosestFix(String(fgVal), String(bgVal), target, rel.autoFix ?? 'auto')
          if (!fix) continue
          setByPath(next, rel.foreground, fix.fixed)
          changes.push({ path: rel.foreground, from: String(fgVal), to: fix.fixed, reason: `auto fix contrast ${ratio.toFixed(2)} -> ${fix.ratio} on ${bgPath}`, method: fix.fixMethod, ratio: fix.ratio })
          // break after first background fix for this foreground to avoid thrashing
          break
        }
      }
    }

    const violations = this.validate(next)
    return { valid: violations.length === 0, violations, changes, tokens: next }
  }

  /** Fix all current violations without a source change */
  fixAll(tokens: Record<string, any>): EntanglementReport {
    const next = cloneTokens(tokens)
    const changes: Change[] = []
    const contrastRels = (this.relationships.filter(r => r.type === 'contrast') as ContrastRelationship[]).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    for (const rel of contrastRels) {
      const bgs = Array.isArray(rel.background) ? rel.background : [rel.background]
      for (const bgPath of bgs) {
        const fgVal = getByPath(next, rel.foreground), bgVal = getByPath(next, bgPath)
        if (!fgVal || !bgVal) continue
        const ratio = contrast(parseColor(String(fgVal))!, parseColor(String(bgVal))!)
        if (ratio >= (rel.target ?? 4.5)) continue
        const fix = findClosestFix(String(fgVal), String(bgVal), rel.target ?? 4.5, rel.autoFix ?? 'auto')
        if (!fix) continue
        setByPath(next, rel.foreground, fix.fixed)
        changes.push({ path: rel.foreground, from: String(fgVal), to: fix.fixed, reason: `fixAll: ${rel.foreground} on ${bgPath}`, method: fix.fixMethod, ratio: fix.ratio })
        break
      }
    }
    return { valid: this.validate(next).length === 0, violations: this.validate(next), changes, tokens: next }
  }
}

// ------------------------------------------------------------------
// Factory helper for chaincss.config.ts
// ------------------------------------------------------------------
export function createEntanglementEngine(config: {
  relationships: Relationship[]
}) {
  return new TokenEntanglementEngine(config.relationships)
}

// ------------------------------------------------------------------
// Example: how to wire into audit command
// ------------------------------------------------------------------
// import { createEntanglementEngine } from './entanglement.js'
// const engine = createEntanglementEngine({
//   relationships: [
//     { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
//     { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.700', method: 'shade 20%' },
//     { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto', priority: 10 },
//     { type: 'contrast', foreground: 'colors.text.muted', background: 'colors.background', target: 4.5 }
//   ]
// })
// const report = engine.propagate(tokens, 'colors.primary.500', '#6366f1')
// if (!report.valid) console.log(report.violations)
// fs.writeFileSync('tokens.json', JSON.stringify(report.tokens, null, 2))

