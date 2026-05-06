import { describe, it, expect } from 'vitest';
import { helpers } from '../../src/compiler/helpers.js';

describe('Helpers', () => {
  describe('calc()', () => {
    it('should create calc expression', () => {
      expect(helpers.calc('100% - 20px')).toBe('calc(100% - 20px)');
    });
  });

  describe('add()', () => {
    it('should add values', () => {
      expect(helpers.add(10, 20)).toContain('calc');
    });
  });

  describe('subtract() / sub()', () => {
    it('should subtract values', () => {
      const result = helpers.subtract(100, 20);
      expect(result).toContain('calc');
      expect(result).toContain('-');
    });
  });

  describe('multiply() / mul()', () => {
    it('should multiply values', () => {
      const result = helpers.multiply(10, 2);
      expect(result).toContain('calc');
      expect(result).toContain('*');
    });
  });

  describe('divide() / div()', () => {
    it('should divide values', () => {
      const result = helpers.divide(100, 2);
      expect(result).toContain('calc');
      expect(result).toContain('/');
    });
  });

  describe('unit conversions', () => {
    it('mpx should convert to px', () => {
      expect(helpers.mpx(16)).toBe('16px');
    });
    it('rem should convert to rem', () => {
      expect(helpers.rem(16)).toBe('16rem');
    });
    it('em should convert to em', () => {
      expect(helpers.em(16)).toBe('16em');
    });
    it('percent should add %', () => {
      expect(helpers.percent(50)).toBe('50%');
    });
    it('vw should add vw', () => {
      expect(helpers.vw(100)).toBe('100vw');
    });
    it('vh should add vh', () => {
      expect(helpers.vh(100)).toBe('100vh');
    });
  });

  describe('min() / max() / clamp()', () => {
    it('min should work', () => {
      const result = helpers.min(100, 200);
      expect(result).toContain('min');
    });
    it('max should work', () => {
      const result = helpers.max(100, 200);
      expect(result).toContain('max');
    });
    it('clamp should work', () => {
      const result = helpers.clamp(16, 4, 24);
      expect(result).toContain('clamp');
    });
  });
});