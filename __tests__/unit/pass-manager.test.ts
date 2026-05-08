// ============================================================================
// __tests__/unit/pass-manager.test.ts
// Tests for Multi-Pass Optimization Pipeline (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PassManager,
  runDefaultPipeline,
  DEFAULT_PIPELINE,
  intentRecoveryPass,
  unitResolutionPass,
  validationPass,
  specificitySortPass,
  cssCompressionPass,
} from '../../src/compiler/pass-manager.js';
import { createIR, createRule, createDeclaration, parseIR, applyPass, resetIdCounter } from '../../src/compiler/style-ir.js';
import type { StyleIR } from '../../src/compiler/style-ir.js';

describe('Multi-Pass Pipeline', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('PassManager', () => {
    it('has 10 default passes', () => {
      const manager = new PassManager();
      expect(manager.getPassOrder().length).toBe(10);
    });

    it('sorts passes by dependencies', () => {
      const manager = new PassManager();
      const order = manager.getPassOrder();
      // intent-recovery must come before validation (validation requires it)
      expect(order.indexOf('intent-recovery')).toBeLessThan(order.indexOf('validation'));
      // specificity-sort must come before dead-elimination
      expect(order.indexOf('specificity-sort')).toBeLessThan(order.indexOf('dead-elimination'));
    });

    it('runs the full pipeline without errors', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('display', 'flexbox'));
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);

      const manager = new PassManager();
      const result = manager.run(ir);

      expect(result.results.length).toBe(10);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.summary).toContain('Pipeline complete');
    });

    it('generates a readable report', () => {
      const ir = createIR();
      ir.rules.push(createRule('.test'));

      const manager = new PassManager();
      manager.run(ir);
      const report = manager.report();

      expect(report).toContain('Multi-Pass Pipeline Report');
      expect(report).toContain('intent-recovery');
    });

    it('allows adding custom passes', () => {
      const manager = new PassManager([]);
      manager.addPass({
        name: 'intent-recovery',
        priority: 1,
        description: 'test',
        pass: (ir: StyleIR) => ir,
        requires: [],
        enabled: true,
      });
      expect(manager.getPassOrder()).toContain('intent-recovery');
    });

    it('allows removing passes', () => {
      const manager = new PassManager();
      expect(manager.getPassOrder()).toContain('css-compression');
      manager.removePass('css-compression');
      expect(manager.getPassOrder()).not.toContain('css-compression');
    });

    it('allows disabling passes', () => {
      const manager = new PassManager(DEFAULT_PIPELINE.map(p => ({ ...p })));
      manager.setPassEnabled('css-compression', false);
      expect(manager.getPassOrder()).not.toContain('css-compression');
    });

    it('throws on circular dependencies', () => {
      const manager = new PassManager([
        {
          name: 'pass-a',
          priority: 1,
          description: 'A',
          pass: (ir: StyleIR) => ir,
          requires: ['pass-b'],
          enabled: true,
        },
        {
          name: 'pass-b',
          priority: 2,
          description: 'B',
          pass: (ir: StyleIR) => ir,
          requires: ['pass-a'],
          enabled: true,
        },
      ]);
      expect(() => manager.run(createIR())).toThrow('Circular dependency');
    });

    it('throws on missing dependency', () => {
      expect(() => {
        new PassManager([{
          name: 'test',
          priority: 1,
          description: 'test',
          pass: (ir: StyleIR) => ir,
          requires: ['nonexistent' as any],
          enabled: true,
        }]);
      }).toThrow('requires "nonexistent"');
    });
  });

  describe('Intent Recovery Pass', () => {
    it('fixes flexbox → flex', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('display', 'flexbox'));
      ir.rules.push(rule);

      const result = applyPass(ir, intentRecoveryPass, 'intent-recovery');
      expect(result.rules[0].declarations[0].value).toBe('flex');
    });

    it('adds centering defaults for flexbox', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('display', 'flexbox'));
      ir.rules.push(rule);

      const result = applyPass(ir, intentRecoveryPass, 'intent-recovery');
      const props = result.rules[0].declarations.map(d => d.property);
      expect(props).toContain('justifyContent');
      expect(props).toContain('alignItems');
    });

    it('fixes abs → absolute', () => {
      const ir = createIR();
      const rule = createRule('.el');
      rule.declarations.push(createDeclaration('position', 'abs'));
      ir.rules.push(rule);

      const result = applyPass(ir, intentRecoveryPass, 'intent-recovery');
      expect(result.rules[0].declarations[0].value).toBe('absolute');
    });

    it('records transform history', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('display', 'flexbox'));
      ir.rules.push(rule);

      const result = applyPass(ir, intentRecoveryPass, 'intent-recovery');
      const history = result.rules[0].declarations[0].history;
      const lastEntry = history[history.length - 1];
      expect(lastEntry.pass).toBe('intent-recovery');
      expect(lastEntry.action).toBe('corrected-value');
    });
  });

  describe('Unit Resolution Pass', () => {
    it('adds px to number values', () => {
      const ir = createIR();
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('width', 100 as any));
      ir.rules.push(rule);

      const result = applyPass(ir, unitResolutionPass, 'unit-resolution');
      expect(result.rules[0].declarations[0].value).toBe('100px');
    });

    it('does not add px to unitless properties', () => {
      const ir = createIR();
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('opacity', 0.5));
      ir.rules.push(rule);

      const result = applyPass(ir, unitResolutionPass, 'unit-resolution');
      expect(result.rules[0].declarations[0].value).toBe(0.5);
    });
  });

  describe('Validation Pass', () => {
    it('flags z-index on static elements', () => {
      const ir = createIR();
      const rule = createRule('.el');
      rule.declarations.push(createDeclaration('position', 'static'));
      rule.declarations.push(createDeclaration('zIndex', '999'));
      ir.rules.push(rule);

      const result = applyPass(ir, validationPass, 'validation');
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('z-index');
    });

    it('flags flex properties without display:flex', () => {
      const ir = createIR();
      const rule = createRule('.el');
      rule.declarations.push(createDeclaration('justifyContent', 'center'));
      ir.rules.push(rule);

      const result = applyPass(ir, validationPass, 'validation');
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Flex properties');
    });
  });

  describe('Specificity Sort Pass', () => {
    it('sorts rules by specificity', () => {
      const ir = createIR();
      const low = createRule('.low');
      const high = createRule('#high');
      ir.rules.push(high, low);

      const result = applyPass(ir, specificitySortPass, 'specificity-sort');
      expect(result.rules[0].selector).toBe('.low');
      expect(result.rules[1].selector).toBe('#high');
    });
  });

  describe('CSS Compression Pass', () => {
    it('shortens hex colors', () => {
      const ir = createIR();
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', '#ffffff'));
      ir.rules.push(rule);

      const result = applyPass(ir, cssCompressionPass, 'css-compression');
      expect(result.rules[0].declarations[0].value).toBe('#fff');
    });

    it('keeps non-shortenable hex', () => {
      const ir = createIR();
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', '#1a2b3c'));
      ir.rules.push(rule);

      const result = applyPass(ir, cssCompressionPass, 'css-compression');
      expect(result.rules[0].declarations[0].value).toBe('#1a2b3c');
    });
  });

  describe('runDefaultPipeline', () => {
    it('processes a full IR end-to-end', () => {
      const ir = createIR();

      const rule1 = createRule('.btn');
      rule1.declarations.push(createDeclaration('display', 'flexbox'));
      rule1.declarations.push(createDeclaration('color', '#ffffff'));
      rule1.declarations.push(createDeclaration('position', 'static'));
      rule1.declarations.push(createDeclaration('zIndex', '999'));

      const rule2 = createRule('#hero');
      rule2.declarations.push(createDeclaration('width', 200 as any));

      ir.rules.push(rule1, rule2);

      const result = runDefaultPipeline(ir);

      expect(result.results.length).toBe(10);
      // Verify intent recovery ran
      const btnRule = result.ir.rules.find(r => r.selector === '.btn');
      expect(btnRule!.declarations.some(d => d.property === 'justifyContent')).toBe(true);
      // Verify unit resolution ran
      const heroRule = result.ir.rules.find(r => r.selector === '#hero');
      expect(heroRule!.declarations[0].value).toBe('200px');
      // Verify validation ran
      expect(result.ir.diagnostics.length).toBeGreaterThan(0);
    });

    it('produces a summary', () => {
      const ir = createIR();
      ir.rules.push(createRule('.test'));

      const result = runDefaultPipeline(ir);
      expect(result.summary).toContain('Pipeline complete');
      expect(result.summary).toContain('passes');
    });
  });
});