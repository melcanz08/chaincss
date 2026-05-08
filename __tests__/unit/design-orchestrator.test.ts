// ============================================================================
// __tests__/unit/design-orchestrator.test.ts
// Tests for Design System Orchestrator (v2.3)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  orchestrator,
  contrastRatio,
  checkContrast,
  auditContrast,
  createContextualToken,
  resolveContextual,
  generateContextualCSS,
} from '../../src/compiler/design-orchestrator.js';

describe('Design Orchestrator', () => {
  describe('contrastRatio', () => {
    it('returns 21 for black on white', () => {
      const ratio = contrastRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('returns 1 for white on white', () => {
      const ratio = contrastRatio('#ffffff', '#ffffff');
      expect(ratio).toBeCloseTo(1, 0);
    });

    it('handles hex colors', () => {
      const ratio = contrastRatio('#1a1a1a', '#ffffff');
      expect(ratio).toBeGreaterThan(10);
    });

    it('handles short hex', () => {
      const ratio = contrastRatio('#000', '#fff');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('handles rgb()', () => {
      const ratio = contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('handles rgba()', () => {
      const ratio = contrastRatio('rgba(255, 255, 255, 1)', 'rgba(0, 0, 0, 1)');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('handles named colors', () => {
      const ratio = contrastRatio('white', 'black');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('returns -1 for unparseable colors', () => {
      const ratio = contrastRatio('not-a-color', '#fff');
      expect(ratio).toBe(-1);
    });
  });

  describe('checkContrast', () => {
    it('passes AA for black on white', () => {
      const result = checkContrast('#000000', '#ffffff');
      expect(result.passes.AA).toBe(true);
      expect(result.passes.AAA).toBe(true);
    });

    it('fails AA for gray on gray', () => {
      const result = checkContrast('#999999', '#aaaaaa');
      expect(result.passes.AA).toBe(false);
    });

    it('passes AA large text for #666 on #fff', () => {
      const result = checkContrast('#666666', '#ffffff');
      expect(result.passes.AALarge).toBe(true);
      expect(result.passes.AA).toBe(true);
    });

    it('provides suggestion for failing contrast', () => {
      const result = checkContrast('#cccccc', '#ffffff');
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion).toContain('fails AA');
    });

    it('has ratio between 1 and 21', () => {
      const result = checkContrast('#333333', '#ffffff');
      expect(result.ratio).toBeGreaterThan(1);
      expect(result.ratio).toBeLessThanOrEqual(21);
    });
  });

  describe('auditContrast', () => {
    it('reports all passing for good contrast', () => {
      const report = auditContrast([
        { selector: '.header', color: '#ffffff', backgroundColor: '#1a1a1a' },
        { selector: '.body', color: '#333333', backgroundColor: '#ffffff' },
      ]);
      expect(report.failCount).toBe(0);
      expect(report.passCount).toBe(2);
    });

    it('flags failures', () => {
      const report = auditContrast([
        { selector: '.bad', color: '#cccccc', backgroundColor: '#dddddd' },
      ]);
      expect(report.failCount).toBe(1);
      expect(report.failures.length).toBe(1);
    });

    it('returns summary string', () => {
      const report = auditContrast([
        { selector: '.test', color: '#000', backgroundColor: '#fff' },
      ]);
      expect(report.summary).toContain('pass AA');
    });

    it('handles empty input', () => {
      const report = auditContrast([]);
      expect(report.checks).toEqual([]);
      expect(report.failCount).toBe(0);
    });
  });

  describe('contextualToken', () => {
    it('creates a contextual token', () => {
      const token = createContextualToken('#1a1a1a', {
        '.dark-section': '#ffffff',
        '.hero': '#eeeeee',
      });
      expect(token.default).toBe('#1a1a1a');
      expect(token.contexts['.dark-section']).toBe('#ffffff');
    });

    it('resolves to default without context', () => {
      const token = createContextualToken('#1a1a1a', { '.dark': '#fff' });
      expect(resolveContextual(token, '.my-button')).toBe('#1a1a1a');
    });

    it('resolves to context match', () => {
      const token = createContextualToken('#1a1a1a', { '.dark-section': '#ffffff' });
      expect(resolveContextual(token, '.dark-section .my-button')).toBe('#ffffff');
    });

    it('resolves most specific context', () => {
      const token = createContextualToken('#1a1a1a', {
        '.dark': '#888888',
        '.dark-section': '#ffffff',
      });
      expect(resolveContextual(token, '.dark-section .my-button')).toBe('#ffffff');
      expect(resolveContextual(token, '.dark .other')).toBe('#888888');
    });
  });

  describe('generateContextualCSS', () => {
    it('generates CSS with default and context overrides', () => {
      const token = createContextualToken('#1a1a1a', {
        '.dark-section': '#ffffff',
      });
      const css = generateContextualCSS('--btn-color', token, '.btn');
      expect(css).toContain('.btn { --btn-color: #1a1a1a; }');
      expect(css).toContain('.dark-section .btn { --btn-color: #ffffff; }');
    });

    it('generates only default when no contexts', () => {
      const token = createContextualToken('#1a1a1a');
      const css = generateContextualCSS('--color', token, '.el');
      expect(css).toContain('.el { --color: #1a1a1a; }');
    });
  });

  describe('End-to-end: contrast audit flow', () => {
    it('audits a full component set', () => {
      const components = [
        { selector: '.btn-primary', color: '#ffffff', backgroundColor: '#2563eb' },
        { selector: '.btn-secondary', color: '#1f2937', backgroundColor: '#e5e7eb' },
        { selector: '.btn-ghost', color: '#9ca3af', backgroundColor: '#f3f4f6' }, // likely fails
      ];

      const report = orchestrator.auditContrast(components);
      expect(report.checks.length).toBe(3);
      // Primary and secondary should pass, ghost may fail
      expect(report.passCount).toBeGreaterThanOrEqual(2);
    });
  });
});