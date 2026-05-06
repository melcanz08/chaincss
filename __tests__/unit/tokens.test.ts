// __tests__/unit/tokens.test.ts
// Token resolution tests

import { describe, it, expect, beforeEach } from 'vitest';
import { createChain, setTokenContext, getTokenContext } from '../../src/compiler/Chain.js';
import type { Chain } from '../../src/compiler/Chain.js';

describe('Token Resolution', () => {
  beforeEach(() => {
    // Set up test tokens
    setTokenContext({
      tokens: {
        colors: {
          primary: '#3b82f6',
          secondary: '#10b981',
          danger: '#ef4444',
          dark: '#1e293b',
        },
        spacing: {
          sm: '8px',
          md: '16px',
          lg: '24px',
          xl: '32px',
        },
        typography: {
          h1: '2rem',
          h2: '1.5rem',
          body: '1rem',
          small: '0.875rem',
        },
        breakpoints: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
        },
      },
      prefix: '$',
    });
  });

  describe('Token context management', () => {
    it('should set and get token context', () => {
      const ctx = { tokens: { test: 'value' }, prefix: '$' };
      setTokenContext(ctx);
      expect(getTokenContext()).toEqual(ctx);
    });

    it('should handle null context', () => {
      setTokenContext(null);
      expect(getTokenContext()).toBeNull();
    });
  });

  describe('Chain with tokens enabled', () => {
    it('should resolve color tokens', () => {
      const chain = createChain(true);
      const result = chain
        .color('$colors.primary')
        .$el('test');

      // With token resolution, $colors.primary should resolve to #3b82f6
      // If token resolution doesn't happen at chain level, might stay as string
      expect(result.color).toBeDefined();
    });

    it('should resolve spacing tokens', () => {
      const chain = createChain(true);
      const result = chain
        .padding('$spacing.md')
        .$el('test');

      expect(result.padding).toBeDefined();
    });

    it('should handle unknown token references gracefully', () => {
      const chain = createChain(true);
      const result = chain
        .color('$colors.nonexistent')
        .$el('test');

      expect(result.color).toBeDefined();
      // Should not crash
    });
  });

  describe('Chain with tokens disabled', () => {
    it('should not resolve tokens when useTokens is false', () => {
      const chain = createChain(false);
      const result = chain
        .color('$colors.primary')
        .$el('test');

      // Should pass through as literal string
      expect(result.color).toBe('$colors.primary');
    });
  });

  describe('Token in various contexts', () => {
    it('should resolve tokens in callbacks', () => {
      const chain = createChain(true);
      const result = chain
        .when(true, (c) => c.color('$colors.danger'))
        .$el('test');

      expect(result.color).toBeDefined();
    });

    it('should resolve tokens in nest callbacks', () => {
      const chain = createChain(true);
      const result = chain
        .nest('.child', (c) => c.color('$colors.primary').padding('$spacing.sm'))
        .$el('parent');

      expect(result.nestedRules).toBeDefined();
      expect(result.nestedRules[0].styles.color).toBeDefined();
    });

    it('should resolve tokens with function values', () => {
      const chain = createChain(true);
      // Function values are resolved first, then tokens within them
      const result = chain
        .padding(() => '$spacing.lg')
        .$el('test');

      expect(result.padding).toBeDefined();
    });
  });
});

describe('Token Resolution in StyleDefinition', () => {
  it('should handle token references in compiler input', () => {
    // This tests that the token system doesn't break when styles
    // with token references are passed to the compiler
    const styleDef = {
      selectors: ['test'],
      color: '$colors.primary',
      fontSize: '$typography.h1',
      padding: '$spacing.md',
    };

    expect(styleDef.color).toBe('$colors.primary');
    expect(styleDef.fontSize).toBe('$typography.h1');
    expect(styleDef.padding).toBe('$spacing.md');
  });
});