// ============================================================================
// FILE: __tests__/unit/hign-level-atomicCSS.test.ts
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { atomicExtractor } from '../../src/compiler/pipeline/optimizers/atomic-extractor.js';
import { parseIR } from '../../src/compiler/pipeline/ir/parser.js';
import type { StyleIR } from '../../src/compiler/pipeline/ir/types.js';

// Helper to create a simple IR from style objects
function createTestIR(styles: Record<string, any>): StyleIR {
  return parseIR(styles, 'test.chain.ts');
}

// Helper to run atomic extraction
function extractAtomic(styles: Record<string, any>, config?: any) {
  const ir = createTestIR(styles);
  const result = atomicExtractor.optimize(ir, { config });
  return result;
}

// Helper to count atomic rules in result
function countAtomicRules(ir: StyleIR): number {
  return ir.rules.filter(r => r.meta?.atomic === true).length;
}

// Helper to find a rule by selector
function findRule(ir: StyleIR, selector: string) {
  return ir.rules.find(r => r.selector === selector);
}

describe('Atomic Extractor', () => {
  describe('Basic Extraction', () => {
    it('should extract frequently used declarations as atomic classes', () => {
      const styles = {
        button1: {
          selectors: ['.btn-1'],
          padding: '16px',
          backgroundColor: '#6366f1',
        },
        button2: {
          selectors: ['.btn-2'],
          padding: '16px',
          backgroundColor: '#6366f1',
        },
        button3: {
          selectors: ['.btn-3'],
          padding: '16px',
          backgroundColor: '#6366f1',
        },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      
      expect(result.ir.rules.length).toBeGreaterThan(3);
      
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      expect(atomicRules.length).toBe(2); // padding and background-color
      
      const paddingRule = atomicRules.find(r => 
        r.declarations.some(d => d.property === 'padding')
      );
      expect(paddingRule).toBeDefined();
      expect(paddingRule!.selector).toBe('.p-16px');
      
      const bgRule = atomicRules.find(r => 
        r.declarations.some(d => d.property === 'background-color')
      );
      expect(bgRule).toBeDefined();
      expect(bgRule!.selector).toBe('.bg-6366f1');
    });

    it('should NOT extract declarations below threshold', () => {
      const styles = {
        button1: {
          selectors: ['.btn-1'],
          padding: '16px',
        },
        button2: {
          selectors: ['.btn-2'],
          padding: '20px',
        },
      };

      const result = extractAtomic(styles, { atomicThreshold: 2 });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      expect(atomicRules.length).toBe(0);
    });

    it('should extract at threshold exactly', () => {
      const styles = {
        el1: { selectors: ['.el-1'], margin: '8px' },
        el2: { selectors: ['.el-2'], margin: '8px' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 2 });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      expect(atomicRules.length).toBe(1);
      expect(atomicRules[0].selector).toBe('.m-8px');
    });
  });

  describe('Naming Conventions', () => {
    it('should generate readable names for common properties', () => {
      const styles = {
        el1: { selectors: ['.el-1'], backgroundColor: '#fff', fontSize: '16px' },
        el2: { selectors: ['.el-2'], backgroundColor: '#fff', fontSize: '16px' },
        el3: { selectors: ['.el-3'], backgroundColor: '#fff', fontSize: '16px' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      const selectors = atomicRules.map(r => r.selector);
      
      expect(selectors).toContain('.bg-fff');
      expect(selectors).toContain('.text-16px');
    });

    it('should handle negative values', () => {
      const styles = {
        el1: { selectors: ['.el-1'], marginTop: '-8px' },
        el2: { selectors: ['.el-2'], marginTop: '-8px' },
        el3: { selectors: ['.el-3'], marginTop: '-8px' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      expect(atomicRules[0].selector).toContain('neg-');
    });

    it('should handle important flag', () => {
      // The important flag is set via declaration.important, not via style object
      const ir = parseIR({
        el1: { selectors: ['.el-1'], color: '#fff' },
        el2: { selectors: ['.el-2'], color: '#fff' },
        el3: { selectors: ['.el-3'], color: '#fff' },
      });
      
      // Manually set important on declarations
      for (const rule of ir.rules) {
        for (const decl of rule.declarations) {
          decl.important = true;
        }
      }

      const result = atomicExtractor.optimize(ir, { config: { atomicThreshold: 3 } });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      expect(atomicRules[0].selector).toContain('imp-');
    });

    it('should sanitize special characters in class names', () => {
      const styles = {
        el1: { selectors: ['.el-1'], color: 'rgba(255,255,255,0.5)' },
        el2: { selectors: ['.el-2'], color: 'rgba(255,255,255,0.5)' },
        el3: { selectors: ['.el-3'], color: 'rgba(255,255,255,0.5)' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      // Should not contain invalid CSS class characters
      expect(atomicRules[0].selector).not.toContain('(');
      expect(atomicRules[0].selector).not.toContain(')');
      expect(atomicRules[0].selector).not.toContain(',');
      // The leading '.' is the class selector prefix, not part of the class name
      expect(atomicRules[0].selector.slice(1)).not.toContain('.');
    });
  });

  describe('Pseudo-class Extraction', () => {
    it('should extract hover styles as atomic classes', () => {
      const styles = {
        btn1: {
          selectors: ['.btn-1'],
          '&:hover': { backgroundColor: '#4f46e5' },
        },
        btn2: {
          selectors: ['.btn-2'],
          '&:hover': { backgroundColor: '#4f46e5' },
        },
        btn3: {
          selectors: ['.btn-3'],
          '&:hover': { backgroundColor: '#4f46e5' },
        },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      expect(atomicRules.length).toBeGreaterThan(0);
      
      const hoverRule = atomicRules.find(r => 
        r.pseudoClasses?.some(pc => pc.name === 'hover')
      );
      expect(hoverRule).toBeDefined();
      expect(hoverRule!.selector).toContain('hover');
    });

    it('should extract focus styles', () => {
      const styles = {
        input1: {
          selectors: ['.input-1'],
          '&:focus': { borderColor: '#6366f1' },
        },
        input2: {
          selectors: ['.input-2'],
          '&:focus': { borderColor: '#6366f1' },
        },
        input3: {
          selectors: ['.input-3'],
          '&:focus': { borderColor: '#6366f1' },
        },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      const focusRule = atomicRules.find(r => 
        r.pseudoClasses?.some(pc => pc.name === 'focus')
      );
      expect(focusRule).toBeDefined();
    });
  });

  describe('Media Query Extraction', () => {
    it('should NOT extract media query declarations as atomic classes (known limitation)', () => {
      // Media query atomic extraction is currently limited to nested rules within atRules
      // Direct declarations in atRules are not extracted
      const ir = parseIR({
        card1: { selectors: ['.card-1'] },
        card2: { selectors: ['.card-2'] },
        card3: { selectors: ['.card-3'] },
      });
      
      // Add media query with declarations to each rule
      for (const rule of ir.rules) {
        rule.atRules = [{
          id: `at-${rule.id}-media`,
          type: 'media',
          query: '(min-width: 768px)',
          declarations: [{ property: 'padding', value: '24px', history: [] }],
          nestedRules: [],
          source: rule.source,
          history: [],
        }];
      }

      const result = atomicExtractor.optimize(ir, { config: { atomicThreshold: 3 } });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      // Documented limitation: media query declarations are not extracted
      expect(atomicRules.length).toBe(0);
    });
  });

  describe('Substitution', () => {
    it('should replace declarations with atomic class references', () => {
      const styles = {
        el1: { selectors: ['.el-1'], padding: '16px' },
        el2: { selectors: ['.el-2'], padding: '16px' },
        el3: { selectors: ['.el-3'], padding: '16px' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      
      // Original rules should have atomicClasses
      const originalRule = findRule(result.ir, '.el-1');
      expect(originalRule).toBeDefined();
      expect(originalRule!.meta?.atomicClasses).toContain('p-16px');
      
      // Original declarations should be removed
      expect(originalRule!.declarations.length).toBe(0);
    });

    it('should not mark rules as dead if they have atomic classes', () => {
      const styles = {
        el1: { selectors: ['.el-1'], padding: '16px' },
        el2: { selectors: ['.el-2'], padding: '16px' },
        el3: { selectors: ['.el-3'], padding: '16px' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      
      const originalRule = findRule(result.ir, '.el-1');
      expect(originalRule!.isDead).toBe(false);
    });

    it('should keep rules alive if they have atomic classes', () => {
      const styles = {
        el1: { selectors: ['.el-1'], padding: '16px' },
        el2: { selectors: ['.el-2'], padding: '16px' },
        el3: { selectors: ['.el-3'], padding: '16px' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      
      // Rules with atomic classes should NOT be dead
      const originalRules = result.ir.rules.filter(r => 
        r.selector.startsWith('.el-') && !r.meta?.atomic
      );
      
      for (const rule of originalRules) {
        expect(rule.isDead).toBe(false);
      }
    });
  });

  describe('Deterministic Output', () => {
    it('should produce consistent results for same input', () => {
      const styles = {
        a: { selectors: ['.a'], padding: '16px', color: '#fff' },
        b: { selectors: ['.b'], padding: '16px', color: '#fff' },
        c: { selectors: ['.c'], padding: '16px', color: '#fff' },
      };

      const result1 = extractAtomic(styles, { atomicThreshold: 3 });
      const result2 = extractAtomic(styles, { atomicThreshold: 3 });
      
      const selectors1 = result1.ir.rules
        .filter(r => r.meta?.atomic === true)
        .map(r => r.selector)
        .sort();
      
      const selectors2 = result2.ir.rules
        .filter(r => r.meta?.atomic === true)
        .map(r => r.selector)
        .sort();
      
      expect(selectors1).toEqual(selectors2);
    });
  });

  describe('Savings Reporting', () => {
    it('should report bytes saved', () => {
      const styles = {
        el1: { selectors: ['.el-1'], padding: '16px' },
        el2: { selectors: ['.el-2'], padding: '16px' },
        el3: { selectors: ['.el-3'], padding: '16px' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      
      expect(result.savings.bytesSaved).toBeGreaterThan(0);
      expect(result.savings.declarationsEliminated).toBeGreaterThan(0);
      expect(result.changes).toBeGreaterThan(0);
    });

    it('should add diagnostic info', () => {
      const styles = {
        el1: { selectors: ['.el-1'], padding: '16px' },
        el2: { selectors: ['.el-2'], padding: '16px' },
        el3: { selectors: ['.el-3'], padding: '16px' },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      
      const diag = result.ir.diagnostics.find(d => d.pass === 'atomic-extractor');
      expect(diag).toBeDefined();
      expect(diag!.severity).toBe('info');
    });
  });

  describe('Edge Cases', () => {
    it('should handle array values', () => {
      const styles = {
        el1: { selectors: ['.el-1'], padding: ['16px', '1rem'] },
        el2: { selectors: ['.el-2'], padding: ['16px', '1rem'] },
        el3: { selectors: ['.el-3'], padding: ['16px', '1rem'] },
      };

      const result = extractAtomic(styles, { atomicThreshold: 3 });
      const atomicRules = result.ir.rules.filter(r => r.meta?.atomic === true);
      
      // Should extract both values
      expect(atomicRules.length).toBe(2);
    });

    it('should skip already atomic rules', () => {
      const styles = {
        el1: { selectors: ['.el-1'], padding: '16px' },
        el2: { selectors: ['.el-2'], padding: '16px' },
        el3: { selectors: ['.el-3'], padding: '16px' },
      };

      // First extraction
      const result1 = extractAtomic(styles, { atomicThreshold: 3 });
      
      // Second extraction should not double-extract
      const result2 = atomicExtractor.optimize(result1.ir, { config: { atomicThreshold: 3 } });
      
      const atomicCount1 = result1.ir.rules.filter(r => r.meta?.atomic === true).length;
      const atomicCount2 = result2.ir.rules.filter(r => r.meta?.atomic === true).length;
      
      expect(atomicCount2).toBe(atomicCount1);
    });

    it('should handle empty IR', () => {
      const ir: StyleIR = {
        id: 'test',
        rules: [],
        atRules: [],
        diagnostics: [],
        meta: {
          version: '1',
          createdAt: Date.now(),
          sourceFiles: [],
          passCount: 0,
          passes: [],
          dirtyRules: 0,
          compiledAt: Date.now(),
        },
      };

      const result = atomicExtractor.optimize(ir, {});
      expect(result.ir.rules.length).toBe(0);
      expect(result.changes).toBe(0);
    });
  });
});