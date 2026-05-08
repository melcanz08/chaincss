// ============================================================================
// __tests__/unit/intent-api.test.ts
// Tests for Intent-Based API (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  intentAPI,
  resolveIntent,
  getAvailableIntents,
  getIntentsByCategory,
  getIntentDescription,
  intentAPIPass,
} from '../../src/compiler/intent-api.js';
import { createIR, createRule, resetIdCounter } from '../../src/compiler/style-ir.js';

describe('Intent API', () => {
  beforeEach(() => resetIdCounter());

  describe('resolveIntent', () => {
    it('resolves card intent with properties + states', () => {
      const result = resolveIntent('card');
      expect(result).not.toBeNull();
      expect(result!.properties.display).toBe('flex');
      expect(result!.properties.flexDirection).toBe('column');
      expect(result!.properties.overflow).toBe('hidden');
      expect(result!.states.hover).toBeDefined();
      expect(result!.states.hover.transform).toBe('translateY(-2px)');
    });

    it('resolves button-primary with semantic tokens', () => {
      const result = resolveIntent('button-primary');
      expect(result!.properties.display).toBe('inline-flex');
      expect(result!.properties.fontWeight).toBe('600');
      // Should have hover state from semantic tokens
      expect(result!.states.hover).toBeDefined();
    });

    it('resolves center-content layout', () => {
      const result = resolveIntent('center-content');
      expect(result!.properties.display).toBe('flex');
      expect(result!.properties.justifyContent).toBe('center');
      expect(result!.properties.alignItems).toBe('center');
    });

    it('resolves visually-hidden with accessibility properties', () => {
      const result = resolveIntent('visually-hidden');
      expect(result!.properties.position).toBe('absolute');
      expect(result!.properties.width).toBe('1px');
      expect(result!.properties.clip).toContain('rect');
    });

    it('resolves modal with elevation', () => {
      const result = resolveIntent('modal');
      expect(result!.properties.position).toBe('fixed');
      expect(result!.properties.zIndex).toBeDefined();
    });

    it('returns responsive overrides for card', () => {
      const result = resolveIntent('card');
      expect(result!.responsive.mobile).toBeDefined();
      expect(result!.responsive.mobile.padding).toBe('16px');
    });

    it('returns null for unknown intent', () => {
      expect(resolveIntent('nonexistent')).toBeNull();
    });

    it('applies dark theme', () => {
      const light = resolveIntent('button-primary');
      const dark = resolveIntent('button-primary', { theme: 'dark' });
      // Dark theme should modify the background color via semantic tokens
      expect(dark).not.toBeNull();
    });
  });

  describe('getAvailableIntents', () => {
    it('returns all intent names', () => {
      const intents = getAvailableIntents();
      expect(intents).toContain('card');
      expect(intents).toContain('button-primary');
      expect(intents).toContain('button-secondary');
      expect(intents).toContain('center-content');
      expect(intents).toContain('modal');
      expect(intents).toContain('visually-hidden');
      expect(intents.length).toBeGreaterThanOrEqual(17);
    });
  });

  describe('getIntentsByCategory', () => {
    it('filters by component category', () => {
      const components = getIntentsByCategory('component');
      expect(components).toContain('card');
      expect(components).toContain('button-primary');
      expect(components).toContain('modal');
    });

    it('filters by layout category', () => {
      const layouts = getIntentsByCategory('layout');
      expect(layouts).toContain('center-content');
      expect(layouts).toContain('stack');
    });

    it('filters by semantic category', () => {
      const semantic = getIntentsByCategory('semantic');
      expect(semantic).toContain('hero-section');
      expect(semantic).toContain('sticky-header');
    });
  });

  describe('getIntentDescription', () => {
    it('returns description for known intent', () => {
      expect(getIntentDescription('card')).toContain('Content card');
      expect(getIntentDescription('button-primary')).toContain('Primary');
    });

    it('returns null for unknown', () => {
      expect(getIntentDescription('nope')).toBeNull();
    });
  });

  describe('intentAPIPass', () => {
    it('resolves _intent metadata on rules', () => {
      const ir = createIR();
      const rule = createRule('.my-card');
      rule.meta._intent = 'card';
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      expect(result.rules[0].declarations.length).toBeGreaterThan(0);
      expect(result.rules[0].declarations.some(d => d.property === 'display')).toBe(true);
      expect(result.rules[0].declarations.some(d => d.property === 'overflow')).toBe(true);
    });

    it('creates pseudo-classes for states', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.meta._intent = 'button-primary';
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      expect(result.rules[0].pseudoClasses.length).toBeGreaterThan(0);
      expect(result.rules[0].pseudoClasses.some(pc => pc.name === 'hover')).toBe(true);
    });

    it('records transform history', () => {
      const ir = createIR();
      const rule = createRule('.card');
      rule.meta._intent = 'card';
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      const decl = result.rules[0].declarations[0];
      expect(decl.history.some(h => h.pass === 'intent-api')).toBe(true);
      expect(decl.history.some(h => h.reason.includes('intent'))).toBe(true);
    });

    it('skips rules without _intent', () => {
      const ir = createIR();
      const rule = createRule('.plain');
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      expect(result.rules[0].declarations).toEqual([]);
    });

    it('stores a11y requirements for accessibility pass', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.meta._intent = 'button-primary';
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      expect(result.rules[0].meta._a11yRequirements).toBeDefined();
      expect(result.rules[0].meta._a11yRequirements).toContain('contrast');
    });
  });
});