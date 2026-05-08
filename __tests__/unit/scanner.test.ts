import { describe, it, expect } from 'vitest';
import { scanContent } from '../../src/compiler/scanner.js';

describe('Content Scanner', () => {
  describe('scanContent', () => {
    it('should find chain() calls', () => {
      const source = 'const s = chain().display("flex").$el("test");';
      const results = scanContent(source);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle $ calls', () => {
      const source = 'const s = $().display("flex").$el("test");';
      const results = scanContent(source);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle smartChain calls', () => {
      const source = 'const s = smartChain().display("flex").$el("test");';
      const results = scanContent(source);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find multiple calls in one file', () => {
      const source = `
        const a = chain().color("red").$el("a");
        const b = chain().color("blue").$el("b");
        const c = chain().color("green").$el("c");
      `;
      const results = scanContent(source);
      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for no matches', () => {
      const results = scanContent('const x = 1;');
      expect(results).toEqual([]);
    });
  });
});