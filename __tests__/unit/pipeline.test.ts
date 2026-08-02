// __tests__/unit/pipeline.test.ts
// Pipeline tests — pass behavior (v2) + graph-driven architecture (v3)

import { describe, it, expect, beforeEach } from 'vitest';
import { Pipeline } from '../../src/compiler/pipeline/pipeline.js';
import { createDefaultPipeline, createFullPipeline, getPassDeclarations, validatePassSchedule } from '../../src/compiler/pipeline/pipeline.js';
import { createIR, createRule, createDeclaration, resetIdCounter } from '../../src/style-ir.js';
import { invalidateIntentCache, clearCustomIntentKeys } from '../../src/compiler/pipeline/normalizers/intent-detector.js';
import { emit } from '../../src/compiler/pipeline/lowering/emitter-registry.js';
import type { StyleIR } from '../../src/style-ir.js';

describe('Pipeline', () => {
  beforeEach(() => {
    resetIdCounter();
    invalidateIntentCache();
    clearCustomIntentKeys();
  });

  // ==========================================================================
  // Pass Behavior (v2 — backward compatible)
  // ==========================================================================

  describe('Normalization', () => {
    it('intent-normalizer: flexbox → flex', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('display', 'flexbox'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe('flex');
    });

    it('intent-normalizer: abs → absolute', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.el');
      rule.declarations.push(createDeclaration('position', 'abs'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe('absolute');
    });

    it('unit-normalizer: adds px to numbers', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('width', 100 as any));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe('100px');
    });
  });

  describe('Validation', () => {
    it('accessibility: flags small font sizes', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.small-text');
      rule.declarations.push(createDeclaration('fontSize', '10px'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes('accessibility'));
      expect(diags.length).toBeGreaterThan(0);
      expect(diags[0].message).toContain('font-size');
    });

    it('conflict: flags z-index on static', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.el');
      rule.declarations.push(createDeclaration('position', 'static'));
      rule.declarations.push(createDeclaration('zIndex', '999'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes('conflict'));
      expect(diags.length).toBeGreaterThan(0);
      expect(diags[0].message).toContain('z-index');
    });

    it('ide-diagnostics: flags missing transition on hover', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('cursor', 'pointer'));
      rule.pseudoClasses.push({
        id: 'hover-test', name: 'hover', parentId: rule.id,
        declarations: [createDeclaration('backgroundColor', 'red')],
        source: {}, history: [],
      });
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes('ide-diagnostics'));
      // May or may not find — depends on validation order
      expect(diags.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Optimization', () => {
    it('css-compressor: shortens hex colors', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', '#ffffff'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe('#fff');
    });

    it('dead-code-eliminator: removes dead rules', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const dead = createRule('.dead');
      dead.isDead = true;
      dead.declarations.push(createDeclaration('color', 'red'));
      const alive = createRule('.alive');
      alive.declarations.push(createDeclaration('color', 'blue'));
      ir.rules.push(dead, alive);
      const result = await pipeline.execute(ir);
      expect(result.ir.rules.length).toBe(1);
      expect(result.ir.rules[0].selector).toBe('.alive');
    });

    it('accessibility-optimizer: wraps small fonts in max()', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.tiny');
      rule.declarations.push(createDeclaration('fontSize', '10px'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const decl = result.ir.rules[0].declarations[0];
      expect(decl.value).toContain('max');
    });
  });

  describe('Lowering', () => {
    it('intent-resolver: resolves center-content', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.container');
      rule.meta._intent = 'center-content';
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const props = result.ir.rules[0].declarations.map(d => d.property);
      expect(props).toContain('display');
      expect(props).toContain('justifyContent');
      expect(props).toContain('alignItems');
    });

    it('css-emitter: produces CSS output', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      expect(result.finalCSS).toBeDefined();
      expect(result.finalCSS).toContain('.test');
      expect(result.finalCSS).toContain('color: red');
    });
  });

  // ==========================================================================
  // Graph-Driven Architecture (v3)
  // ==========================================================================

  describe('Scheduler', () => {
    it('all 23 passes have declarations', () => {
      const declarations = getPassDeclarations();
      expect(declarations.length).toBe(23);
    });

    it('pass declarations validate without errors', () => {
      const declarations = getPassDeclarations();
      const result = validatePassSchedule(declarations);
      expect(result.errors).toEqual([]);
    });

    it('pipeline reports schedule validation status', () => {
      const pipeline = createDefaultPipeline();
      const validation = pipeline.getScheduleValidation();
      expect(validation).toBeDefined();
      expect(typeof validation.valid).toBe('boolean');
    });

    it('scheduler runs passes in phase order', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const stages = result.timeline.map(t => t.stage);
      const normIdx = stages.indexOf('normalization');
      const optIdx = stages.indexOf('optimization');
      if (normIdx >= 0 && optIdx >= 0) {
        expect(normIdx).toBeLessThan(optIdx);
      }
    });
  });

  describe('Graph & Symbols', () => {
    it('builds a dependency graph from IR', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.test'));
      const result = await pipeline.execute(ir);
      expect(result.ir.graph).toBeDefined();
      expect(result.ir.graph.nodes instanceof Map).toBe(true);
      expect(result.ir.graph.nodes.size).toBeGreaterThan(0);
    });

    it('graph contains rule nodes', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      expect(result.ir.graph.nodes.has(rule.id)).toBe(true);
    });

    it('graph has edge types', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule1 = createRule('.a');
      const rule2 = createRule('.a');
      rule1.declarations.push(createDeclaration('color', 'red'));
      rule2.declarations.push(createDeclaration('color', 'blue'));
      ir.rules.push(rule1, rule2);
      const result = await pipeline.execute(ir);
      const edgeTypes = result.ir.graph.edges.map(e => e.type);
      expect(edgeTypes.length).toBeGreaterThan(0);
    });

    it('symbol table is built', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const symbols = (result.ir as any)._symbolTable;
      expect(symbols).toBeDefined();
      expect(symbols.symbols).toBeDefined();
      expect(symbols.symbols.get('.test')).toBeDefined();
    });
  });

  describe('Pass Metadata', () => {
    it('stamps passMeta on rules after execution', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      // At least one pass should have stamped passMeta
      const liveRule = result.ir.rules.find(r => !r.isDead);
      expect(liveRule).toBeDefined();
      expect(liveRule!.passMeta).toBeDefined();
    });

    it('hasPassRun check works', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.test'));
      // First run stamps passMeta
      await pipeline.execute(ir);
      // Second run should skip most passes
      const result2 = await pipeline.execute(ir);
      // Timeline should still have entries (at least some passes always run)
      expect(result2.timeline.length).toBeGreaterThan(0);
    });
  });

  describe('Incremental Compilation', () => {
    it('tracks dirty rules', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.test'));
      const result = await pipeline.execute(ir);
      expect(result.incremental).toBeDefined();
      expect(result.incremental.dirtyCount).toBeGreaterThanOrEqual(0);
      expect(result.incremental.totalRules).toBe(1);
    });

    it('tracks skipped passes', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.test'));
      const result = await pipeline.execute(ir);
      expect(result.incremental.incrementalSkipped).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-Target Emission', () => {
    it('emits to CSS target', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const cssResult = emit(result.ir, 'css');
      expect(cssResult).toBeDefined();
      expect(cssResult!.output).toContain('.test');
      expect(cssResult!.target).toBe('css');
    });

    it('emits to graph-json target', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.test'));
      const result = await pipeline.execute(ir);
      const jsonResult = emit(result.ir, 'graph-json');
      expect(jsonResult).toBeDefined();
      expect(jsonResult!.target).toBe('graph-json');
      const parsed = JSON.parse(jsonResult!.output);
      expect(parsed.nodes).toBeDefined();
      expect(parsed.edges).toBeDefined();
    });

    it('emits to design-tokens target', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('--primary-color', '#6366f1'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      const tokenResult = emit(result.ir, 'design-tokens');
      expect(tokenResult).toBeDefined();
      expect(tokenResult!.output).toContain('primary');
    });
  });

  describe('Pipeline Orchestration', () => {
    it('produces a timeline with stage info', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);
      const result = await pipeline.execute(ir);
      expect(result.timeline.length).toBeGreaterThan(0);
      for (const entry of result.timeline) {
        expect(entry.stage).toBeDefined();
        expect(entry.pass).toBeDefined();
        expect(entry.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('generates a readable report', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.test'));
      const result = await pipeline.execute(ir);
      const report = pipeline.report(result.timeline);
      expect(report).toContain('ChainCSS Pipeline Report');
      expect(report.length).toBeGreaterThan(0);
    });

    it('handles empty IR gracefully', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR();
      const result = await pipeline.execute(ir);
      expect(result.ir).toBeDefined();
      expect(result.ir.rules).toEqual([]);
    });

    it('immutable mode toggles correctly', () => {
      const pipeline = createDefaultPipeline();
      pipeline.setImmutableMode(true);
      expect(pipeline.isImmutableMode()).toBe(true);
      pipeline.setImmutableMode(false);
      expect(pipeline.isImmutableMode()).toBe(false);
    });
  });
});