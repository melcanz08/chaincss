// ============================================================================
// __tests__/unit/accessibility-engine.test.ts
// Tests for Accessibility Intelligence Engine (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  accessibilityEngine,
  auditAccessibility,
  checkRule,
  accessibilityPass,
} from '../../src/compiler/accessibility-engine.js';
import { createIR, createRule, createDeclaration, resetIdCounter } from '../../src/compiler/style-ir.js';

function makeRule(sel: string, props: Record<string, string | number>): any {
  const rule = createRule(sel);
  for (const [prop, value] of Object.entries(props)) {
    rule.declarations.push(createDeclaration(prop, value));
  }
  return rule;
}

describe('Accessibility Engine', () => {
  beforeEach(() => resetIdCounter());

  describe('Contrast Detection', () => {
    it('flags low contrast text', () => {
      const rule = makeRule('.text', { color: '#999999', backgroundColor: '#f0f0f0' });
      const issues = checkRule(rule);
      const contrastIssues = issues.filter(i => i.category === 'contrast');
      expect(contrastIssues.length).toBeGreaterThan(0);
      expect(contrastIssues[0].severity).toBe('error');
      expect(contrastIssues[0].wcagCriterion).toContain('1.4.3');
    });

    it('does not flag high contrast (black on white)', () => {
      const rule = makeRule('.text', { color: '#000000', backgroundColor: '#ffffff' });
      const issues = checkRule(rule);
      const contrastIssues = issues.filter(i => i.category === 'contrast');
      expect(contrastIssues).toEqual([]);
    });

    it('warns for AAA failure but AA pass', () => {
      const rule = makeRule('.text', { color: '#666666', backgroundColor: '#ffffff' });
      const issues = checkRule(rule);
      const contrastIssues = issues.filter(i => i.category === 'contrast');
      expect(contrastIssues.length).toBeGreaterThan(0);
      expect(contrastIssues[0].severity).toBe('warning');
      expect(contrastIssues[0].message).toContain('AAA');
    });
  });

  describe('Font Size Detection', () => {
    it('flags font-size below 12px', () => {
      const rule = makeRule('.small', { fontSize: '10px' });
      const issues = checkRule(rule);
      const fsIssues = issues.filter(i => i.category === 'font-size');
      expect(fsIssues.length).toBeGreaterThan(0);
      expect(fsIssues[0].autoFixable).toBe(true);
      expect(fsIssues[0].suggestion).toContain('max(');
    });

    it('does not flag font-size >= 12px', () => {
      const rule = makeRule('.ok', { fontSize: '16px' });
      const issues = checkRule(rule);
      const fsIssues = issues.filter(i => i.category === 'font-size');
      expect(fsIssues).toEqual([]);
    });
  });

  describe('Touch Target Detection', () => {
    it('flags small touch targets on interactive elements', () => {
      const rule = makeRule('.btn', { cursor: 'pointer', width: '30px', height: '30px' });
      const issues = checkRule(rule);
      const ttIssues = issues.filter(i => i.category === 'touch-target');
      expect(ttIssues.length).toBeGreaterThan(0);
      expect(ttIssues[0].suggestion).toContain('44px');
    });

    it('skips non-interactive elements', () => {
      const rule = makeRule('.text', { width: '20px' });
      const issues = checkRule(rule);
      expect(issues.filter(i => i.category === 'touch-target')).toEqual([]);
    });

    it('passes 44×44px targets', () => {
      const rule = makeRule('.btn', { cursor: 'pointer', width: '48px', height: '48px' });
      const issues = checkRule(rule);
      expect(issues.filter(i => i.category === 'touch-target')).toEqual([]);
    });
  });

  describe('Focus Indicator Detection', () => {
    it('flags outline: none without focus-visible fallback', () => {
      const rule = makeRule('.btn', { cursor: 'pointer', outline: 'none' });
      const issues = checkRule(rule);
      const focusIssues = issues.filter(i => i.category === 'focus');
      expect(focusIssues.length).toBeGreaterThan(0);
      expect(focusIssues[0].severity).toBe('error');
    });

    it('warns when no focus indicator at all', () => {
      const rule = makeRule('.btn', { cursor: 'pointer' });
      const issues = checkRule(rule);
      const focusIssues = issues.filter(i => i.category === 'focus');
      expect(focusIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Motion Detection', () => {
    it('flags animations without prefers-reduced-motion', () => {
      const rule = makeRule('.animated', { animation: 'fadeIn 1s' });
      const issues = checkRule(rule);
      const motionIssues = issues.filter(i => i.category === 'motion');
      expect(motionIssues.length).toBeGreaterThan(0);
      expect(motionIssues[0].suggestion).toContain('prefers-reduced-motion');
    });

    it('does not flag when wrapped in reduced-motion query', () => {
      const rule = makeRule('.safe', { animation: 'fadeIn 1s' });
      rule.atRules.push({
        id: 'mq-1', type: 'media', query: '(prefers-reduced-motion: no-preference)',
        declarations: [], nestedRules: [], source: {}, history: [],
      });
      const issues = checkRule(rule);
      expect(issues.filter(i => i.category === 'motion')).toEqual([]);
    });
  });

  describe('Hover-Only Detection', () => {
    it('flags hover without focus-visible', () => {
      const rule = makeRule('.btn', { cursor: 'pointer' });
      rule.pseudoClasses.push({
        id: 'hover-1', name: 'hover',
        declarations: [createDeclaration('opacity', '0.8')],
        source: {}, history: [],
      });
      const issues = checkRule(rule);
      const hoverIssues = issues.filter(i => i.category === 'hover-only');
      expect(hoverIssues.length).toBeGreaterThan(0);
      expect(hoverIssues[0].message.toLowerCase()).toContain('keyboard');
    });

    it('does not flag when focus-visible also present', () => {
      const rule = makeRule('.btn', { cursor: 'pointer' });
      rule.pseudoClasses.push(
        { id: 'h', name: 'hover', declarations: [createDeclaration('opacity', '0.8')], source: {}, history: [] },
        { id: 'f', name: 'focus-visible', declarations: [createDeclaration('outline', '2px solid blue')], source: {}, history: [] },
      );
      const issues = checkRule(rule);
      expect(issues.filter(i => i.category === 'hover-only')).toEqual([]);
    });
  });

  describe('Full Audit', () => {
    it('returns report with summary', () => {
      const rules = [
        makeRule('.bad', { color: '#999', backgroundColor: '#f0f0f0', fontSize: '10px' }),
        makeRule('.good', { color: '#000', backgroundColor: '#fff', fontSize: '16px' }),
      ];
      const report = auditAccessibility(rules);
      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.summary).toBeTruthy();
    });

    it('returns success for fully compliant styles', () => {
      const rules = [makeRule('.good', { color: '#000', backgroundColor: '#fff', fontSize: '16px' })];
      const report = auditAccessibility(rules);
      expect(report.summary).toContain('passed');
    });
  });

  describe('accessibilityPass', () => {
    it('adds diagnostics to IR', () => {
      const ir = createIR();
      const rule = createRule('.bad');
      rule.declarations.push(
        createDeclaration('color', '#999'),
        createDeclaration('backgroundColor', '#eee'),
        createDeclaration('cursor', 'pointer'),
      );
      ir.rules.push(rule);

      const result = accessibilityPass(ir);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect((result.meta as any).accessibilityReport).toBeDefined();
    });

    it('auto-fixes minimum font size', () => {
      const ir = createIR();
      const rule = createRule('.small');
      rule.declarations.push(createDeclaration('fontSize', '10px'));
      ir.rules.push(rule);

      const result = accessibilityPass(ir);
      const fontSizeDecl = result.rules[0].declarations
        .find(d => d.property === 'fontSize');
      expect(fontSizeDecl!.value).toContain('max(');
      expect(fontSizeDecl!.value).toContain('12px');
    });

    it('auto-fixes missing focus indicator', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('cursor', 'pointer'));
      ir.rules.push(rule);

      const result = accessibilityPass(ir);
      expect(result.rules[0].pseudoClasses.some(pc =>
        pc.name === 'focus-visible'
      )).toBe(true);
    });
  });
});