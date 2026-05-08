// ============================================================================
// __tests__/unit/layout-intelligence.test.ts
// Tests for Layout Intelligence Engine (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  layoutIntelligence,
  recognizeLayout,
  suggestMacro,
  getLayoutPatterns,
  layoutIntelligencePass,
} from '../../src/compiler/layout-intelligence.js';
import { createIR, createRule, createDeclaration, resetIdCounter } from '../../src/compiler/style-ir.js';

describe('Layout Intelligence', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('recognizeLayout', () => {
    it('recognizes stack-center pattern', () => {
      const matches = recognizeLayout({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      });
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern.name).toBe('stack-center');
      expect(matches[0].confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('recognizes flex-center pattern', () => {
      const matches = recognizeLayout({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      });
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some(m => m.pattern.name === 'flex-center')).toBe(true);
    });

    it('recognizes grid-center pattern', () => {
      const matches = recognizeLayout({
        display: 'grid',
        placeItems: 'center',
      });
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern.name).toBe('grid-center');
    });

    it('recognizes absolute-center pattern', () => {
      const matches = recognizeLayout({
        position: 'absolute',
        top: '50%',
        left: '50%',
      });
      expect(matches.some(m => m.pattern.name === 'absolute-center')).toBe(true);
    });

    it('recognizes sticky-top pattern', () => {
      const matches = recognizeLayout({
        position: 'sticky',
        top: '0',
      });
      expect(matches.some(m => m.pattern.name === 'sticky-top')).toBe(true);
    });

    it('recognizes pill-shape', () => {
      const matches = recognizeLayout({
        borderRadius: '9999px',
        padding: '8px 20px',
      });
      expect(matches.some(m => m.pattern.name === 'pill-shape')).toBe(true);
    });

    it('recognizes glass-effect', () => {
      const matches = recognizeLayout({
        backdropFilter: 'blur(16px)',
      });
      expect(matches.some(m => m.pattern.name === 'glass-effect')).toBe(true);
    });

    it('recognizes full-size', () => {
      const matches = recognizeLayout({
        width: '100%',
        height: '100%',
      });
      expect(matches.some(m => m.pattern.name === 'full-size')).toBe(true);
    });

    it('returns empty for unrecognized layout', () => {
      const matches = recognizeLayout({
        color: 'red',
        fontSize: '16px',
      });
      expect(matches).toEqual([]);
    });

    it('matches contain selector info', () => {
      const matches = recognizeLayout({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      });
      expect(matches[0].selector).toBeDefined();
      expect(matches[0].confidence).toBeGreaterThan(0);
    });
  });

  describe('suggestMacro', () => {
    it('suggests stack() for stack-center layout', () => {
      const suggestion = suggestMacro({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      });
      expect(suggestion).toContain('stack');
    });

    it('suggests center() for flex-center layout', () => {
      const suggestion = suggestMacro({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      });
      expect(suggestion).toBe('center()');
    });

    it('suggests glass() for glass effect', () => {
      const suggestion = suggestMacro({
        backdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(255,255,255,0.1)',
      });
      expect(suggestion).toBe('glass()');
    });

    it('returns null for unrecognized layout', () => {
      const suggestion = suggestMacro({
        color: 'blue',
        margin: '10px',
      });
      expect(suggestion).toBeNull();
    });
  });

  describe('getLayoutPatterns', () => {
    it('returns all known patterns', () => {
      const patterns = getLayoutPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(12);
      expect(patterns.some(p => p.name === 'stack-center')).toBe(true);
      expect(patterns.some(p => p.name === 'flex-center')).toBe(true);
      expect(patterns.some(p => p.name === 'grid-center')).toBe(true);
      expect(patterns.some(p => p.name === 'glass-effect')).toBe(true);
    });

    it('each pattern has required properties', () => {
      const patterns = getLayoutPatterns();
      for (const p of patterns) {
        expect(p.name).toBeTruthy();
        expect(p.required).toBeDefined();
        expect(Object.keys(p.required).length).toBeGreaterThan(0);
        expect(p.macro).toBeTruthy();
      }
    });
  });

  describe('layoutIntelligencePass', () => {
    it('detects duplicate patterns across rules', () => {
      const ir = createIR();

      const rule1 = createRule('.header');
      rule1.declarations.push(
        createDeclaration('display', 'flex'),
        createDeclaration('flexDirection', 'column'),
        createDeclaration('justifyContent', 'center'),
        createDeclaration('alignItems', 'center'),
      );
      ir.rules.push(rule1);

      const rule2 = createRule('.footer');
      rule2.declarations.push(
        createDeclaration('display', 'flex'),
        createDeclaration('flexDirection', 'column'),
        createDeclaration('justifyContent', 'center'),
        createDeclaration('alignItems', 'center'),
      );
      ir.rules.push(rule2);

      const result = layoutIntelligencePass(ir);

      // Should have duplicate detection + suggestions
      expect(result.diagnostics.length).toBeGreaterThan(0);
      const dupDiag = result.diagnostics.find(d => d.message.includes('found') && d.message.includes('times'));
      expect(dupDiag).toBeDefined();
    });

    it('adds suggestions to diagnostics', () => {
      const ir = createIR();
      const rule = createRule('.card');
      rule.declarations.push(
        createDeclaration('display', 'flex'),
        createDeclaration('justifyContent', 'center'),
        createDeclaration('alignItems', 'center'),
      );
      ir.rules.push(rule);

      const result = layoutIntelligencePass(ir);
      const sugDiag = result.diagnostics.find(d => d.message.includes('could use'));
      expect(sugDiag).toBeDefined();
      if (sugDiag) {
        expect(sugDiag.suggestion).toBeTruthy();
      }
    });

    it('stores pattern in rule meta', () => {
      const ir = createIR();
      const rule = createRule('.test');
      rule.declarations.push(
        createDeclaration('display', 'flex'),
        createDeclaration('justifyContent', 'center'),
        createDeclaration('alignItems', 'center'),
      );
      ir.rules.push(rule);

      const result = layoutIntelligencePass(ir);
      expect(result.rules[0].meta.layoutPattern).toBeDefined();
      expect(result.rules[0].meta.layoutConfidence).toBeGreaterThan(0);
    });

    it('handles empty IR gracefully', () => {
      const ir = createIR();
      const result = layoutIntelligencePass(ir);
      expect(result.diagnostics).toEqual([]);
    });
  });
});

  describe('Expanded Patterns — Intent Macros', () => {
    it('recognizes card layout', () => {
      const matches = recognizeLayout({
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      });
      expect(matches.some(m => m.pattern.name === 'card-layout')).toBe(true);
    });

    it('recognizes truncate text pattern', () => {
      const matches = recognizeLayout({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
      expect(matches.some(m => m.pattern.name === 'truncate-text')).toBe(true);
    });

    it('recognizes hidden element', () => {
      const matches = recognizeLayout({ display: 'none' });
      expect(matches.some(m => m.pattern.name === 'hidden-element')).toBe(true);
    });

    it('recognizes unselectable text', () => {
      const matches = recognizeLayout({ userSelect: 'none' });
      expect(matches.some(m => m.pattern.name === 'unselectable')).toBe(true);
    });

    it('recognizes scrollable container', () => {
      const matches = recognizeLayout({ overflow: 'auto' });
      expect(matches.some(m => m.pattern.name === 'scrollable')).toBe(true);
    });

    it('recognizes circle shape', () => {
      const matches = recognizeLayout({ borderRadius: '50%', width: '50px', height: '50px' });
      expect(matches.some(m => m.pattern.name === 'circle-shape')).toBe(true);
    });

    it('recognizes fixed position', () => {
      const matches = recognizeLayout({ position: 'fixed', top: '0', zIndex: '100' });
      expect(matches.some(m => m.pattern.name === 'fixed-position')).toBe(true);
    });

    it('recognizes focus ring', () => {
      const matches = recognizeLayout({ outline: '2px solid #3b82f6', outlineOffset: '2px' });
      expect(matches.some(m => m.pattern.name === 'focus-ring')).toBe(true);
    });

    it('recognizes safe area padding', () => {
      const matches = recognizeLayout({ paddingBottom: 'env(safe-area-inset-bottom)' });
      expect(matches.some(m => m.pattern.name === 'safe-area-bottom')).toBe(true);
    });

    it('recognizes container layout', () => {
      const matches = recognizeLayout({
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: '1200px',
      });
      expect(matches.some(m => m.pattern.name === 'container-layout')).toBe(true);
    });
  });

  describe('Pattern count', () => {
    it('has 35+ patterns', () => {
      const patterns = getLayoutPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(35);
    });
  });

