import { describe, it, expect } from 'vitest';
import { math, add, fluidType } from '../../src/compiler/math-engine.js';
import { intent, correct, macro, applyMacro, getMacros, hasMacro } from '../../src/compiler/intent-engine.js';
import { StyleGraphCompiler, compileGraph } from '../../src/compiler/style-graph.js';
import { StyleAnalyzer, analyzeStyle } from '../../src/compiler/analyzer.js';

describe('Public API — Math Engine', () => {
  it('math is importable', () => { expect(math).toBeDefined(); expect(typeof math.add).toBe('function'); });
  it('add works', () => { expect(add('10px','20px').toString()).toBe('30px'); });
  it('fluidType works', () => { expect(fluidType({minSize:14,maxSize:20}).expression).toContain('clamp'); });
});
describe('Public API — Intent Engine', () => {
  it('intent is importable', () => { expect(intent).toBeDefined(); });
  it('correct works', () => { expect(correct('display','flexbox')!.corrected).toBe('flex'); });
  it('macro works', () => { expect(macro('stickyHeader')).not.toBeNull(); expect(macro('stickyHeader')!.position).toBe('sticky'); });
  it('getMacros works', () => { expect(getMacros().length).toBeGreaterThan(10); });
  it('hasMacro works', () => { expect(hasMacro('card')).toBe(true); expect(hasMacro('nope')).toBe(false); });
});
describe('Public API — Style Graph', () => {
  it('StyleGraphCompiler is importable', () => { expect(new StyleGraphCompiler()).toBeDefined(); });
  it('compileGraph works', () => { expect(compileGraph({t:{selectors:['.t'],color:'red'}}as any).css).toContain('.t'); });
});
describe('Public API — Analyzer', () => {
  it('StyleAnalyzer is importable', () => { expect(new StyleAnalyzer()).toBeDefined(); });
  it('analyzeStyle works', () => { expect(analyzeStyle({selectors:['.t'],color:'red'}as any).diagnostics).toBeDefined(); });
});
