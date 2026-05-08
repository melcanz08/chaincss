// ============================================================================
// FILE: __tests__/intent-engine.test.ts (NEW)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { intent, correct, heal, validate, getIntent } from '../../src/compiler/intent-engine.js';

describe('Intent Engine', () => {
  describe('Value Correction', () => {
    it('corrects "flexbox" to "flex"', () => {
      const result = correct('display', 'flexbox');
      expect(result).not.toBeNull();
      expect(result!.corrected).toBe('flex');
      expect(result!.confidence).toBeGreaterThan(0.9);
      expect(result!.defaults).toHaveProperty('display');
    });

    it('corrects "abs" to "absolute"', () => {
      const result = correct('position', 'abs');
      expect(result).not.toBeNull();
      expect(result!.corrected).toBe('absolute');
      expect(result!.explanation).toContain('absolute');
    });

    it('corrects "rel" to "relative"', () => {
      const result = correct('position', 'rel');
      expect(result).not.toBeNull();
      expect(result!.corrected).toBe('relative');
    });

    it('corrects "centered" to "center"', () => {
      const result = correct('text-align', 'centered');
      expect(result).not.toBeNull();
      expect(result!.corrected).toBe('center');
    });

    it('corrects "hand" cursor to "pointer"', () => {
      const result = correct('cursor', 'hand');
      expect(result).not.toBeNull();
      expect(result!.corrected).toBe('pointer');
    });

    it('corrects "scrollable" overflow to "auto"', () => {
      const result = correct('overflow', 'scrollable');
      expect(result).not.toBeNull();
      expect(result!.corrected).toBe('auto');
    });

    it('corrects "invisible" to "hidden"', () => {
      const result = correct('visibility', 'invisible');
      expect(result).not.toBeNull();
      expect(result!.corrected).toBe('hidden');
    });

    it('returns null for valid values', () => {
      const result = correct('display', 'flex');
      expect(result).toBeNull();
    });

    it('returns null for unknown corrections', () => {
      const result = correct('display', 'unknown-thing');
      expect(result).toBeNull();
    });
  });

  describe('Semantic Intent Detection', () => {
    it('detects "flexbox" intent', () => {
      const intentName = getIntent('flexbox', { property: 'display' });
      expect(intentName).toBe('flexbox-centering');
    });

    it('detects "abs" intent', () => {
      const intentName = getIntent('abs', { property: 'position' });
      expect(intentName).toBe('absolute-position');
    });

    it('detects "full" intent', () => {
      const intentName = getIntent('full', { property: 'size' });
      expect(intentName).toBe('full-size');
    });

    it('detects "rounded" intent', () => {
      const intentName = getIntent('rounded', { property: 'border-radius' });
      expect(intentName).toBe('rounded-pill');
    });

    it('returns null for unknown intent', () => {
      const intentName = getIntent('something-random');
      expect(intentName).toBeNull();
    });
  });

  describe('Property Name Correction', () => {
    it('suggests corrections for misspelled properties', () => {
      const result = correct('dispaly', 'flex');
      expect(result).not.toBeNull();
      // Should suggest display
    });

    it('returns null for correct property names', () => {
      const result = correct('display', 'flex');
      expect(result).toBeNull();
    });
  });

  describe('Context-Aware Defaults', () => {
    it('adds flexbox defaults', () => {
      const result = correct('display', 'flexbox');
      expect(result?.defaults).toEqual({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      });
    });

    it('adds full-size defaults', () => {
      const result = correct('size', 'full');
      expect(result?.defaults).toEqual({
        width: '100%',
        height: '100%',
      });
    });

    it('adds pill radius defaults', () => {
      const result = correct('border-radius', 'rounded');
      expect(result?.defaults).toEqual({
        borderRadius: '9999px',
      });
    });
  });

  describe('Validate', () => {
    it('validates correct values', () => {
      const result = validate('display', 'flex');
      expect(result.valid).toBe(true);
    });

    it('invalidates incorrect values with suggestion', () => {
      const result = validate('display', 'flexbox');
      expect(result.valid).toBe(false);
      expect(result.suggestion).toBe('flex');
    });

    it('invalidates unknown properties', () => {
      const result = validate('unknown-prop', 'value');
      expect(result.valid).toBe(false);
    });
  });

  describe('Heal (Full Style Object)', () => {
    it('heals in smart mode (fix + log)', () => {
      const styles = {
        display: 'flexbox',
        position: 'abs',
      };
      const result = heal(styles, 'smart');
      
      expect(result.fixed.display).toBe('flex');
      expect(result.fixed.position).toBe('absolute');
      expect(result.corrections.length).toBe(2);
      expect(result.warnings.length).toBe(2);
      expect(result.warnings[0]).toContain('auto-fix');
    });

    it('heals in dev mode (silent fix)', () => {
      const styles = {
        display: 'flexbox',
        position: 'abs',
      };
      const result = heal(styles, 'dev');
      
      expect(result.fixed.display).toBe('flex');
      expect(result.fixed.position).toBe('absolute');
      expect(result.corrections.length).toBe(2);
      expect(result.warnings.length).toBe(0); // No warnings in dev mode
    });

    it('does not fix in strict mode', () => {
      const styles = {
        display: 'flexbox',
      };
      const result = heal(styles, 'strict');
      
      expect(result.fixed.display).toBe('flexbox'); // Unchanged
      expect(result.corrections.length).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('strict');
    });

    it('preserves metadata keys', () => {
      const styles = {
        display: 'flexbox',
        _componentName: 'TestButton',
        selectors: ['.btn'],
      };
      const result = heal(styles, 'smart');
      
      expect(result.fixed._componentName).toBe('TestButton');
      expect(result.fixed.selectors).toEqual(['.btn']);
    });

    it('heals nested hover styles', () => {
      const styles = {
        hover: {
          cursor: 'hand',
        },
      };
      const result = heal(styles, 'smart');
      
      expect(result.fixed.hover.cursor).toBe('pointer');
      expect(result.corrections.length).toBe(1);
    });

    it('handles empty styles', () => {
      const result = heal({}, 'smart');
      expect(result.fixed).toEqual({});
      expect(result.corrections).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('adds defaults from intent rules', () => {
      const styles = {
        display: 'flexbox',
      };
      const result = heal(styles, 'smart');
      
      expect(result.fixed.justifyContent).toBe('center');
      expect(result.fixed.alignItems).toBe('center');
    });
  });

  describe('Correction Result Structure', () => {
    it('has all required fields', () => {
      const result = correct('display', 'flexbox');
      expect(result).toMatchObject({
        original: expect.any(String),
        property: expect.any(String),
        corrected: expect.any(String),
        defaults: expect.any(Object),
        confidence: expect.any(Number),
        intent: expect.any(String),
        explanation: expect.any(String),
      });
    });
  });

  describe('Get Known Properties', () => {
    it('returns list of known CSS properties', () => {
      const props = intent.getKnownProperties();
      expect(props).toContain('display');
      expect(props).toContain('position');
      expect(props).toContain('color');
      expect(Array.isArray(props)).toBe(true);
    });
  });

  describe('Get Corrections for Property', () => {
    it('returns corrections for a property', () => {
      const corrections = intent.getCorrections('display');
      expect(corrections.length).toBeGreaterThan(0);
      expect(corrections[0]).toHaveProperty('wrong');
      expect(corrections[0]).toHaveProperty('correct');
      expect(corrections[0]).toHaveProperty('confidence');
    });

    it('returns empty array for unknown property', () => {
      const corrections = intent.getCorrections('unknown');
      expect(corrections).toEqual([]);
    });
  });

  describe('Get Intents', () => {
    it('returns all semantic intents', () => {
      const intents = intent.getIntents();
      expect(Array.isArray(intents)).toBe(true);
      expect(intents.length).toBeGreaterThan(0);
      expect(intents[0]).toHaveProperty('pattern');
      expect(intents[0]).toHaveProperty('description');
    });
  });
});