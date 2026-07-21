// ============================================================================
// FILE: __tests__/math-engine.test.ts (NEW)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { math, add, subtract, multiply, divide, fluidType, convert, toPx, scale } from '../../src/compiler/math-engine.js';

describe('Math Engine', () => {
  describe('Parsing', () => {
    it('parses pixel values', () => {
      const result = math.parse('10px');
      expect(result).toEqual({ value: 10, unit: 'px' });
    });

    it('parses rem values', () => {
      const result = math.parse('2.5rem');
      expect(result).toEqual({ value: 2.5, unit: 'rem' });
    });

    it('parses viewport units', () => {
      const result = math.parse('50vw');
      expect(result).toEqual({ value: 50, unit: 'vw' });
    });

    it('parses percentage values', () => {
      const result = math.parse('100%');
      expect(result).toEqual({ value: 100, unit: '%' });
    });

    it('parses numbers as pixels', () => {
      const result = math.parse(42);
      expect(result).toEqual({ value: 42, unit: 'px' });
    });

    it('parses negative values', () => {
      const result = math.parse('-10px');
      expect(result).toEqual({ value: -10, unit: 'px' });
    });

    it('parses angle units', () => {
      const result = math.parse('45deg');
      expect(result).toEqual({ value: 45, unit: 'deg' });
    });
  });

  describe('Unit Compatibility', () => {
    it('detects compatible units (same unit)', () => {
      expect(math.compatible('10px', '20px')).toBe(true);
    });

    it('detects compatible units (same category)', () => {
      expect(math.compatible('10px', '2cm')).toBe(true);
    });

    it('detects incompatible units', () => {
      expect(math.compatible('10px', '2s')).toBe(false);
    });

    it('identifies unit categories', () => {
      expect(math.unitCategory('px')).toBe('absolute');
      expect(math.unitCategory('rem')).toBe('relative');
      expect(math.unitCategory('vw')).toBe('viewport');
      expect(math.unitCategory('deg')).toBe('angle');
      expect(math.unitCategory('s')).toBe('time');
    });
  });

  describe('Addition', () => {
    it('adds same-unit values directly', () => {
      const result = add('10px', '20px');
      expect(result.toString()).toBe('30px');
      expect(result.unit).toBe('px');
      expect(result.resolved).toEqual({ value: 30, unit: 'px' });
    });

    it('adds rem values', () => {
      const result = add('1rem', '2rem');
      expect(result.toString()).toBe('3rem');
    });

    it('resolves px + rem with context', () => {
      const result = add('10px', '2rem', { rootFontSize: 16 });
      expect(result.toString()).toBe('42px');
      expect(result.unit).toBe('px');
    });

    it('emits calc() for incompatible units', () => {
      const result = add('10px', '2vw');
      expect(result.unit).toBe('calc');
      expect(result.expression).toContain('calc');
      expect(result.expression).toContain('10px');
      expect(result.expression).toContain('2vw');
    });

    it('handles number input as px', () => {
      const result = add(10, 20);
      expect(result.toString()).toBe('30px');
    });

    it('includes explanations', () => {
      const result = add('10px', '20px');
      expect(result.explanations.length).toBeGreaterThan(0);
    });
  });

  describe('Subtraction', () => {
    it('subtracts same-unit values', () => {
      const result = subtract('50px', '20px');
      expect(result.toString()).toBe('30px');
    });

    it('handles negative results', () => {
      const result = subtract('10px', '50px');
      expect(result.toString()).toBe('-40px');
    });

    it('resolves rem - px with context', () => {
      const result = subtract('2rem', '10px', { rootFontSize: 16 });
      expect(result.toString()).toBe('22px');
    });
  });

  describe('Multiplication', () => {
    it('multiplies values', () => {
      const result = multiply('10px', 2);
      expect(result.toString()).toBe('20px');
    });
  });

  describe('Division', () => {
    it('divides values', () => {
      const result = divide('100px', 2);
      expect(result.toString()).toBe('50px');
    });
  });

  describe('Sum (multiple values)', () => {
    it('sums multiple values', () => {
      const result = math.sum('10px', '20px', '30px');
      expect(result.toString()).toBe('60px');
    });

    it('handles single value', () => {
      const result = math.sum('10px');
      expect(result.toString()).toBe('10px');
    });

    it('handles empty input', () => {
      const result = math.sum();
      expect(result.toString()).toBe('0px');
    });
  });

  describe('Unit Conversion', () => {
    it('converts px to rem', () => {
      const result = convert('32px', 'rem', { rootFontSize: 16 });
      expect(result.toString()).toBe('2rem');
    });

    it('converts rem to px', () => {
      const result = convert('2rem', 'px', { rootFontSize: 16 });
      expect(result.toString()).toBe('32px');
    });

    it('converts vw to px', () => {
      const result = convert('50vw', 'px', { viewportWidth: 1000 });
      expect(result.toString()).toBe('500px');
    });

    it('converts px to vw', () => {
      const result = convert('500px', 'vw', { viewportWidth: 1000 });
      expect(result.toString()).toBe('50vw');
    });
  });

  describe('toPx (resolve to pixels)', () => {
    it('resolves rem to px', () => {
      expect(toPx('2rem', { rootFontSize: 16 })).toBe(32);
    });

    it('resolves vw to px', () => {
      expect(toPx('50vw', { viewportWidth: 1000 })).toBe(500);
    });

    it('passes through px values', () => {
      expect(toPx('42px')).toBe(42);
    });

    it('handles numbers', () => {
      expect(toPx(42)).toBe(42);
    });
  });

  describe('Fluid Typography', () => {
    it('creates clamp() for responsive type', () => {
      const result = fluidType({ minSize: 14, maxSize: 20 });
      expect(result.expression).toContain('clamp');
      expect(result.expression).toContain('14px');
      expect(result.expression).toContain('20px');
      expect(result.expression).toContain('vw');
    });

    it('creates rem-based fluid type', () => {
      const result = fluidType({ minSize: 14, maxSize: 20, unit: 'rem', rootFontSize: 16 });
      expect(result.expression).toContain('clamp');
      expect(result.expression).toContain('rem');
      expect(result.expression).toContain('vw');
    });

    it('uses custom viewport range', () => {
      const result = fluidType({ minSize: 14, maxSize: 20, minWidth: 375, maxWidth: 1440 });
      expect(result.explanations.length).toBeGreaterThan(0);
    });
  });

  describe('Scale', () => {
    it('scales values by a factor', () => {
      const result = scale('10px', 2);
      expect(result.toString()).toBe('20px');
    });

    it('scales rem values', () => {
      const result = scale('1.5rem', 2);
      expect(result.toString()).toBe('3rem');
    });
  });

  describe('Clamp Value', () => {
    it('clamps values between min and max', () => {
      const result = math.clampValue('50px', '0px', '100px');
      expect(result.toString()).toBe('50px');
    });

    it('clamps values below min', () => {
      const result = math.clampValue('-10px', '0px', '100px');
      expect(result.toString()).toBe('0px');
    });

    it('clamps values above max', () => {
      const result = math.clampValue('200px', '0px', '100px');
      expect(result.toString()).toBe('100px');
    });

    it('emits clamp() for mixed units', () => {
      const result = math.clampValue('50vw', '0px', '100px');
      expect(result.expression).toContain('clamp');
    });
  });

  describe('CSS Min/Max', () => {
    it('creates min() expression', () => {
      const result = math.cssMin('10px', '20px', '50vw');
      expect(result).toContain('min(');
      expect(result).toContain('50vw');
    });

    it('creates max() expression', () => {
      const result = math.cssMax('10px', '20px');
      expect(result).toContain('max(');
    });
  });

  describe('Precision Formatting', () => {
    it('formats numbers with precision', () => {
      expect(math.precision(3.14159, 2)).toBe('3.14');
    });

    it('formats with default precision', () => {
      expect(math.precision(3.14159)).toBe('3.14');
    });
  });

  describe('toString and toCalc', () => {
    it('toString returns expression', () => {
      const result = add('10px', '20px');
      expect(result.toString()).toBe('30px');
    });

    it('toCalc wraps in calc()', () => {
      const result = add('10px', '20px');
      expect(result.toCalc()).toBe('calc(30px)');
    });

    it('toCalc for mixed units', () => {
      const result = add('10px', '2vw');
      expect(result.toCalc()).toContain('calc');
    });
  });
});