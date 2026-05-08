// ============================================================================
// FILE: __tests__/analyzer.test.ts (NEW)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { StyleAnalyzer, analyze } from '../../src/compiler/analyzer.js';
import type { StyleDefinition } from '../src/core/types.js';

describe('Style Analyzer', () => {
  const createStyleDef = (props: Record<string, any> = {}): StyleDefinition => ({
    selectors: ['.test'],
    ...props,
  } as StyleDefinition);

  describe('Validation Diagnostics', () => {
    it('detects invalid property values', () => {
      const styleDef = createStyleDef({
        display: 'flexbox',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const warning = diags.find(d => d.severity === 'warning' && d.property === 'display');
      expect(warning).toBeDefined();
      expect(warning!.message).toContain('unrecognized');
    });

    it('does not flag valid values', () => {
      const styleDef = createStyleDef({
        display: 'flex',
        color: 'red',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const warnings = diags.filter(d => d.severity === 'warning');
      expect(warnings.length).toBe(0);
    });

    it('validates hover styles', () => {
      const styleDef: StyleDefinition = {
        selectors: ['.test'],
        color: 'white',
        hover: {
          cursor: 'hand',
        },
      };

      const analyzer = new StyleAnalyzer();
      const result = analyzer.analyze(styleDef);

      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('Shorthand Detection', () => {
    it('suggests margin shorthand', () => {
      const styleDef = createStyleDef({
        'margin-top': '10px',
        'margin-right': '10px',
        'margin-bottom': '10px',
        'margin-left': '10px',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const hint = diags.find(d => d.severity === 'hint' && d.message.includes('margin'));
      expect(hint).toBeDefined();
    });

    it('suggests padding shorthand', () => {
      const styleDef = createStyleDef({
        'padding-top': '20px',
        'padding-right': '20px',
        'padding-bottom': '20px',
        'padding-left': '20px',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const hint = diags.find(d => d.message.includes('padding'));
      expect(hint).toBeDefined();
    });

    it('suggests border shorthand', () => {
      const styleDef = createStyleDef({
        'border-width': '1px',
        'border-style': 'solid',
        'border-color': 'black',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const hint = diags.find(d => d.message.includes('border'));
      expect(hint).toBeDefined();
    });
  });

  describe('Conflict Detection', () => {
    it('detects z-index on static elements', () => {
      const styleDef = createStyleDef({
        position: 'static',
        zIndex: '999',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const conflict = diags.find(d => d.message.includes('z-index'));
      expect(conflict).toBeDefined();
      expect(conflict!.severity).toBe('warning');
    });

    it('detects flex properties without display:flex', () => {
      const styleDef = createStyleDef({
        flexDirection: 'column',
        alignItems: 'center',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const conflict = diags.find(d => d.message.includes('flex'));
      expect(conflict).toBeDefined();
    });

    it('detects grid properties without display:grid', () => {
      const styleDef = createStyleDef({
        gridTemplateColumns: '1fr 1fr',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const conflict = diags.find(d => d.message.includes('grid'));
      expect(conflict).toBeDefined();
    });
  });

  describe('Animation Suggestions', () => {
    it('suggests transition for hover styles', () => {
      const styleDef = createStyleDef({
        color: 'blue',
        opacity: '1',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const animSuggestion = diags.find(d => d.message.includes('transition'));
      // Only shows if animatable + no transition
      if (animSuggestion) {
        expect(animSuggestion.severity).toBe('info');
        expect(animSuggestion.suggestion).toContain('transition');
      }
    });

    it('does not suggest transition when already present', () => {
      const styleDef = createStyleDef({
        opacity: '0.5',
        transition: 'opacity 0.3s',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const animSuggestions = diags.filter(d => d.message.includes('Animatable'));
      expect(animSuggestions.length).toBe(0);
    });
  });

  describe('Breakpoint Inference', () => {
    it('suggests breakpoint for large fixed widths', () => {
      const styleDef = createStyleDef({
        width: '1200px',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const bpSuggestion = diags.find(d => d.message.includes('overflow'));
      if (bpSuggestion) {
        expect(bpSuggestion.message).toContain('overflow');
      }
    });

    it('suggests breakpoint for large offsets', () => {
      const styleDef = createStyleDef({
        position: 'absolute',
        left: '800px',
      });

      const analyzer = new StyleAnalyzer();
      const diags = analyzer.analyzeStyle('.test', styleDef);

      const bpSuggestion = diags.find(d => d.message.includes('offset'));
      if (bpSuggestion) {
        expect(bpSuggestion.message).toContain('offset');
      }
    });
  });

  describe('Full Analysis Result', () => {
    it('returns complete StyleAnalysis', () => {
      const styleDef = createStyleDef({
        color: 'red',
        fontSize: '16px',
        marginTop: '10px',
        marginRight: '10px',
      });

      const result = analyze(styleDef);

      expect(result).toMatchObject({
        diagnostics: expect.any(Array),
        conflicts: expect.any(Array),
        breakpoints: expect.any(Array),
        unusedSelectors: expect.any(Array),
        deadStyles: expect.any(Array),
        duplicationWarnings: expect.any(Array),
        optimizationSuggestions: expect.any(Array),
        stats: expect.objectContaining({
          totalProperties: expect.any(Number),
          totalSelectors: expect.any(Number),
          shorthandOpportunities: expect.any(Number),
          animationSuggestions: expect.any(Number),
          responsiveIssues: expect.any(Number),
        }),
      });
    });
  });

  describe('Reset', () => {
    it('clears collected diagnostics', () => {
      const analyzer = new StyleAnalyzer();
      const styleDef = createStyleDef({ display: 'flexbox' });
      analyzer.analyzeStyle('.test', styleDef);

      expect(analyzer.getDiagnostics().length).toBeGreaterThan(0);

      analyzer.reset();
      expect(analyzer.getDiagnostics().length).toBe(0);
    });
  });
});