// __tests__/unit/recipe.test.ts
import { describe, it, expect } from 'vitest';
import { recipe } from '../../src/compiler/btt.js';

describe('Recipe System', () => {
  it('should create a recipe with base styles', () => {
    const btn = recipe({
      base: {
        selectors: ['btn'],
        display: 'inline-flex',
        padding: '12px 24px',
        borderRadius: '8px',
      },
    });

    const result = btn();
    expect(result.selectors).toContain('btn');
    expect(result.display).toBe('inline-flex');
    expect(result.padding).toBe('12px 24px');
  });

  it('should support variants', () => {
    const btn = recipe({
      base: {
        selectors: ['btn'],
        padding: '12px 24px',
      },
      variants: {
        size: {
          sm: { selectors: ['btn-sm'], padding: '8px 16px', fontSize: '14px' },
          lg: { selectors: ['btn-lg'], padding: '16px 32px', fontSize: '18px' },
        },
        color: {
          primary: { selectors: ['btn-primary'], background: '#3b82f6', color: 'white' },
          danger: { selectors: ['btn-danger'], background: '#ef4444', color: 'white' },
        },
      },
    });

    const smallPrimary = btn({ size: 'sm', color: 'primary' });
    expect(smallPrimary.padding).toBe('8px 16px');
    expect(smallPrimary.background).toBe('#3b82f6');

    const largeDanger = btn({ size: 'lg', color: 'danger' });
    expect(largeDanger.padding).toBe('16px 32px');
    expect(largeDanger.background).toBe('#ef4444');
  });

  it('should support defaultVariants', () => {
    const btn = recipe({
      base: {
        selectors: ['btn'],
        padding: '12px 24px',
      },
      variants: {
        size: {
          sm: { selectors: ['btn-sm'], padding: '8px 16px' },
          lg: { selectors: ['btn-lg'], padding: '16px 32px' },
        },
      },
      defaultVariants: {
        size: 'lg',
      },
    });

    // No selection should use default
    const result = btn();
    expect(result.padding).toBe('16px 32px');

    // Explicit selection overrides default
    const small = btn({ size: 'sm' });
    expect(small.padding).toBe('8px 16px');
  });

  it('should support compoundVariants', () => {
    const btn = recipe({
      base: {
        selectors: ['btn'],
        padding: '12px 24px',
      },
      variants: {
        size: {
          sm: { selectors: ['btn-sm'], padding: '8px 16px' },
          lg: { selectors: ['btn-lg'], padding: '16px 32px' },
        },
        outline: {
          true: { selectors: ['btn-outline'], background: 'transparent' },
        },
      },
      compoundVariants: [
        {
          variants: { size: 'lg', outline: 'true' as any },
          style: { selectors: ['btn-lg-outline'], borderWidth: '3px' },
        },
      ],
    });

    // Large + outline triggers compound
    const result = btn({ size: 'lg', outline: 'true' as any });
    expect(result.borderWidth).toBe('3px');
    expect(result.background).toBe('transparent');
  });

  it('should support function-based base styles', () => {
    const btn = recipe({
      base: () => ({
        selectors: ['dynamic-btn'],
        display: 'flex',
        padding: '16px',
      }),
    });

    const result = btn();
    expect(result.display).toBe('flex');
    expect(result.padding).toBe('16px');
  });

  it('should expose getAllVariants', () => {
    const btn = recipe({
      base: { selectors: ['btn'] },
      variants: {
        size: {
          sm: { selectors: ['btn-sm'], padding: '8px 16px' },
          lg: { selectors: ['btn-lg'], padding: '16px 32px' },
        },
      },
    });

    const allVariants = btn.getAllVariants();
    expect(Array.isArray(allVariants)).toBe(true);
    // Should have all combinations: sm, lg
    expect(allVariants.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle empty variants gracefully', () => {
    const btn = recipe({
      base: { selectors: ['btn'], color: 'red' },
    });

    const result = btn();
    expect(result.color).toBe('red');
  });

  it('should handle recipes with no base', () => {
    const btn = recipe({
      variants: {
        color: {
          red: { selectors: ['red'], color: 'red' },
        },
      },
      defaultVariants: {
        color: 'red',
      },
    });

    const result = btn();
    expect(result.color).toBe('red');
  });
});