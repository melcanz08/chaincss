// __tests__/integration/framework/svelte.test.ts
// Tests for ChainCSS Svelte 5 Runtime

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the injector
vi.mock('../../../src/runtime/injector.js', () => ({
  compileRuntime: vi.fn((styles: Record<string, any>, moduleId: string) => {
    const result: Record<string, string> = {};
    for (const key of Object.keys(styles)) {
      result[key] = `chaincss-${key}-${moduleId}`;
    }
    return result;
  }),
  removeRuntimeModule: vi.fn(),
  styleInjector: {
    setTokens: vi.fn(),
    getTokens: vi.fn(() => ({})),
  },
}));

import { compileRuntime } from '../../../src/runtime/injector.js';
import {
  useAtomicClasses,
  cx,
  chainStyles,
} from '../../../src/runtime/svelte.js';

describe('Svelte Runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAtomicClasses', () => {
    it('returns a classes object with cx and cn helpers', () => {
      const styles = {
        button: { color: 'white', backgroundColor: 'blue' },
        card: { padding: '16px', borderRadius: '8px' },
      };

      const result = useAtomicClasses(styles);

      expect(result.classes).toBeDefined();
      expect(typeof result.cx).toBe('function');
      expect(typeof result.cn).toBe('function');
      expect(typeof result.inject).toBe('function');
    });

    it('accepts a factory function for styles', () => {
      const factory = () => ({
        dynamic: { color: 'red', fontSize: '16px' },
      });

      const result = useAtomicClasses(factory);

      expect(result.classes).toBeDefined();
      expect(typeof result.cx).toBe('function');
    });

    it('cx returns the class name for a given key', () => {
      const styles = { header: { display: 'flex' } };
      const result = useAtomicClasses(styles);

      const className = result.cx('header');
      expect(className).toBeTruthy();
      expect(typeof className).toBe('string');
    });

    it('cn joins multiple class names', () => {
      const styles = {
        header: { display: 'flex' },
        footer: { padding: '8px' },
      };
      const result = useAtomicClasses(styles);

      const combined = result.cn('header', 'footer');
      expect(combined).toBeTruthy();
      expect(combined).not.toBe('');
    });

    it('cn filters out missing class names', () => {
      const styles = { header: { display: 'flex' } };
      const result = useAtomicClasses(styles);

      const combined = result.cn('header', 'nonexistent', 'header');
      expect(typeof combined).toBe('string');
    });

    it('inject calls compileRuntime for additional styles', () => {
      const styles = { base: { color: 'black' } };
      const result = useAtomicClasses(styles);

      const beforeCalls = compileRuntime.mock.calls.length;

      result.inject({ extra: { color: 'green' } });

      expect(compileRuntime).toHaveBeenCalledTimes(beforeCalls + 1);
    });
  });

  describe('cx utility', () => {
    it('joins string arguments', () => {
      expect(cx('foo', 'bar')).toBe('foo bar');
    });

    it('filters falsy values', () => {
      expect(cx('foo', null, undefined, false, 'bar')).toBe('foo bar');
    });

    it('handles object with boolean values', () => {
      expect(cx('base', { active: true, disabled: false })).toBe('base active');
    });
  });

  describe('chainStyles', () => {
    it('returns class names for style definitions', () => {
      const styles = {
        container: { display: 'grid', gap: '16px' },
      };

      const classNames = chainStyles(styles);

      expect(classNames.container).toBeTruthy();
      expect(typeof classNames.container).toBe('string');
    });

    it('handles function-based style definitions', () => {
      const styles = {
        dynamic: () => ({ color: 'blue' }),
      };

      const classNames = chainStyles(styles);
      expect(classNames.dynamic).toBeTruthy();
    });
  });
});