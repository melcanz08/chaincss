// ============================================================================
// __tests__/unit/pattern-learner.test.ts
// Tests for Style Pattern Learner (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  patternLearner,
  learnPatterns,
  getExtractionCandidates,
  patternLearningPass,
} from '../../src/compiler/pattern-learner.js';
import { createIR, createRule, createDeclaration, resetIdCounter } from '../../src/compiler/style-ir.js';

describe('Pattern Learner', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('learnPatterns', () => {
    it('detects repeated patterns', () => {
      const rules = [
        {
          selector: '.btn-primary',
          declarations: {
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: 'white',
            fontWeight: '600',
          },
          sourceFile: 'Button.tsx',
        },
        {
          selector: '.btn-submit',
          declarations: {
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: 'white',
            fontWeight: '600',
          },
          sourceFile: 'Form.tsx',
        },
        {
          selector: '.btn-cta',
          declarations: {
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: 'white',
            fontWeight: '600',
          },
          sourceFile: 'Modal.tsx',
        },
      ];

      const report = learnPatterns(rules);
      expect(report.totalPatterns).toBeGreaterThan(0);
      expect(report.clusters[0].frequency).toBe(3);
      expect(report.clusters[0].fileCount).toBe(3);
    });

    it('names button patterns correctly', () => {
      const rules = [
        {
          selector: '.btn',
          declarations: {
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: 'white',
          },
          sourceFile: 'Button.tsx',
        },
        {
          selector: '.submit',
          declarations: {
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: 'white',
          },
          sourceFile: 'Form.tsx',
        },
      ];

      const report = learnPatterns(rules);
      expect(report.clusters[0].suggestedName).toBe('primaryButton');
    });

    it('generates recipe code suggestion', () => {
      const rules = [
        {
          selector: '.btn',
          declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
          sourceFile: 'A.tsx',
        },
        {
          selector: '.center',
          declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
          sourceFile: 'B.tsx',
        },
      ];

      const report = learnPatterns(rules);
      expect(report.clusters[0].suggestedRecipe).toContain("recipe('flexCenter'");
      expect(report.clusters[0].suggestedRecipe).toContain('display');
    });

    it('calculates savings estimates', () => {
      const rules = [
        {
          selector: '.a',
          declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' },
          sourceFile: 'A.tsx',
        },
        {
          selector: '.b',
          declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' },
          sourceFile: 'B.tsx',
        },
        {
          selector: '.c',
          declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' },
          sourceFile: 'C.tsx',
        },
      ];

      const report = learnPatterns(rules);
      expect(report.clusters[0].savings.declarations).toBe(12); // 3 occurrences × 4 props
      expect(report.clusters[0].savings.linesEliminated).toBe(11);
      expect(report.clusters[0].savings.bundleReduction).toBeTruthy();
    });

    it('ranks by score (frequency × properties)', () => {
      const rules = [
        // Pattern A: 4 occurrences, 3 props = score 12
        { selector: '.a1', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'A.tsx' },
        { selector: '.a2', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'B.tsx' },
        { selector: '.a3', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'C.tsx' },
        { selector: '.a4', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'D.tsx' },
        // Pattern B: 2 occurrences, 5 props = score 10
        { selector: '.b1', declarations: { padding: '10px', borderRadius: '4px', backgroundColor: 'red', color: 'white', fontWeight: 'bold' }, sourceFile: 'E.tsx' },
        { selector: '.b2', declarations: { padding: '10px', borderRadius: '4px', backgroundColor: 'red', color: 'white', fontWeight: 'bold' }, sourceFile: 'F.tsx' },
      ];

      const report = learnPatterns(rules);
      expect(report.clusters[0].score).toBeGreaterThanOrEqual(report.clusters[1].score);
    });

    it('returns empty for all-unique styles', () => {
      const rules = [
        { selector: '.a', declarations: { color: 'red' }, sourceFile: 'A.tsx' },
        { selector: '.b', declarations: { color: 'blue' }, sourceFile: 'B.tsx' },
      ];

      const report = learnPatterns(rules, { minProperties: 1, minFrequency: 2 });
      expect(report.totalPatterns).toBe(0);
    });

    it('respects minFrequency option', () => {
      const rules = [
        { selector: '.a', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'A.tsx' },
        { selector: '.b', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'B.tsx' },
        { selector: '.c', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'C.tsx' },
      ];

      const report = learnPatterns(rules, { minFrequency: 3 });
      expect(report.totalPatterns).toBe(1);

      const report2 = learnPatterns(rules, { minFrequency: 5 });
      expect(report2.totalPatterns).toBe(0);
    });

    it('generates summary for empty report', () => {
      const report = learnPatterns([]);
      expect(report.summary).toContain('No repeated patterns');
    });

    it('generates summary with high-value count', () => {
      const rules = [
        { selector: '.a', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'A.tsx' },
        { selector: '.b', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'B.tsx' },
        { selector: '.c', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'C.tsx' },
      ];

      const report = learnPatterns(rules);
      expect(report.summary).toContain('patterns');
    });
  });

  describe('getExtractionCandidates', () => {
    it('returns patterns above score threshold', () => {
      const rules = [
        { selector: '.a1', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'A.tsx' },
        { selector: '.a2', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'B.tsx' },
        { selector: '.a3', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'C.tsx' },
        { selector: '.a4', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'D.tsx' },
      ];

      const candidates = getExtractionCandidates(rules, 8);
      expect(candidates.length).toBeGreaterThan(0);
    });

    it('returns empty when no patterns meet threshold', () => {
      const rules = [
        { selector: '.a', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'A.tsx' },
        { selector: '.b', declarations: { display: 'flex', justifyContent: 'center', alignItems: 'center' }, sourceFile: 'B.tsx' },
      ];

      const candidates = getExtractionCandidates(rules, 50);
      expect(candidates).toEqual([]);
    });
  });

  describe('patternLearningPass', () => {
    it('adds diagnostics for repeated patterns', () => {
      const ir = createIR();

      const props = [
        createDeclaration('display', 'flex'),
        createDeclaration('justifyContent', 'center'),
        createDeclaration('alignItems', 'center'),
      ];

      for (const sel of ['.btn1', '.btn2', '.btn3']) {
        const rule = createRule(sel);
        rule.declarations.push(...props.map(p => ({ ...p, id: p.id + '-' + sel })));
        rule.source.file = 'Test.tsx';
        ir.rules.push(rule);
      }

      const result = patternLearningPass(ir);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Pattern');
      expect(result.diagnostics[0].suggestion).toContain('recipe');
    });

    it('stores clusters in IR meta', () => {
      const ir = createIR();
      const props = [
        createDeclaration('display', 'flex'),
        createDeclaration('justifyContent', 'center'),
        createDeclaration('alignItems', 'center'),
      ];

      for (const sel of ['.a', '.b']) {
        const rule = createRule(sel);
        rule.declarations.push(...props.map(p => ({ ...p, id: p.id + '-' + sel })));
        rule.source.file = 'Test.tsx';
        ir.rules.push(rule);
      }

      const result = patternLearningPass(ir);
      expect((result.meta as any).patternClusters).toBeDefined();
      expect((result.meta as any).learningReport).toBeDefined();
    });

    it('handles empty IR gracefully', () => {
      const ir = createIR();
      const result = patternLearningPass(ir);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe('Fingerprinting', () => {
    it('generates consistent hash for same properties', () => {
      const fp1 = patternLearner.fingerprint([
        { property: 'color', value: 'red' },
        { property: 'margin', value: '10px' },
      ]);
      const fp2 = patternLearner.fingerprint([
        { property: 'margin', value: '10px' },
        { property: 'color', value: 'red' },
      ]);
      expect(fp1.hash).toBe(fp2.hash); // Same hash regardless of order
    });

    it('generates different hash for different values', () => {
      const fp1 = patternLearner.fingerprint([
        { property: 'color', value: 'red' },
      ]);
      const fp2 = patternLearner.fingerprint([
        { property: 'color', value: 'blue' },
      ]);
      expect(fp1.hash).not.toBe(fp2.hash);
    });
  });
});