// ============================================================================
// __tests__/unit/constraint-solver.test.ts
// Tests for Constraint-Based Styling Engine (v2.3)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  constraintSolver,
  resolveConstraint,
  resolveStickyUntil,
  resolveContainerQuery,
  parseConstraint,
} from '../../src/compiler/constraint-solver.js';

describe('Constraint Solver', () => {
  describe('resolveConstraint', () => {
    it('width < parent → max-width: 100%', () => {
      const result = resolveConstraint({
        property: 'width',
        operator: '<',
        expression: 'parent',
      });
      expect(result.cssProperty).toBe('max-width');
      expect(result.cssValue).toBe('100%');
      expect(result.method).toBe('direct');
    });

    it('width > parent → min-width: 100%', () => {
      const result = resolveConstraint({
        property: 'width',
        operator: '>',
        expression: 'parent',
      });
      expect(result.cssProperty).toBe('min-width');
      expect(result.cssValue).toBe('100%');
    });

    it('height = width * 0.5 → aspect-ratio', () => {
      const result = resolveConstraint({
        property: 'height',
        operator: '=',
        expression: 'width * 0.5',
      });
      expect(result.cssProperty).toBe('aspect-ratio');
      expect(result.method).toBe('aspect-ratio');
      expect(result.cssValue).toContain('/');
    });

    it('width = parent.width / 2 → calc()', () => {
      const result = resolveConstraint({
        property: 'width',
        operator: '=',
        expression: '100% / 2',
      });
      expect(result.method).toBe('calc');
      expect(result.cssValue).toContain('calc');
    });

    it('width = 100vw - 40 → direct', () => {
      const result = resolveConstraint({
        property: 'width',
        operator: '=',
        expression: '100vw - 40px',
      });
      expect(result.cssProperty).toBe('width');
    });

    it('fontSize = clamp(14, parent.width / 20, 24) → clamp()', () => {
      const result = resolveConstraint({
        property: 'fontSize',
        operator: '=',
        expression: 'clamp(14px, 100% / 20, 24px)',
      });
      expect(result.cssValue).toContain('clamp');
      expect(result.method).toBe('clamp');
    });

    it('provides human-readable explanation', () => {
      const result = resolveConstraint({
        property: 'width',
        operator: '<',
        expression: 'parent',
      });
      expect(result.explanation).toBeTruthy();
      expect(result.explanation).toContain('max-width');
    });
  });

  describe('resolveStickyUntil', () => {
    it('generates sticky + scroll-timeline', () => {
      const result = resolveStickyUntil('.sidebar', '#footer');
      expect(result.cssProperty).toBe('position');
      expect(result.cssValue).toContain('sticky');
      expect(result.cssValue).toContain('animation-timeline');
      expect(result.method).toBe('sticky');
      expect(result.explanation).toContain('sticky until #footer');
    });
  });

  describe('resolveContainerQuery', () => {
    it('generates container query for width condition', () => {
      const result = resolveContainerQuery('columns', '>=', '3', '> 768px');
      expect(result.atRule.type).toBe('container');
      expect(result.atRule.query).toBe('(min-width: 768px)');
      expect(result.atRule.declarations[0]).toEqual({ property: 'columns', value: '3' });
    });

    it('handles rem conditions', () => {
      const result = resolveContainerQuery('columns', '>=', '2', '> 48rem');
      expect(result.atRule.query).toBe('(min-width: 48rem)');
    });

    it('provides explanation', () => {
      const result = resolveContainerQuery('columns', '>=', '3', '> 768px');
      expect(result.explanation).toContain('@container');
      expect(result.explanation).toContain('768px');
    });
  });

  describe('parseConstraint', () => {
    it('parses width < parent', () => {
      const c = parseConstraint('width', '< parent');
      expect(c.property).toBe('width');
      expect(c.operator).toBe('<');
      expect(c.expression).toBe('parent');
    });

    it('parses height = width * 0.5', () => {
      const c = parseConstraint('height', '= width * 0.5');
      expect(c.operator).toBe('=');
      expect(c.expression).toBe('width * 0.5');
    });

    it('parses with when condition', () => {
      const c = parseConstraint('columns', '>= 3 when > 768px');
      expect(c.operator).toBe('>=');
      expect(c.expression).toBe('3');
      expect(c.condition).toBe('> 768px');
    });
  });

  describe('Reference Resolution', () => {
    it('resolves parent → 100%', () => {
      expect(constraintSolver.resolveReference('parent')).toBe('100%');
    });

    it('resolves parent.width → 100%', () => {
      expect(constraintSolver.resolveReference('parent.width')).toBe('100%');
    });

    it('resolves viewport → 100vw', () => {
      expect(constraintSolver.resolveReference('viewport')).toBe('100vw');
    });

    it('passes through unknown refs', () => {
      expect(constraintSolver.resolveReference('custom-value')).toBe('custom-value');
    });
  });

  describe('Expression Parser', () => {
    it('parses width * 0.5', () => {
      const parsed = constraintSolver.parseExpression('width * 0.5');
      expect(parsed.left).toBe('width');
      expect(parsed.operator).toBe('*');
      expect(parsed.right).toBe('0.5');
      expect(parsed.isFunction).toBe(false);
    });

    it('parses clamp() function', () => {
      const parsed = constraintSolver.parseExpression('clamp(14px, 100%/20, 24px)');
      expect(parsed.isFunction).toBe(true);
      expect(parsed.functionName).toBe('clamp');
      expect(parsed.functionArgs!.length).toBe(3);
    });

    it('parses simple value', () => {
      const parsed = constraintSolver.parseExpression('100%');
      expect(parsed.left).toBe('100%');
      expect(parsed.operator).toBe('');
    });
  });
});