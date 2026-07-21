// __tests__/unit/intent-data.test.ts — v3.4
import { describe, it, expect, beforeEach } from 'vitest'
import { findClosestProperty, registerCustomKnownProperties, resetKnownProperties, levenshtein, clearPropertyCache } from '../../src/compiler/pipeline/normalizers/intent-data.js'

describe('intent-data', () => {
  beforeEach(()=>{ resetKnownProperties(); clearPropertyCache() })

  it('suggests closest builtin property', ()=>{
    expect(findClosestProperty('backgroud')).toBe('background')
    expect(findClosestProperty('colr')).toBe('color')
    expect(findClosestProperty('paddng')).toBe('padding')
  })

  it('levenshtein early exit on length diff', ()=>{
    expect(levenshtein('a','abcdefghijk',3)).toBeGreaterThan(3)
  })

  it('includes custom shorthands in suggestions', ()=>{
    registerCustomKnownProperties(['bgSoft','brandCard'])
    expect(findClosestProperty('bgSfot')).toBe('bgSoft')
    expect(findClosestProperty('brandCrad')).toBe('brandCard')
  })

  it('exact match returns itself without search', ()=>{
    expect(findClosestProperty('display')).toBe('display')
  })
})

