import { describe, it, expect } from 'vitest';
import { chain } from '../../src/core/style-collector.js';

describe('Token Resolution', () => {
  describe('Chain with tokens', () => {
    it('should pass through color token references', () => {
      const result = chain().typography({color:'$colors.primary'}).$el('test');
      expect(result.color).toBeDefined();
    });
    it('should pass through spacing token references', () => {
      const result = chain().box({p:'$spacing.md'}).$el('test');
      expect(result.padding).toBeDefined();
    });
    it('should handle unknown token references gracefully', () => {
      const result = chain().typography({color:'$colors.nonexistent'}).$el('test');
      expect(result.color).toBeDefined();
    });
  });
  describe('Dynamic values', () => {
    it('should preserve functions', () => {
      const fn = () => '#3b82f6';
      const result = chain().raw('color', fn).$el('test');
      expect(result.color).toBe(fn);
    });
    it('should handle functions in when callbacks', () => {
      const result = chain().when(true, (c:any) => c.typography({color:'red'})).$el('test');
      expect(result.color).toBeDefined();
    });
    it('should handle token refs in nest callbacks', () => {
      const result = chain().nest('.child', (c:any) => c.typography({color:'blue'}).box({p:'8px'})).$el('parent');
      expect(result._nestedRules).toBeDefined();
      expect(result._nestedRules[0].styles.color).toBeDefined();
    });
  });
});
