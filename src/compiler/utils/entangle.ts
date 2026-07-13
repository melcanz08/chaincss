// src/compiler/utils/entangle.ts — NATIVE v2.12
// Wires chain().entangle('scroll' | 'peerDim' | 'group:...' | 'token:...') to native CSS
// Zero runtime. All outputs are pure CSS.

import { createScrollTimeline } from '../pipeline/normalizers/scroll-timeline.js'

export type EntangleType =
  | 'scroll'
  | 'view'
  | 'peerDim'
  | 'group'
  | `group:${string}`
  | `token:${string}`
  | `contrast:${string}`
  | 'state'
  | `state:${string}`
  | 'focus'
  | 'hasCount'

export interface EntangleOptions {
  // scroll/view
  range?: string
  y?: string
  x?: string
  opacity?: string | number
  scale?: string | number
  timeline?: 'scroll' | 'view'
  axis?: 'block' | 'inline'
  // peerDim
  dimOpacity?: number
  blur?: string
  // group
  sync?: string[]
  // token
  tokenPath?: string
  // generic
  [key: string]: any
}

/**
 * Main entry for chain().entangle(type, opts)
 * Called from chain builder: chainEntangle.call(styleCtx, type, opts)
 */
export function entangle(type: string, opts: EntangleOptions = {}, ctx: any) {
  // normalize: allow "group:pricing-row" syntax
  if (type.startsWith('group:')) {
    const groupName = type.slice(6)
    return entangleGroup(groupName, opts, ctx)
  }
  if (type.startsWith('token:') || type.startsWith('$')) {
    const tokenPath = type.startsWith('token:') ? type.slice(6) : type
    return entangleToken(tokenPath, opts, ctx)
  }
  if (type.startsWith('state:')) {
    const stateName = type.slice(6)
    return entangleState(stateName, opts, ctx)
  }
  if (type.startsWith('contrast:')) {
    return entangleContrast(type, opts, ctx)
  }

  switch (type) {
    case 'scroll':
    case 'view':
      return entangleScroll({ ...opts, timeline: type as any }, ctx)
    case 'peerDim':
      return entanglePeerDim(opts, ctx)
    case 'group':
      return entangleGroup(opts.group || 'default', opts, ctx)
    case 'focus':
      return entangleFocus(opts, ctx)
    case 'hasCount':
      return entangleHasCount(opts, ctx)
    default:
      // unknown entangle type — store as meta for future plugins
      if (!ctx._entangle) ctx._entangle = []
      ctx._entangle.push({ type, opts, native: false })
      return
  }
}

// --- Implementations ---

function entangleScroll(opts: EntangleOptions, ctx: any) {
  // delegate to scroll-timeline.native which emits CSS
  // ctx is StyleObject that will be compiled
  const selector = ctx._selector || '&'
  const result = createScrollTimeline(selector, {
    range: opts.range,
    y: opts.y as string,
    x: opts.x as string,
    opacity: String(opts.opacity ?? ''),
    scale: String(opts.scale ?? ''),
    timeline: (opts.timeline as any) || 'view',
    axis: opts.axis as any,
  })
  // store native CSS to be injected by css-printer
  if (!ctx._nativeCSS) ctx._nativeCSS = []
  ctx._nativeCSS.push(result.css)
  ctx.willChange = 'transform, opacity'
  // ensure layer promotion
  if (!ctx.transform) ctx.transform = 'translateZ(0)'
}

function entanglePeerDim(opts: EntangleOptions, ctx: any) {
  const opacity = opts.opacity ?? opts.dimOpacity ?? 0.6
  const scale = opts.scale ?? 1
  if (!ctx.nestedRules) ctx.nestedRules = []
  // Native :has() peer dim — compiled to: .group:has(> :hover) > :not(:hover) { opacity: 0.6 }
  ctx.nestedRules.push({
    selector: '.group:has(> :hover) > &:not(:hover)',
    styles: {
      opacity,
      filter: opts.blur ? `blur(${opts.blur})` : 'none',
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      transition: 'opacity .25s ease, transform .25s ease, filter .25s ease',
    },
  })
  // Also ensure the card itself has transition
  ctx.transition = ctx.transition || 'transform .2s ease, opacity .2s ease, box-shadow .2s ease'
}

function entangleGroup(groupName: string, opts: EntangleOptions, ctx: any) {
  // group sync via subgrid — no JS
  if (opts.sync?.includes('height') || !opts.sync) {
    // mark this element as part of group that uses subgrid
    // The parent .group should have display:grid + gridTemplateRows
    ctx.gridRow = ctx.gridRow || 'span 3'
    ;(ctx as any)._entangleMeta = { type: 'group', groupName, sync: opts.sync || ['height'] }
    // For atomic extractor, add container-type hint
    if (!ctx.containerType) {
      // don't force, but hint
    }
  }
  // Add group class requirement via selector rewrite handled in compiler
  if (!ctx._entangle) ctx._entangle = []
  ctx._entangle.push({ type: 'group', groupName, native: true })
}

function entangleToken(tokenPath: string, _opts: EntangleOptions, ctx: any) {
  // Token entanglement — emit var() + @property if needed
  // Your design-orchestrator already creates --token vars
  // We just ensure the property uses var()
  const cssVar = `--${tokenPath.replace(/\./g, '-')}`
  // If ctx has bg or color that equals token, replace with var()
  // This is handled by token resolver, but we mark for audit
  if (!ctx._entangle) ctx._entangle = []
  ctx._entangle.push({ type: 'token', tokenPath, cssVar, native: true })
  // Auto contrast hint for audit command
  ;(ctx as any)._needsContrastCheck = true
}

function entangleState(stateName: string, _opts: EntangleOptions, ctx: any) {
  if (!ctx.nestedRules) ctx.nestedRules = []
  // State entanglement via :has() + data attribute — no JS
  // Example: state:compact -> [data-density="compact"] &
  ctx.nestedRules.push({
    selector: `[data-${stateName}] &, [data-state="${stateName}"] &`,
    styles: {},
  })
}

function entangleContrast(_type: string, _opts: EntangleOptions, ctx: any) {
  ;(ctx as any)._needsContrastCheck = true
}

function entangleFocus(_opts: EntangleOptions, ctx: any) {
  if (!ctx.nestedRules) ctx.nestedRules = []
  ctx.nestedRules.push({
    selector: '&:focus-within label, &:has(input:not(:placeholder-shown)) label',
    styles: { transform: 'translateY(-1.2rem) scale(0.85)', opacity: 1 },
  })
}

function entangleHasCount(opts: EntangleOptions, ctx: any) {
  const count = (opts as any).count ?? 3
  const styles = (opts as any).styles ?? {}
  if (!ctx.nestedRules) ctx.nestedRules = []
  ctx.nestedRules.push({
    selector: `&:has(> :nth-child(${count}))`,
    styles,
  })
}

// --- Helper to register into chain builder ---
// In your src/core/chain.ts or src/compiler/chain-builder.ts, add:
//
// import { entangle } from './utils/entangle.js'
// class ChainBuilder {
//   entangle(type: string, opts?: any) {
//     entangle(type, opts, this._ctx)
//     return this
//   }
// }

export const entangleMacro = (v: any, c: any) => {
  if (typeof v === 'string') {
    return entangle(v, {}, c)
  }
  if (Array.isArray(v)) {
    const [type, opts] = v
    return entangle(type, opts, c)
  }
  if (typeof v === 'object' && v.type) {
    return entangle(v.type, v, c)
  }
}
