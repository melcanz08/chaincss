// ============================================================================
// __tests__/unit/responsive-inference.test.ts
// Tests for Automatic Responsive Inference (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  responsiveInference,
  analyzeResponsive,
  generateResponsiveReport,
  autoFixIssue,
  autoFixAll,
  responsiveInferencePass,
} from '../../src/compiler/responsive-inference.js';
import { createIR, createRule, createDeclaration, resetIdCounter } from '../../src/compiler/style-ir.js';

describe('Responsive Inference', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('analyzeResponsive', () => {
    it('detects fixed width > 768px as overflow risk', () => {
      const issues = analyzeResponsive('.hero', { width: '1200px' });
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].category).toBe('overflow');
      expect(issues[0].severity).toBe('error');
      expect(issues[0].suggestedFix).toContain('min(100%');
    });

    it('detects fixed width > 1024px as error', () => {
      const issues = analyzeResponsive('.hero', { width: '1200px' });
      expect(issues[0].severity).toBe('error');
    });

    it('detects fixed width 800px as warning', () => {
      const issues = analyzeResponsive('.sidebar', { width: '800px' });
      expect(issues[0].severity).toBe('warning');
    });

    it('does not flag small fixed widths', () => {
      const issues = analyzeResponsive('.icon', { width: '24px' });
      expect(issues.filter(i => i.category === 'overflow')).toEqual([]);
    });

    it('detects 4 explicit grid columns', () => {
      const issues = analyzeResponsive('.grid', {
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
      });
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].category).toBe('grid');
      expect(issues[0].severity).toBe('error');
    });

    it('detects 3 grid columns as warning', () => {
      const issues = analyzeResponsive('.grid', {
        gridTemplateColumns: '1fr 1fr 1fr',
      });
      expect(issues[0].severity).toBe('warning');
    });

    it('detects auto-fit without minmax', () => {
      const issues = analyzeResponsive('.grid', {
        gridTemplateColumns: 'repeat(auto-fit, 300px)',
      });
      const autoFitIssue = issues.find(i => i.message.includes('auto-fit'));
      expect(autoFitIssue).toBeDefined();
      expect(autoFitIssue!.suggestedFix).toContain('minmax');
    });

    it('detects large font size > 32px', () => {
      const issues = analyzeResponsive('.title', { fontSize: '48px' });
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].category).toBe('typography');
      expect(issues[0].suggestedFix).toContain('clamp');
    });

    it('does not flag small font sizes', () => {
      const issues = analyzeResponsive('.body', { fontSize: '16px' });
      expect(issues.filter(i => i.category === 'typography')).toEqual([]);
    });

    it('detects large padding > 48px', () => {
      const issues = analyzeResponsive('.section', { padding: '64px' });
      const spacingIssue = issues.find(i => i.category === 'spacing');
      expect(spacingIssue).toBeDefined();
      expect(spacingIssue!.suggestedFix).toContain('@media');
    });

    it('detects height: 100vh → suggests 100dvh', () => {
      const issues = analyzeResponsive('.fullscreen', { height: '100vh' });
      const vhIssue = issues.find(i => i.category === 'viewport');
      expect(vhIssue).toBeDefined();
      expect(vhIssue!.suggestedFix).toContain('100dvh');
    });

    it('detects large gap > 32px', () => {
      const issues = analyzeResponsive('.grid', { gap: '48px' });
      const gapIssue = issues.find(i => i.message.includes('gap'));
      expect(gapIssue).toBeDefined();
    });

    it('returns empty for responsive-safe styles', () => {
      const issues = analyzeResponsive('.safe', {
        width: 'min(100%, 600px)',
        fontSize: 'clamp(16px, 3vw, 24px)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      });
      expect(issues).toEqual([]);
    });
  });

  describe('generateResponsiveReport', () => {
    it('reports critical + warnings + info', () => {
      const issues = analyzeResponsive('.hero', {
        width: '1200px',
        fontSize: '48px',
        padding: '64px',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
      });
      const report = generateResponsiveReport(issues);
      expect(report.criticalCount).toBeGreaterThan(0);
      expect(report.summary).toBeTruthy();
    });

    it('reports summary=success for no issues', () => {
      const report = generateResponsiveReport([]);
      expect(report.summary).toContain('No responsive issues');
      expect(report.criticalCount).toBe(0);
    });
  });

  describe('autoFix', () => {
    it('autoFixIssue returns the suggested fix', () => {
      const issues = analyzeResponsive('.hero', { width: '1200px' });
      const fix = autoFixIssue(issues[0]);
      expect(fix).toContain('min(100%');
    });

    it('autoFixAll returns all fixable suggestions', () => {
      const issues = analyzeResponsive('.hero', {
        width: '1200px',
        height: '100vh',
      });
      const fixes = autoFixAll(issues);
      expect(fixes.length).toBe(2);
      expect(fixes.some(f => f.includes('min(100%'))).toBe(true);
      expect(fixes.some(f => f.includes('100dvh'))).toBe(true);
    });
  });

  describe('responsiveInferencePass', () => {
    it('adds diagnostics to IR', () => {
      const ir = createIR();
      const rule = createRule('.hero');
      rule.declarations.push(createDeclaration('width', '1200px'));
      rule.declarations.push(createDeclaration('fontSize', '48px'));
      ir.rules.push(rule);

      const result = responsiveInferencePass(ir);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.some(d => d.message.includes('overflow'))).toBe(true);
      expect(result.diagnostics.some(d => d.message.includes('large'))).toBe(true);
    });

    it('skips dead rules', () => {
      const ir = createIR();
      const rule = createRule('.dead');
      rule.isDead = true;
      rule.declarations.push(createDeclaration('width', '1200px'));
      ir.rules.push(rule);

      const result = responsiveInferencePass(ir);
      expect(result.diagnostics).toEqual([]);
    });

    it('stores issues in IR meta', () => {
      const ir = createIR();
      const rule = createRule('.hero');
      rule.declarations.push(createDeclaration('width', '1200px'));
      ir.rules.push(rule);

      const result = responsiveInferencePass(ir);
      expect((result.meta as any).responsiveIssues).toBeDefined();
      expect((result.meta as any).responsiveIssues.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-end: problematic layout', () => {
    it('flags a desktop-only layout with multiple issues', () => {
      const issues = analyzeResponsive('.page', {
        width: '1400px',
        padding: '80px',
        fontSize: '56px',
        gridTemplateColumns: '300px 300px 300px 300px',
        gap: '48px',
        height: '100vh',
      });
      expect(issues.length).toBeGreaterThanOrEqual(5);
      expect(issues.some(i => i.severity === 'error')).toBe(true);
    });
  });
});