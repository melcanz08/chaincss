import { describe, it, expect } from 'vitest';
import {
  animationPresets, createAnimation, createKeyframesCSS,
  getAnimationPreset, hasAnimationPreset, getAnimationPresetNames,
  registerAnimationPreset, combineAnimations, staggerChildren,
  createAnimationSequence, getAnimationSuggestion, timingFunctions
} from '../../src/compiler/animations.js';

describe('Animation System', () => {
  describe('animationPresets', () => {
    it('should have at least 30 presets', () => {
      expect(Object.keys(animationPresets).length).toBeGreaterThanOrEqual(30);
    });

    it('should include common presets', () => {
      expect(animationPresets).toHaveProperty('fadeIn');
      expect(animationPresets).toHaveProperty('slideInUp');
      expect(animationPresets).toHaveProperty('spin');
      expect(animationPresets).toHaveProperty('bounce');
      expect(animationPresets).toHaveProperty('pulse');
    });

    it('each preset should have keyframes', () => {
      for (const [name, preset] of Object.entries(animationPresets)) {
        expect(Object.keys(preset).length).toBeGreaterThan(0);
      }
    });
  });

  describe('createAnimation', () => {
    it('should create animation styles', () => {
      const styles = createAnimation('fadeIn');
      expect(styles.animation).toContain('fadeIn');
      expect(styles.animationName).toBe('fadeIn');
      expect(styles.animationDuration).toBe('0.3s');
    });

    it('should accept custom config', () => {
      const styles = createAnimation('bounce', {
        duration: '1s',
        delay: '0.5s',
        timing: 'ease-in',
        iteration: 'infinite',
      });
      expect(styles.animationDuration).toBe('1s');
      expect(styles.animationDelay).toBe('0.5s');
      expect(styles.animationIterationCount).toBe('infinite');
    });
  });

  describe('createKeyframesCSS', () => {
    it('should generate keyframes CSS', () => {
      const css = createKeyframesCSS('test', {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      }, false);
      expect(css).toContain('@keyframes test');
      expect(css).toContain('0%');
      expect(css).toContain('opacity: 0');
    });

    it('should add vendor prefix when requested', () => {
      const css = createKeyframesCSS('test', {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      }, true);
      expect(css).toContain('@-webkit-keyframes test');
    });
  });

  describe('getAnimationPreset', () => {
    it('should return preset for valid name', () => {
      expect(getAnimationPreset('fadeIn')).toBeDefined();
    });

    it('should return undefined for invalid name', () => {
      expect(getAnimationPreset('nonexistent')).toBeUndefined();
    });
  });

  describe('hasAnimationPreset', () => {
    it('should return true for existing presets', () => {
      expect(hasAnimationPreset('spin')).toBe(true);
    });

    it('should return false for non-existing', () => {
      expect(hasAnimationPreset('flyAway')).toBe(false);
    });
  });

  describe('getAnimationPresetNames', () => {
    it('should return array of names', () => {
      const names = getAnimationPresetNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain('fadeIn');
    });
  });

  describe('registerAnimationPreset', () => {
    it('should register a new preset', () => {
      const result = registerAnimationPreset('customTest', {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      });
      expect(result).toBe(true);
      expect(hasAnimationPreset('customTest')).toBe(true);
    });
  });

  describe('combineAnimations', () => {
    it('should combine multiple animations', () => {
      const combined = combineAnimations([
        { name: 'fadeIn', duration: '0.5s' },
        { name: 'slideInUp', duration: '0.3s' },
      ]);
      expect(combined.animation).toContain('fadeIn');
      expect(combined.animation).toContain('slideInUp');
    });
  });

  describe('staggerChildren', () => {
    it('should create staggered delays', () => {
      const delays = staggerChildren('0s', '0.1s', 3);
      expect(delays[0]).toBe('0ms');
      expect(delays[1]).toBe('100ms');
      expect(delays[2]).toBe('200ms');
    });
  });

  describe('createAnimationSequence', () => {
    it('should create animation sequence', () => {
      const seq = createAnimationSequence([
        { name: 'fadeIn', duration: '0.3s' },
        { name: 'bounce', duration: '0.5s', delay: '0.3s' },
      ]);
      expect(seq.animation).toContain('fadeIn');
      expect(seq.animation).toContain('bounce');
    });
  });

  describe('getAnimationSuggestion', () => {
    it('should suggest similar animation names', () => {
      const suggestion = getAnimationSuggestion('fade');
      expect(suggestion).toBeTruthy();
    });

    it('should return null for completely different names', () => {
      const suggestion = getAnimationSuggestion('xyzzy123');
      expect(suggestion).toBeNull();
    });
  });

  describe('timingFunctions', () => {
    it('should include standard timing functions', () => {
      expect(timingFunctions).toHaveProperty('ease');
      expect(timingFunctions).toHaveProperty('linear');
      expect(timingFunctions).toHaveProperty('bounce');
    });
  });
});