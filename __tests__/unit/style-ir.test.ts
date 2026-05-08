// ============================================================================
// __tests__/unit/style-ir.test.ts
// Tests for Style IR System (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  styleIR,
  createIR,
  parseIR,
  generateCSS,
  createRule,
  createDeclaration,
  applyPass,
  applyPasses,
  compileViaIR,
  countNodes,
  debugIR,
  findRule,
  resetIdCounter,
} from '../../src/compiler/style-ir.js';
import type { StyleIR, IRRule } from '../../src/compiler/style-ir.js';

describe('Style IR System', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('IR Factory', () => {
    it('creates an empty IR', () => {
      const ir = createIR();
      expect(ir.rules).toEqual([]);
      expect(ir.diagnostics).toEqual([]);
      expect(ir.meta.version).toBe('1.0.0');
    });

    it('creates a rule', () => {
      const rule = createRule('.btn');
      expect(rule.selector).toBe('.btn');
      expect(rule.declarations).toEqual([]);
      expect(rule.isDead).toBe(false);
    });

    it('creates a declaration', () => {
      const decl = createDeclaration('color', 'red');
      expect(decl.property).toBe('color');
      expect(decl.value).toBe('red');
      expect(decl.history.length).toBe(1);
      expect(decl.history[0].pass).toBe('parser');
    });

    it('records transform history', () => {
      const decl = createDeclaration('color', 'red');
      decl.history.push({
        pass: 'intent-engine',
        action: 'corrected-value',
        timestamp: Date.now(),
        previous: 'flexbox',
        reason: 'Mapped flexbox → flex',
      });
      expect(decl.history.length).toBe(2);
      expect(decl.history[1].pass).toBe('intent-engine');
    });
  });

  describe('parseIR — StyleDefinition → IR', () => {
    it('parses a simple style definition', () => {
      const styles = {
        button: {
          selectors: ['.btn'],
          color: 'white',
          backgroundColor: 'blue',
          padding: '10px',
        },
      };

      const ir = parseIR(styles);
      expect(ir.rules.length).toBe(1);
      expect(ir.rules[0].selector).toBe('.btn');
      expect(ir.rules[0].declarations.length).toBe(3);
    });

    it('parses hover pseudo-classes', () => {
      const styles = {
        button: {
          selectors: ['.btn'],
          color: 'white',
          hover: {
            backgroundColor: 'darkblue',
          },
        },
      };

      const ir = parseIR(styles);
      expect(ir.rules[0].pseudoClasses.length).toBe(1);
      expect(ir.rules[0].pseudoClasses[0].name).toBe('hover');
      expect(ir.rules[0].pseudoClasses[0].declarations.length).toBe(1);
      expect(ir.rules[0].pseudoClasses[0].declarations[0].property).toBe('backgroundColor');
    });

    it('parses media query at-rules', () => {
      const styles = {
        responsive: {
          selectors: ['.responsive'],
          color: 'black',
          atRules: [
            { type: 'media', query: '(max-width: 768px)', styles: { color: 'blue' } },
          ],
        },
      };

      const ir = parseIR(styles);
      expect(ir.rules[0].atRules.length).toBe(1);
      expect(ir.rules[0].atRules[0].type).toBe('media');
      expect(ir.rules[0].atRules[0].query).toContain('max-width');
    });

    it('parses CSS if() conditions', () => {
      const styles = {
        card: {
          selectors: ['.card'],
          _ifConditions: [
            { property: 'background', variable: '--theme', conditions: { dark: '#1a1a1a' }, defaultValue: '#ffffff' },
          ],
        },
      };

      const ir = parseIR(styles);
      expect(ir.rules[0].conditions.length).toBe(1);
      expect(ir.rules[0].conditions[0].variable).toBe('--theme');
    });

    it('skips metadata keys', () => {
      const styles = {
        comp: {
          selectors: ['.comp'],
          _componentName: 'Test',
          _framework: 'react',
          color: 'red',
        },
      };

      const ir = parseIR(styles);
      expect(ir.rules[0].declarations.length).toBe(1);
      expect(ir.rules[0].declarations[0].property).toBe('color');
    });

    it('handles multiple components', () => {
      const styles = {
        header: { selectors: ['.header'], color: 'white' },
        footer: { selectors: ['.footer'], color: 'gray' },
      };

      const ir = parseIR(styles);
      expect(ir.rules.length).toBe(2);
    });

    it('uses component name as fallback selector', () => {
      const styles = {
        myComponent: { color: 'red' },
      };

      const ir = parseIR(styles);
      expect(ir.rules[0].selector).toBe('.myComponent');
    });
  });

  describe('generateCSS — IR → CSS', () => {
    it('generates CSS from simple IR', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('color', 'white'));
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('.btn {');
      expect(css).toContain('color: white;');
    });

    it('converts camelCase to kebab-case', () => {
      const ir = createIR();
      const rule = createRule('.card');
      rule.declarations.push(createDeclaration('backgroundColor', 'blue'));
      rule.declarations.push(createDeclaration('borderRadius', '8px'));
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('background-color: blue;');
      expect(css).toContain('border-radius: 8px;');
    });

    it('generates hover pseudo-class CSS', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('color', 'white'));
      rule.pseudoClasses.push({
        id: 'hover-1',
        name: 'hover',
        declarations: [createDeclaration('backgroundColor', 'darkblue')],
        source: {},
        history: [],
      });
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('.btn:hover {');
      expect(css).toContain('background-color: darkblue;');
    });

    it('skips dead rules', () => {
      const ir = createIR();
      const rule = createRule('.dead');
      rule.isDead = true;
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toBe('');
    });

    it('generates CSS if() output', () => {
      const ir = createIR();
      const rule = createRule('.card');
      rule.conditions.push({
        id: 'cond-1',
        property: 'background',
        variable: '--theme',
        conditions: { dark: '#1a1a1a' },
        defaultValue: '#ffffff',
        source: {},
      });
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('if(style(--theme: dark)');
      expect(css).toContain('#1a1a1a');
    });
  });

  describe('Pass System', () => {
    it('applies a single pass', () => {
      const ir = createIR();
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);

      const colorPass = (ir: StyleIR): StyleIR => {
        for (const rule of ir.rules) {
          for (const decl of rule.declarations) {
            if (decl.property === 'color' && decl.value === 'red') {
              decl.value = 'blue';
              decl.history.push({
                pass: 'test-pass',
                action: 'changed-color',
                timestamp: Date.now(),
                previous: 'red',
                reason: 'Test pass',
              });
            }
          }
        }
        return ir;
      };

      const result = applyPass(ir, colorPass, 'test-pass');
      expect(result.rules[0].declarations[0].value).toBe('blue');
      expect(result.meta.passes).toContain('test-pass');
      expect(result.meta.passCount).toBe(1);
    });

    it('applies multiple passes in sequence', () => {
      const ir = createIR();
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);

      const pass1 = (ir: StyleIR): StyleIR => {
        ir.rules[0].declarations[0].value = 'green';
        return ir;
      };
      const pass2 = (ir: StyleIR): StyleIR => {
        ir.rules[0].declarations[0].value = 'blue';
        return ir;
      };

      const result = applyPasses(ir, [
        { name: 'pass-1', pass: pass1 },
        { name: 'pass-2', pass: pass2 },
      ]);

      expect(result.rules[0].declarations[0].value).toBe('blue');
      expect(result.meta.passes).toEqual(['pass-1', 'pass-2']);
      expect(result.meta.passCount).toBe(2);
    });
  });

  describe('compileViaIR — full pipeline', () => {
    it('compiles styles through IR and back', () => {
      const styles = {
        button: {
          selectors: ['.btn'],
          color: 'white',
          backgroundColor: 'blue',
        },
      };

      const result = compileViaIR(styles);
      expect(result.css).toContain('.btn');
      expect(result.css).toContain('color: white');
      expect(result.css).toContain('background-color: blue');
      expect(result.ir.rules.length).toBe(1);
    });

    it('applies transform passes during compilation', () => {
      const styles = {
        test: { selectors: ['.test'], display: 'flexbox' },
      };

      const healingPass = (ir: StyleIR): StyleIR => {
        for (const rule of ir.rules) {
          for (const decl of rule.declarations) {
            if (decl.property === 'display' && decl.value === 'flexbox') {
              decl.value = 'flex';
              decl.history.push({
                pass: 'healing',
                action: 'corrected',
                timestamp: Date.now(),
                previous: 'flexbox',
                reason: 'flexbox → flex',
              });
            }
          }
        }
        return ir;
      };

      const result = compileViaIR(styles, [{ name: 'healing', pass: healingPass }]);
      expect(result.css).toContain('display: flex');
      expect(result.ir.meta.passes).toContain('healing');
    });
  });

  describe('Utilities', () => {
    it('countNodes returns accurate counts', () => {
      const ir = createIR();
      const rule = createRule('.a');
      rule.declarations.push(createDeclaration('color', 'red'));
      rule.declarations.push(createDeclaration('margin', '10px'));
      rule.pseudoClasses.push({
        id: 'h1', name: 'hover', declarations: [createDeclaration('color', 'blue')], source: {}, history: [],
      });
      ir.rules.push(rule);

      const counts = countNodes(ir);
      expect(counts.rules).toBe(1);
      expect(counts.declarations).toBe(2);
      expect(counts.pseudoClasses).toBe(1);
    });

    it('findRule locates by selector', () => {
      const ir = createIR();
      ir.rules.push(createRule('.header'));
      ir.rules.push(createRule('.footer'));

      expect(findRule(ir, '.header')).toBeDefined();
      expect(findRule(ir, '.missing')).toBeUndefined();
    });

    it('debugIR returns readable summary', () => {
      const ir = createIR();
      ir.rules.push(createRule('.test'));
      const debug = debugIR(ir);
      expect(debug).toContain('rules: 1');
      expect(debug).toContain('StyleIR');
    });

    it('cloneIR creates deep copy', () => {
      const ir = createIR();
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('color', 'red'));
      ir.rules.push(rule);

      const clone = styleIR.cloneIR(ir);
      clone.rules[0].declarations[0].value = 'blue';

      // Original should be unchanged
      expect(ir.rules[0].declarations[0].value).toBe('red');
      expect(clone.rules[0].declarations[0].value).toBe('blue');
    });
  });
});