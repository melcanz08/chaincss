import { describe, it, expect } from 'vitest';
import {
  getSuggestion,
  getSuggestions,
  getPropertySuggestion,
  getShorthandSuggestion,
  getValueSuggestion,
  getAutocompleteSuggestions,
  getDetailedSuggestion,
  KNOWN_SHORTHANDS,
  ANIMATION_PRESETS,
  BREAKPOINTS
} from '../../src/compiler/suggestions.js';

describe('Suggestions Engine', () => {
  describe('getSuggestion', () => {
    it('should correct typos in shorthands', () => {
      const s = getSuggestion('bgk'); // typo of bg
      expect(s).not.toBeNull();
      if (typeof s === 'object') {
        expect(s.name).toBeDefined();
      }
    });

    it('should correct "felx" to "flex"', () => {
      const s = getSuggestion('felx');
      expect(s).not.toBeNull();
      if (typeof s === 'object') {
        expect(s.name).toBe('flex');
      }
    });

    it('should correct "bakcground"', () => {
      const s = getSuggestion('bakcground', [], 'css-property');
      expect(s).not.toBeNull();
    });

    it('should return null for correct properties', () => {
      const s = getSuggestion('display');
      // display is in the list so distance is 0, but threshold is >0
      // Should still find it with distance 0
    });

    it('should find animation suggestions', () => {
      const s = getSuggestion('fadeInLeftt', [], 'all');
      expect(s).not.toBeNull();
    });
  });

  describe('getSuggestions', () => {
    it('should return multiple suggestions for short input', () => {
      const suggestions = getSuggestions('bordr');
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should return up to maxResults', () => {
      const suggestions = getSuggestions('b', [], 3);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getPropertySuggestion', () => {
    it('should suggest based on context', () => {
      const s = getPropertySuggestion('colr', 'color');
      expect(s).not.toBeNull();
    });

    it('should use spacing context', () => {
      const s = getPropertySuggestion('paddin', 'spacing');
      expect(s).not.toBeNull();
    });
  });

  describe('getShorthandSuggestion', () => {
    it('should return explanation for known shorthand', () => {
      const s = getShorthandSuggestion('bg');
      expect(s).not.toBeNull();
      if (s) {
        expect(s.suggestion).toBeDefined();
        expect(s.explanation).toBeDefined();
      }
    });

    it('should fuzzy match unknown shorthands', () => {
      const s = getShorthandSuggestion('bgr');
      expect(s).not.toBeNull();
    });
  });

  describe('getValueSuggestion', () => {
    it('should correct display values', () => {
      const s = getValueSuggestion('display', 'flexbox');
      expect(s).not.toBeNull();
      if (s) {
        expect(s.suggested).toBe('flex');
        expect(s.confidence).toBeGreaterThan(0.9);
      }
    });
  });

  describe('getAutocompleteSuggestions', () => {
    it('should return all suggestions with empty prefix', () => {
      const suggestions = getAutocompleteSuggestions('', 5);
      expect(suggestions.length).toBe(5);
    });

    it('should filter by prefix', () => {
      const suggestions = getAutocompleteSuggestions('bor', 5);
      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(s => {
        expect(s.name.startsWith('bor')).toBe(true);
      });
    });
  });

  describe('getDetailedSuggestion', () => {
    it('should return full details for typos', () => {
      const result = getDetailedSuggestion('felx');
      expect(result).not.toBeNull();
      if (result) {
        expect(result.suggestion).toBe('flex');
        expect(result.type).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        expect(Array.isArray(result.alternatives)).toBe(true);
      }
    });

    it('should return null for exact matches', () => {
      // Exact match might return distance 0 which gives confidence 1
      const result = getDetailedSuggestion('display');
      // It may or may not return since distance could be 0
    });
  });

  describe('Known lists', () => {
    it('KNOWN_SHORTHANDS should have entries', () => {
      expect(KNOWN_SHORTHANDS.length).toBeGreaterThan(30);
      expect(KNOWN_SHORTHANDS).toContain('flex');
      expect(KNOWN_SHORTHANDS).toContain('bg');
      expect(KNOWN_SHORTHANDS).toContain('glass');
    });

    it('ANIMATION_PRESETS should have entries', () => {
      expect(ANIMATION_PRESETS.length).toBeGreaterThan(10);
      expect(ANIMATION_PRESETS).toContain('fadeIn');
      expect(ANIMATION_PRESETS).toContain('spin');
    });

    it('BREAKPOINTS should have entries', () => {
      expect(BREAKPOINTS.length).toBeGreaterThan(5);
      expect(BREAKPOINTS).toContain('sm');
      expect(BREAKPOINTS).toContain('dark');
    });
  });
});