// ============================================================================
// __tests__/unit/semantic-tokens.test.ts
// Tests for Semantic Token System (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  semanticTokens,
  resolveSemantic,
  getSemanticIntents,
  getSemanticDescription,
  semanticTokensPass,
} from '../../src/compiler/semantic-tokens.js';
import { createIR, createRule, createDeclaration, resetIdCounter } from '../../src/compiler/style-ir.js';

describe('Semantic Tokens', () => {
  beforeEach(() => resetIdCounter());

  describe('resolveSemantic', () => {
    it('resolves surface interactive to concrete properties', () => {
      const result = resolveSemantic('surface', 'interactive');
      expect(result).not.toBeNull();
      expect(result!.properties.backgroundColor).toBeDefined();
      expect(result!.properties.color).toBeDefined();
      expect(result!.properties.cursor).toBe('pointer');
      expect(result!.description).toContain('Clickable');
    });

    it('resolves text primary', () => {
      const result = resolveSemantic('text', 'primary');
      expect(result!.properties.color).toBeDefined();
      expect(result!.properties.fontWeight).toBeDefined();
    });

    it('resolves text muted (smaller, lighter)', () => {
      const result = resolveSemantic('text', 'muted');
      expect(result!.properties.fontSize).toBe('14px');
    });

    it('resolves elevation floating', () => {
      const result = resolveSemantic('elevation', 'floating');
      expect(result!.properties.boxShadow).toBeDefined();
      expect(result!.properties.zIndex).toBe('20');
    });

    it('resolves elevation modal (highest)', () => {
      const result = resolveSemantic('elevation', 'modal');
      expect(result!.properties.zIndex).toBe('100');
      expect(result!.properties.position).toBe('fixed');
    });

    it('resolves state hover with pseudo-class', () => {
      const result = resolveSemantic('state', 'hover');
      expect(result!.pseudoClass).toBe('hover');
      expect(result!.properties.filter).toContain('brightness');
    });

    it('resolves state disabled', () => {
      const result = resolveSemantic('state', 'disabled');
      expect(result!.properties.opacity).toBe('0.5');
      expect(result!.properties.cursor).toBe('not-allowed');
    });

    it('resolves spacing comfortable', () => {
      const result = resolveSemantic('spacing', 'comfortable');
      expect(result!.properties.padding).toBeDefined();
      expect(result!.properties.gap).toBeDefined();
    });

    it('applies dark theme overrides', () => {
      const light = resolveSemantic('surface', 'interactive');
      const dark = resolveSemantic('surface', 'interactive', { mode: 'dark' });
      // Dark theme should use a lighter primary
      expect(dark!.properties.backgroundColor).not.toBe(light!.properties.backgroundColor);
    });

    it('applies high contrast overrides', () => {
      const hc = resolveSemantic('surface', 'interactive', { mode: 'high-contrast' });
      expect(hc!.properties.border).toBeDefined();
      expect(hc!.properties.border).toContain('2px solid');
    });

    it('returns null for unknown category', () => {
      expect(resolveSemantic('nonexistent' as any, 'test')).toBeNull();
    });

    it('returns null for unknown intent', () => {
      expect(resolveSemantic('surface', 'nonexistent')).toBeNull();
    });

    it('handles container context (dark section)', () => {
      const result = resolveSemantic('surface', 'interactive', {
        mode: 'light',
        containerContext: 'dark',
      });
      expect(result!.properties.backgroundColor).toBeDefined();
    });
  });

  describe('getSemanticIntents', () => {
    it('lists all surface intents', () => {
      const intents = getSemanticIntents('surface');
      expect(intents).toContain('interactive');
      expect(intents).toContain('container');
      expect(intents).toContain('overlay');
      expect(intents.length).toBe(6);
    });

    it('lists all text intents', () => {
      const intents = getSemanticIntents('text');
      expect(intents).toContain('primary');
      expect(intents).toContain('muted');
      expect(intents).toContain('code');
      expect(intents.length).toBe(6);
    });

    it('lists all elevation intents', () => {
      const intents = getSemanticIntents('elevation');
      expect(intents).toContain('flat');
      expect(intents).toContain('modal');
      expect(intents.length).toBe(6);
    });

    it('lists all state intents', () => {
      const intents = getSemanticIntents('state');
      expect(intents).toContain('hover');
      expect(intents).toContain('disabled');
      expect(intents).toContain('focus');
      expect(intents.length).toBe(6);
    });

    it('lists all spacing intents', () => {
      const intents = getSemanticIntents('spacing');
      expect(intents).toContain('tight');
      expect(intents).toContain('comfortable');
      expect(intents).toContain('generous');
      expect(intents.length).toBe(6);
    });
  });

  describe('getSemanticDescription', () => {
    it('returns description for known intent', () => {
      const desc = getSemanticDescription('surface', 'interactive');
      expect(desc).toContain('Clickable');
    });

    it('returns null for unknown', () => {
      expect(getSemanticDescription('surface', 'nope')).toBeNull();
    });
  });

  describe('semanticTokensPass', () => {
    it('resolves semantic metadata to declarations', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.meta._semantic = [
        { category: 'surface', intent: 'interactive' },
        { category: 'spacing', intent: 'compact' },
      ];
      ir.rules.push(rule);

      const result = semanticTokensPass(ir);
      expect(result.rules[0].declarations.length).toBeGreaterThan(0);
      expect(result.rules[0].declarations.some(d => d.property === 'backgroundColor')).toBe(true);
      expect(result.rules[0].declarations.some(d => d.property === 'cursor')).toBe(true);
    });

    it('adds pseudo-class declarations for states', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.meta._semantic = [
        { category: 'state', intent: 'hover' },
      ];
      ir.rules.push(rule);

      const result = semanticTokensPass(ir);
      expect(result.rules[0].pseudoClasses.length).toBe(1);
      expect(result.rules[0].pseudoClasses[0].name).toBe('hover');
      expect(result.rules[0].pseudoClasses[0].declarations.length).toBeGreaterThan(0);
    });

    it('records transform history', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.meta._semantic = [{ category: 'text', intent: 'primary' }];
      ir.rules.push(rule);

      const result = semanticTokensPass(ir);
      const decl = result.rules[0].declarations[0];
      expect(decl.history.some(h => h.pass === 'semantic-tokens')).toBe(true);
      expect(decl.meta.semantic).toBeDefined();
    });

    it('handles empty semantic metadata gracefully', () => {
      const ir = createIR();
      const rule = createRule('.test');
      ir.rules.push(rule);

      const result = semanticTokensPass(ir);
      expect(result.rules[0].declarations).toEqual([]);
    });
  });

  describe('Theme consistency', () => {
    it('dark theme overrides exist for all surface intents', () => {
      const intents = getSemanticIntents('surface');
      for (const intent of intents) {
        const dark = resolveSemantic('surface', intent, { mode: 'dark' });
        expect(dark).not.toBeNull();
      }
    });

    it('all spacing intents resolve with light and dark', () => {
      const intents = getSemanticIntents('spacing');
      for (const intent of intents) {
        expect(resolveSemantic('spacing', intent, { mode: 'light' })).not.toBeNull();
        expect(resolveSemantic('spacing', intent, { mode: 'dark' })).not.toBeNull();
      }
    });
  });
});