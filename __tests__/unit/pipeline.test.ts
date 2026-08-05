import { describe, it, expect } from 'vitest';
import { 
  createDefaultPipeline, 
  createFullPipeline 
} from '../../src/compiler/pipeline/pipeline.js';
import { 
  createIR, 
  createRule, 
  createDeclaration 
} from '../../src/compiler/pipeline/ir/index.js';

describe('Pipeline', () => {
  describe('Normalization', () => {
    it.todo('normalizes selector whitespace and casing');
    it.todo('handles root selector canonicalization');
    it.todo('deduplicates duplicate declarations in same rule during normalization');
  });

  describe('Validation', () => {
    it('passes valid IR without error diagnostics', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.valid');
      rule.declarations.push(createDeclaration('display', 'flex'));
      ir.rules.push(rule);

      const result = await pipeline.process(ir);

      const errors = (result.ir.diagnostics ?? []).filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it.todo('reports unknown or invalid property names');
    it.todo('validates rule selector syntax');
  });

  describe('Optimization', () => {
    it('prunes empty rules without declarations or children', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.empty'));

      const result = await pipeline.process(ir);

      expect(result.ir.rules).toHaveLength(0);
    });

    it.todo('merges rules with identical selectors');
    it.todo('optimizes shorthand declarations where possible');
  });

  describe('Lowering', () => {
    it('lowers custom tokens to standard CSS custom properties', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.theme');
      rule.declarations.push(createDeclaration('color', 'var(--color-primary)'));
      ir.rules.push(rule);

      const result = await pipeline.process(ir);

      expect(result.ir.rules[0].declarations[0].value).toContain('var(--color-primary)');
    });

    it.todo('lowers nested rules to flat CSS selectors');
  });

  describe('Scheduler', () => {
    it('executes pipeline passes sequentially', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.sched-test'));

      const result = await pipeline.process(ir);

      expect(result.timeline.length).toBeGreaterThan(0);
    });

    it('executes asynchronously via process()', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);

      const promise = pipeline.process(ir);
      expect(promise).toBeInstanceOf(Promise);

      const result = await promise;
      expect(result.ir).toBeDefined();
    });

    it.todo('maintains deterministic IR state across execution');

    it('gracefully handles empty IR rule sets', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);

      const result = await pipeline.process(ir);

      expect(result.ir.rules).toHaveLength(0);
      expect(result.timeline.length).toBeGreaterThan(0);
    });
  });

  describe('Graph & Symbols', () => {
    it('builds a dependency graph from IR', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.test'));

      const result = await pipeline.process(ir);

      expect(result.ir.graph).toBeDefined();
      expect(result.ir.graph?.nodes).toBeInstanceOf(Map);
    });

    it('graph contains rule nodes when tokens or references exist', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'var(--color-primary)'));
      ir.rules.push(rule);

      const result = await pipeline.process(ir);

      expect(result.ir.graph?.nodes.size).toBeGreaterThan(0);
    });

    it('graph has valid structure', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.card'));

      const result = await pipeline.process(ir);

      expect(result.ir.graph).toBeDefined();
      expect(result.ir.graph?.nodes).toBeInstanceOf(Map);
      expect(Array.isArray(result.ir.graph?.edges)).toBe(true);
    });

    it('symbol table is built', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      ir.rules.push(rule);

      const result = await pipeline.process(ir);

      const symbols = (result.ir as any)._symbolTable;
      expect(symbols).toBeDefined();
    });
  });

  describe('Pass Metadata', () => {
    it('tracks pass execution in timeline', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);

      const result = await pipeline.process(ir);

      expect(result.timeline).toBeDefined();
      expect(result.timeline.length).toBeGreaterThan(0);
      expect(typeof result.totalDuration).toBe('number');
    });

    it('records pass execution count', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);

      const result = await pipeline.process(ir);

      expect(result.timeline.length).toBeGreaterThan(0);
    });
  });
});