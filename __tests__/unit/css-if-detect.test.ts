// ============================================================================
// __tests__/unit/css-if-detect.test.ts
// Tests for CSS if() detection in intent-engine (v2.3)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { intent } from '../../src/compiler/intent-engine.js';

describe('CSS if() Detection', () => {
  describe('detectIfPatterns', () => {
    it('detects conditional property from _conditions metadata', () => {
      const styles = {
        _conditions: {
          '--theme': {
            true: { backgroundColor: '#1a1a1a', color: 'white' },
            false: { backgroundColor: '#ffffff', color: 'black' },
          },
        },
      };

      const detected = intent.cssIf.detect(styles);
      expect(detected.length).toBe(2); // backgroundColor + color
      expect(detected[0].property).toBe('backgroundColor');
      expect(detected[0].variable).toBe('--theme');
      expect(detected[0].conditions).toEqual({ true: '#1a1a1a' });
      expect(detected[0].defaultValue).toBe('#ffffff');
    });

    it('returns empty array when no _conditions present', () => {
      const styles = { color: 'red', fontSize: '16px' };
      const detected = intent.cssIf.detect(styles);
      expect(detected).toEqual([]);
    });

    it('skips properties with same value in both branches', () => {
      const styles = {
        _conditions: {
          '--compact': {
            true: { padding: '8px', borderRadius: '4px' },
            false: { padding: '16px', borderRadius: '4px' }, // same border-radius
          },
        },
      };

      const detected = intent.cssIf.detect(styles);
      // Only padding should be detected (border-radius is same in both)
      const paddingCond = detected.find(d => d.property === 'padding');
      const radiusCond = detected.find(d => d.property === 'borderRadius');
      expect(paddingCond).toBeDefined();
      expect(radiusCond).toBeUndefined();
    });

    it('handles multiple condition variables', () => {
      const styles = {
        _conditions: {
          '--theme': {
            true: { backgroundColor: '#1a1a1a' },
            false: { backgroundColor: '#ffffff' },
          },
          '--compact': {
            true: { padding: '8px' },
            false: { padding: '16px' },
          },
        },
      };

      const detected = intent.cssIf.detect(styles);
      expect(detected.length).toBe(2);
    });
  });

  describe('emitCSSIf', () => {
    it('generates native CSS if() for single condition', () => {
      const css = intent.cssIf.emit('.card', [
        { property: 'background-color', variable: '--theme', conditions: { dark: '#1a1a1a' }, defaultValue: '#ffffff' },
      ]);

      expect(css).toContain('if(style(--theme: dark)');
      expect(css).toContain('#1a1a1a');
      expect(css).toContain('#ffffff');
      expect(css).toContain('@supports not (property: if())');
    });

    it('generates native CSS if() with else-if chain', () => {
      const css = intent.cssIf.emit('.btn', [
        {
          property: 'font-size',
          variable: '--size',
          conditions: { small: '12px', large: '24px' },
          defaultValue: '16px',
        },
      ]);

      expect(css).toContain('if(style(--size: small): 12px else if(style(--size: large): 24px else 16px))');
      expect(css).toContain('font-size:');
    });

    it('generates fallback modifier classes', () => {
      const css = intent.cssIf.emit('.header', [
        { property: 'color', variable: '--invert', conditions: { true: 'white' }, defaultValue: 'black' },
      ]);

      expect(css).toContain('.header--invert-true');
      expect(css).toContain('color: white');
    });

    it('returns empty string for no conditions', () => {
      const css = intent.cssIf.emit('.empty', []);
      expect(css).toBe('');
    });

    it('includes base properties in output', () => {
      const css = intent.cssIf.emit(
        '.card',
        [{ property: 'color', variable: '--dark', conditions: { true: 'white' }, defaultValue: 'black' }],
        { display: 'flex', padding: '16px' }
      );

      expect(css).toContain('display: flex');
      expect(css).toContain('padding: 16px');
    });
  });

  describe('End-to-end: detect + emit', () => {
    it('detects conditions and emits valid CSS if()', () => {
      const styles = {
        _conditions: {
          '--theme': {
            true: { backgroundColor: '#1a1a1a', color: 'white' },
            false: { backgroundColor: '#ffffff', color: 'black' },
          },
        },
      };

      const detected = intent.cssIf.detect(styles);
      const css = intent.cssIf.emit('.card', detected, { borderRadius: '8px' });

      expect(css).toContain('if(style(--theme: true)');
      expect(css).toContain('@supports not (property: if())');
      expect(css).toContain('borderRadius: 8px');
      expect(css).toContain('.card--theme-true');
    });
  });
});