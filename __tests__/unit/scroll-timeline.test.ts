// ============================================================================
// __tests__/unit/scroll-timeline.test.ts
// Tests for Scroll Timeline Engine (v2.3)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  scrollTimeline,
  compileScrollAnimation,
  compileScrollAnimations,
  createScrollAnimation,
  getScrollPresets,
} from '../../src/compiler/scroll-timeline.js';

describe('Scroll Timeline Engine', () => {
  describe('compileScrollAnimation', () => {
    it('generates view-timeline CSS', () => {
      const result = compileScrollAnimation({
        selector: '.reveal',
        timeline: { name: 'reveal', source: 'view', range: 'entry' },
        keyframes: [
          { offset: '0%', properties: { opacity: '0' } },
          { offset: '100%', properties: { opacity: '1' } },
        ],
      });

      expect(result.css).toContain('view-timeline-name');
      expect(result.css).toContain('@keyframes reveal');
      expect(result.css).toContain('animation-timeline');
    });

    it('generates scroll-timeline CSS', () => {
      const result = compileScrollAnimation({
        selector: '.parallax',
        timeline: { name: 'parallax', source: 'scroll', scroller: 'root' },
        keyframes: [
          { offset: '0%', properties: { transform: 'translateY(0)' } },
          { offset: '100%', properties: { transform: 'translateY(-20%)' } },
        ],
      });

      expect(result.css).toContain('scroll-timeline-name');
      expect(result.css).toContain('@keyframes parallax');
    });

    it('generates @supports fallback', () => {
      const result = compileScrollAnimation({
        selector: '.card',
        timeline: { name: 'card-enter', source: 'view', range: 'entry' },
        keyframes: [
          { offset: '0%', properties: { opacity: '0' } },
          { offset: '100%', properties: { opacity: '1' } },
        ],
      });

      expect(result.css).toContain('@supports not (animation-timeline: scroll())');
    });

    it('converts camelCase properties to kebab-case', () => {
      const result = compileScrollAnimation({
        selector: '.el',
        timeline: { name: 'test', source: 'view', range: 'entry' },
        keyframes: [
          { offset: '0%', properties: { backgroundColor: 'red', borderRadius: '0px' } },
          { offset: '100%', properties: { backgroundColor: 'blue', borderRadius: '10px' } },
        ],
      });

      expect(result.css).toContain('background-color');
      expect(result.css).toContain('border-radius');
    });

    it('includes animation-range for view timelines', () => {
      const result = compileScrollAnimation({
        selector: '.hero',
        timeline: { name: 'hero-in', source: 'view', range: 'contain' },
        keyframes: [
          { offset: '0%', properties: { transform: 'scale(0.8)' } },
          { offset: '100%', properties: { transform: 'scale(1)' } },
        ],
      });

      expect(result.css).toContain('animation-range: contain');
    });

    it('returns animation name and timeline name', () => {
      const result = compileScrollAnimation({
        selector: '.x',
        timeline: { name: 'myAnim', source: 'view' },
        keyframes: [{ offset: '0%', properties: {} }, { offset: '100%', properties: {} }],
      });

      expect(result.animationName).toBe('myAnim');
      expect(result.timelineName).toContain('--myAnim');
    });
  });

  describe('compileScrollAnimations', () => {
    it('compiles multiple animations', () => {
      const css = compileScrollAnimations([
        {
          selector: '.fade',
          timeline: { name: 'fade', source: 'view', range: 'entry' },
          keyframes: [
            { offset: '0%', properties: { opacity: '0' } },
            { offset: '100%', properties: { opacity: '1' } },
          ],
        },
        {
          selector: '.slide',
          timeline: { name: 'slide', source: 'view', range: 'exit' },
          keyframes: [
            { offset: '0%', properties: { transform: 'translateX(0)' } },
            { offset: '100%', properties: { transform: 'translateX(100px)' } },
          ],
        },
      ]);

      expect(css).toContain('@keyframes fade');
      expect(css).toContain('@keyframes slide');
    });
  });

  describe('Presets', () => {
    it('fadeIn preset compiles to valid CSS', () => {
      const anim = createScrollAnimation('fadeIn', '.fade-me');
      const result = compileScrollAnimation(anim);

      expect(result.css).toContain('opacity');
      expect(result.css).toContain('translateY');
      expect(result.css).toContain('view-timeline-name');
    });

    it('slideLeft preset compiles to valid CSS', () => {
      const anim = createScrollAnimation('slideLeft', '.slide-me');
      const result = compileScrollAnimation(anim);

      expect(result.css).toContain('translateX');
      expect(result.css).toContain('opacity');
    });

    it('parallax preset compiles to valid CSS', () => {
      const anim = createScrollAnimation('parallax', '.bg');
      const result = compileScrollAnimation(anim);

      expect(result.css).toContain('scroll-timeline');
      expect(result.css).toContain('translateY');
    });

    it('getScrollPresets returns all presets', () => {
      const presets = getScrollPresets();
      expect(presets).toContain('fadeIn');
      expect(presets).toContain('fadeOut');
      expect(presets).toContain('scaleIn');
      expect(presets).toContain('slideLeft');
      expect(presets).toContain('slideRight');
      expect(presets).toContain('parallax');
      expect(presets).toContain('stickyReveal');
      expect(presets.length).toBeGreaterThanOrEqual(7);
    });

    it('createScrollAnimation throws for unknown preset', () => {
      expect(() => createScrollAnimation('nope' as any, '.x')).toThrow('Unknown scroll preset');
    });

    it('createScrollAnimation accepts overrides', () => {
      const anim = createScrollAnimation('fadeIn', '.custom', {
        timeline: { name: 'custom-fade', source: 'view', range: 'contain' },
      });
      expect(anim.timeline.name).toBe('custom-fade');
      expect(anim.timeline.range).toBe('contain');
      expect(anim.selector).toBe('.custom');
    });
  });

  describe('stickyReveal preset', () => {
    it('uses clipPath for reveal effect', () => {
      const anim = createScrollAnimation('stickyReveal', '.reveal-text');
      const result = compileScrollAnimation(anim);

      expect(result.css).toContain('clip-path');
      expect(result.css).toContain('inset');
    });
  });

  describe('Custom keyframes', () => {
    it('supports custom easing per keyframe', () => {
      const result = compileScrollAnimation({
        selector: '.custom',
        timeline: { name: 'custom', source: 'view' },
        keyframes: [
          { offset: '0%', properties: { opacity: '0' }, easing: 'ease-in' },
          { offset: '100%', properties: { opacity: '1' }, easing: 'ease-out' },
        ],
      });

      expect(result.css).toContain('@keyframes custom');
      expect(result.css).toContain('opacity: 0');
      expect(result.css).toContain('opacity: 1');
    });
  });
});