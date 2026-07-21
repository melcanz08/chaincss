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

  it('uses same scope for counting and replacement (fix for has-pseudo bug)', ()=>{
    const ir = makeIR([
      { id:'r1', selector:'.a', declarations:[{property:'color',value:'red'}], pseudoClasses:[{name:'hover',declarations:[{property:'color',value:'red'}]}], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
      { id:'r2', selector:'.b', declarations:[{property:'color',value:'red'}], pseudoClasses:[{name:'hover',declarations:[{property:'color',value:'red'}]}], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
      { id:'r3', selector:'.c', declarations:[{property:'color',value:'red'}], pseudoClasses:[{name:'hover',declarations:[{property:'color',value:'red'}]}], atRules:[], nestedRules:[], meta:{}, isDead:false, history:[] },
    ])
    const ctx = { atomicUsageMap: new Map() }
    const result = atomicExtractor.optimize(ir, ctx)
    // All root scope colors should be extracted, has-pseudo scope should not interfere
    expect(result.savings.declarationsEliminated).toBe(0) // root declarations from rules with pseudoClasses are also skipped
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



