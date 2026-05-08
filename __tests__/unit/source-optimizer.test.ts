// ============================================================================
// __tests__/unit/source-optimizer.test.ts
// Tests for Source-Aware Optimization Engine (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  sourceOptimizer,
  optimizeSource,
  sourceOptimizerPass,
} from '../../src/compiler/source-optimizer.js';
import { createIR, createRule, createDeclaration, resetIdCounter } from '../../src/compiler/style-ir.js';

function makeRule(sel: string, props: Record<string, string | number>, file?: string, line?: number): any {
  const rule = createRule(sel);
  for (const [prop, value] of Object.entries(props)) {
    rule.declarations.push(createDeclaration(prop, value));
  }
  if (file) rule.source.file = file;
  if (line) rule.source.line = line;
  return rule;
}

describe('Source Optimizer', () => {
  beforeEach(() => resetIdCounter());

  describe('Duplicate Detection', () => {
    it('finds identical styles across files', () => {
      const rules = [
        makeRule('.btn-primary', { padding: '12px', borderRadius: '8px', backgroundColor: '#2563eb', color: 'white' }, 'Button.tsx', 42),
        makeRule('.submit-btn', { padding: '12px', borderRadius: '8px', backgroundColor: '#2563eb', color: 'white' }, 'Form.tsx', 128),
        makeRule('.cta-btn', { padding: '12px', borderRadius: '8px', backgroundColor: '#2563eb', color: 'white' }, 'Modal.tsx', 15),
      ];

      const report = optimizeSource(rules);
      expect(report.duplicates.length).toBe(1);
      expect(report.duplicates[0].count).toBe(3);
      expect(report.duplicates[0].occurrences[0].file).toBe('Button.tsx');
      expect(report.duplicates[0].occurrences[0].line).toBe(42);
    });

    it('skips rules with < 3 declarations', () => {
      const rules = [
        makeRule('.a', { color: 'red' }),
        makeRule('.b', { color: 'red' }),
      ];
      const report = optimizeSource(rules);
      expect(report.duplicates).toEqual([]);
    });

    it('skips dead rules', () => {
      const props = { padding: '12px', borderRadius: '8px', backgroundColor: 'red', color: 'white' };
      const live = makeRule('.live', props);
      const dead = makeRule('.dead', props);
      dead.isDead = true;

      const report = optimizeSource([live, dead]);
      expect(report.duplicates).toEqual([]); // Only 1 live, not a duplicate
    });

    it('generates extraction suggestion', () => {
      const props = { padding: '12px', borderRadius: '8px', backgroundColor: '#2563eb', color: 'white' };
      const rules = [
        makeRule('.a', props, 'A.tsx'),
        makeRule('.b', props, 'B.tsx'),
      ];
      const report = optimizeSource(rules);
      expect(report.duplicates[0].suggestion).toContain('Extract');
      expect(report.duplicates[0].savingsBytes).toBeGreaterThan(0);
    });
  });

  describe('Dead Rule Detection', () => {
    it('finds rules marked as dead', () => {
      const rule = makeRule('.legacy', { color: 'gray' }, 'Legacy.tsx', 55);
      rule.isDead = true;
      rule.meta.deathReason = 'Component deleted';

      const report = optimizeSource([rule]);
      expect(report.deadRules.length).toBe(1);
      expect(report.deadRules[0].selector).toBe('.legacy');
      expect(report.deadRules[0].reason).toBe('Component deleted');
      expect(report.deadRules[0].bytesWasted).toBeGreaterThan(0);
    });
  });

  describe('Specificity Conflicts', () => {
    it('detects high-specificity override', () => {
      const low = makeRule('.header', { color: 'black' }, 'Layout.tsx', 8);
      low.specificity = 10;

      const high = makeRule('#app .header', { color: 'red' }, 'Header.tsx', 15);
      high.specificity = 10100;

      const report = optimizeSource([low, high]);
      expect(report.specificityConflicts.length).toBeGreaterThan(0);
      expect(report.specificityConflicts[0].higher.specificity).toBe(10100);
      expect(report.specificityConflicts[0].lower.specificity).toBe(10);
    });

    it('detects property overlap', () => {
      const low = makeRule('.card', { color: 'black', margin: '10px' });
      low.specificity = 10;

      const high = makeRule('#app .card', { color: 'white' });
      high.specificity = 10110;

      const report = optimizeSource([low, high]);
      const conflict = report.specificityConflicts[0];
      expect(conflict.property).toBe('color');
    });
  });

  describe('Animation Conflicts', () => {
    it('detects same keyframe name in different files', () => {
      const rule1 = makeRule('.hero', {});
      rule1.atRules.push({ id: 'kf1', type: 'keyframes', name: 'fadeIn', declarations: [], nestedRules: [], source: {}, history: [] });
      rule1.source.file = 'Hero.tsx';

      const rule2 = makeRule('.modal', {});
      rule2.atRules.push({ id: 'kf2', type: 'keyframes', name: 'fadeIn', declarations: [], nestedRules: [], source: {}, history: [] });
      rule2.source.file = 'Modal.tsx';

      const report = optimizeSource([rule1, rule2]);
      expect(report.animationConflicts.length).toBe(1);
      expect(report.animationConflicts[0].name).toBe('fadeIn');
      expect(report.animationConflicts[0].count).toBe(2);
    });
  });

  describe('Media Query Redundancy', () => {
    it('detects repeated media queries', () => {
      const rules = [];
      for (let i = 0; i < 5; i++) {
        const rule = makeRule('.el' + i, { color: 'red' }, 'File' + i + '.tsx');
        rule.atRules.push({
          id: 'mq' + i, type: 'media', query: '(max-width: 768px)',
          declarations: [], nestedRules: [], source: {}, history: [],
        });
        rules.push(rule);
      }

      const report = optimizeSource(rules);
      expect(report.mediaQueryRedundancies.length).toBe(1);
      expect(report.mediaQueryRedundancies[0].count).toBe(5);
      expect(report.mediaQueryRedundancies[0].suggestion).toContain('breakpoint');
    });

    it('only flags 3+ occurrences', () => {
      const rules = [];
      for (let i = 0; i < 2; i++) {
        const rule = makeRule('.el' + i, { color: 'red' });
        rule.atRules.push({
          id: 'mq' + i, type: 'media', query: '(max-width: 768px)',
          declarations: [], nestedRules: [], source: {}, history: [],
        });
        rules.push(rule);
      }

      const report = optimizeSource(rules);
      expect(report.mediaQueryRedundancies).toEqual([]);
    });
  });

  describe('Full Report', () => {
    it('generates formatted report string', () => {
      const props = { padding: '12px', borderRadius: '8px', backgroundColor: '#2563eb', color: 'white' };
      const rules = [
        makeRule('.btn1', props, 'A.tsx', 10),
        makeRule('.btn2', props, 'B.tsx', 20),
      ];

      const report = optimizeSource(rules);
      expect(report.formattedReport).toBeTruthy();
      expect(report.formattedReport).toContain('ChainCSS Source-Aware Optimization Report');
      expect(report.formattedReport).toContain('DUPLICATES');
      expect(report.formattedReport).toContain('SUMMARY');
    });

    it('calculates summary statistics', () => {
      const props = { padding: '12px', borderRadius: '8px', backgroundColor: '#2563eb', color: 'white' };
      const rules = [
        makeRule('.btn1', props, 'A.tsx'),
        makeRule('.btn2', props, 'B.tsx'),
      ];

      const report = optimizeSource(rules);
      expect(report.summary.totalIssues).toBeGreaterThan(0);
      expect(report.summary.duplicatesCount).toBe(1);
      expect(report.summary.totalSavingsKB).toBeTruthy();
    });

    it('handles empty rules gracefully', () => {
      const report = optimizeSource([]);
      expect(report.summary.totalIssues).toBe(0);
      expect(report.formattedReport).toContain('SUMMARY');
    });
  });

  describe('sourceOptimizerPass', () => {
    it('adds diagnostics for found issues', () => {
      const ir = createIR();
      const props = [
        createDeclaration('padding', '12px'),
        createDeclaration('borderRadius', '8px'),
        createDeclaration('backgroundColor', '#2563eb'),
        createDeclaration('color', 'white'),
      ];

      for (const sel of ['.btn1', '.btn2']) {
        const rule = createRule(sel);
        rule.declarations.push(...props.map(p => ({ ...p, id: p.id + '-' + sel })));
        rule.source.file = 'Test.tsx';
        ir.rules.push(rule);
      }

      const result = sourceOptimizerPass(ir);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect((result.meta as any).optimizationReport).toBeDefined();
    });
  });
});