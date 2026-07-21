// __tests__/unit/audit-fix.test.ts — v3.4
import { describe, it, expect } from 'vitest'
import { findClosestFix } from '../../src/cli/commands/audit.js'
import { contrastRatio } from '../../src/compiler/tokens/design-orchestrator.js'

describe('audit --fix', ()=>{
  it('fixes low contrast by darkening light text on white', ()=>{
    const fix = findClosestFix('#9ca3af', '#ffffff', 4.5)
    expect(fix).not.toBeNull()
    expect(fix!.fixed).toMatch(/^#/)
    expect(contrastRatio(fix!.fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(fix!.method).toBe('darken')
  })

  it('fixes dark text on dark background by lightening', ()=>{
    const fix = findClosestFix('#1a1a1a', '#111827', 4.5)
    expect(fix).not.toBeNull()
    expect(contrastRatio(fix!.fixed, '#111827')).toBeGreaterThanOrEqual(4.5)
    expect(fix!.method).toBe('lighten')
  })

  it('returns null when already passes', ()=>{
    const fix = findClosestFix('#000000', '#ffffff', 4.5)
    expect(fix).toBeNull()
  })

  it('preserves hue (HSL hue stays same)', async ()=>{
    const { default: Color } = await import('colorjs.io').catch(()=>({default:null})) as any
    // simple check: fix for blue tint stays blue-ish, not gray
    const fix = findClosestFix('#93c5fd', '#ffffff', 4.5)
    expect(fix).not.toBeNull()
    // #93c5fd is light blue, fixed should still be blue (b channel dominant)
    const r = parseInt(fix!.fixed.slice(1,3),16), g=parseInt(fix!.fixed.slice(3,5),16), b=parseInt(fix!.fixed.slice(5,7),16)
    expect(b).toBeGreaterThan(r)
  })

  it('AAA target requires higher contrast', ()=>{
    const fixAA = findClosestFix('#9ca3af', '#ffffff', 4.5)
    const fixAAA = findClosestFix('#9ca3af', '#ffffff', 7)
    expect(fixAAA!.ratio).toBeGreaterThanOrEqual(7)
    // AAA fix should be darker than AA fix
    const luma = (hex:string)=>{ const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16); return 0.2126*r+0.7152*g+0.0722*b }
    expect(luma(fixAAA!.fixed)).toBeLessThan(luma(fixAA!.fixed))
  })
})

