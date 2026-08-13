// __tests__/unit/atomic-extractor.test.ts — v3.4
import { describe, it, expect } from 'vitest'
import { atomicExtractor } from '../../src/compiler/pipeline/optimizers/atomic-extractor.js'
import type { StyleIR } from '../../src/compiler/pipeline/ir/types.js'

function makeIR(rules: any[]): StyleIR {
  return { id: 'test', rules, diagnostics: [], meta: {} } as any
}

describe('atomic-extractor', ()=>{
  it('extracts repeated declarations into atomic classes', ()=>{
    const ir = makeIR([
      { id:'r1', selector:'.a', declarations:[{property:'display',value:'flex'}], pseudoClasses:[], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
      { id:'r2', selector:'.b', declarations:[{property:'display',value:'flex'}], pseudoClasses:[], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
      { id:'r3', selector:'.c', declarations:[{property:'display',value:'flex'}], pseudoClasses:[], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
    ])
    const result = atomicExtractor.optimize(ir, { atomicUsageMap: new Map() })
    expect(result.ir.rules.length).toBeGreaterThanOrEqual(4) // 1 atomic + 3 components
    expect(result.savings.declarationsEliminated).toBe(3)
  })

  it('extracts both root-scope and pseudo-scope declarations independently', ()=>{
    const ir = makeIR([
      { id:'r1', selector:'.a', declarations:[{property:'color',value:'red'}], pseudoClasses:[{name:'hover',declarations:[{property:'color',value:'red'}]}], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
      { id:'r2', selector:'.b', declarations:[{property:'color',value:'red'}], pseudoClasses:[{name:'hover',declarations:[{property:'color',value:'red'}]}], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
      { id:'r3', selector:'.c', declarations:[{property:'color',value:'red'}], pseudoClasses:[{name:'hover',declarations:[{property:'color',value:'red'}]}], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
    ])
    const ctx = { atomicUsageMap: new Map() }
    const result = atomicExtractor.optimize(ir, ctx)

    // Root scope: 3x color:red → 1 atomic extracted, 3 declarations eliminated
    // Hover scope: 3x color:red → 1 atomic extracted (hover-color-red), 3 declarations eliminated
    // Total: 2 atomic rules, 6 declarations eliminated
    expect(result.savings.declarationsEliminated).toBe(6)

    // Should generate 2 atomic rules: one for root, one for hover-prefixed
    const atomicRules = result.ir.rules.filter((r: any) => r.meta?.atomic)
    expect(atomicRules.length).toBe(2)

    // One should be the root color, one should be hover-prefixed
    const selectors = atomicRules.map((r: any) => r.selector)
    expect(selectors.some((s: string) => s.startsWith('.hover-'))).toBe(true)

    // Total rules: 2 atomic + 3 original = 5
    expect(result.ir.rules.length).toBe(5)
  })

  it('avoids collision with shorthand names like flex', ()=>{
    const ir = makeIR([
      { id:'r1', selector:'.a', declarations:[{property:'display',value:'flex'}], pseudoClasses:[], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
      { id:'r2', selector:'.b', declarations:[{property:'display',value:'flex'}], pseudoClasses:[], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
      { id:'r3', selector:'.c', declarations:[{property:'display',value:'flex'}], pseudoClasses:[], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
    ])
    const result = atomicExtractor.optimize(ir, { atomicUsageMap: new Map() })
    const atomicRule = result.ir.rules.find((r:any)=>r.meta?.atomic)
    expect(atomicRule?.selector).not.toBe('.flex') // should be _flex or prefixed to avoid collision
  })
})



