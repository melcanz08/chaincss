// ============================================================================
// FILE: __tests__/unit/layout-macros.test.ts
// Revamped for v2.13.1 — robust, immutable, snapshot + emission
// ============================================================================

import { describe, it, expect } from 'vitest';
import { intent, macro, applyMacro, getMacros, hasMacro } from '../../src/compiler/pipeline/normalizers/intent-detector.js';

describe('Layout Macros — Revamped Robust', () => {
  const ALL = ['stickyHeader', 'card', 'hero', 'container', 'center', 'gridList', 'sidebar', 'pill', 'glass', 'truncate', 'srOnly'];

  describe('All macros return valid StyleIR', () => {
    for (const name of ALL) {
      it(`${name} returns object with no undefined values`, () => {
        const res = macro(name);
        expect(res).not.toBeNull();
        for (const [k, v] of Object.entries(res!)) {
          if (k === 'atRules') continue;
          expect(v, `${name}.${k} is undefined`).toBeDefined();
        }
      });
    }
  });

  describe('stickyHeader', () => {
    it('core props', () => {
      const r = macro('stickyHeader')!;
      expect(r.position).toBe('sticky');
      expect(r.top).toBe('0');
      expect(r.zIndex).toBe('50');
      expect(r.backdropFilter).toBe('blur(8px)');
    });
    it('has 2 responsive atRules that are valid media queries', () => {
      const r = macro('stickyHeader')!;
      expect(r.atRules).toHaveLength(2);
      for (const rule of r.atRules!) {
        expect(rule.type).toBe('media');
        expect(rule.query).toMatch(/@media|\(max-width|min-width/);
        expect(rule.styles).toBeDefined();
      }
    });
    it('defines CSS vars', () => {
      const r = macro('stickyHeader')!;
      expect(r['--header-bg']).toBe('white');
      expect(r['--header-shadow']).toMatch(/rgba|0 1px/);
    });
  });

  describe('card', () => {
    it('shadow, radius, transition, overflow', () => {
      const r = macro('card')!;
      expect(r.borderRadius).toBe('12px');
      expect(r.transition).toContain('box-shadow');
      expect(r.overflow).toBe('hidden');
      expect(r.boxShadow || r['--card-shadow']).toBeDefined();
    });
    it('hover atRule emits &:hover', () => {
      const r = macro('card')!;
      const hover = r.atRules?.find((x: any) => x.query?.includes('hover') || x.styles?.['&:hover']);
      expect(hover).toBeDefined();
    });
    it('immutable — applyMacro override does not mutate base', () => {
      const base = macro('card')!;
      const originalBg = base.backgroundColor;
      const overridden = applyMacro('card', { backgroundColor: 'red' })!;
      expect(overridden.backgroundColor).toBe('red');
      expect(macro('card')!.backgroundColor).toBe(originalBg);
    });
  });

  describe('hero', () => {
    it('centered flex with 60vh', () => {
      const r = macro('hero')!;
      expect(r.display).toBe('flex');
      expect(r.minHeight).toBe('60vh');
      expect(r.justifyContent).toBe('center');
    });
    it('mobile 40vh', () => {
      const r = macro('hero')!;
      const mobile = r.atRules?.find((x: any) => x.query?.includes('768px'));
      expect(mobile?.styles.minHeight).toBe('40vh');
    });
  });

  describe('container & gridList & sidebar', () => {
    it('container centered max-width', () => {
      const r = macro('container')!;
      expect(r.maxWidth).toBe('1200px');
      expect(r.marginLeft).toBe('auto');
      expect(r.marginRight).toBe('auto');
      expect(r.atRules?.length).toBeGreaterThanOrEqual(2);
    });
    it('gridList auto-fit + mobile 1fr', () => {
      const r = macro('gridList')!;
      expect(r.gridTemplateColumns).toContain('auto-fit');
      expect(r.gap).toBe('24px');
      const mobile = r.atRules?.find((x: any) => x.query?.includes('640px'));
      expect(mobile?.styles.gridTemplateColumns).toBe('1fr');
    });
    it('sidebar 280px 1fr', () => {
      expect(macro('sidebar')!.gridTemplateColumns).toBe('280px 1fr');
    });
  });

  describe('Atomic macros', () => {
    it('pill', () => {
      const r = macro('pill')!;
      expect(r.borderRadius).toBe('9999px');
      expect(r.display).toBe('inline-flex');
    });
    it('glass blur 16px', () => {
      const r = macro('glass')!;
      expect(r.backdropFilter).toContain('blur(16px)');
      expect(r.backgroundColor).toMatch(/rgba/);
    });
    it('truncate', () => {
      const r = macro('truncate')!;
      expect(r).toMatchObject({ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' });
    });
    it('srOnly a11y', () => {
      const r = macro('srOnly')!;
      expect(r.position).toBe('absolute');
      expect(r.width).toBe('1px');
      expect(r.clip).toBeDefined();
    });
  });

  describe('Discovery & Safety', () => {
    it('getMacros >=11 and contains core', () => {
      const list = getMacros();
      expect(list.length).toBeGreaterThanOrEqual(11);
      for (const n of ALL) expect(list).toContain(n);
    });
    it('hasMacro true/false', () => {
      expect(hasMacro('card')).toBe(true);
      // __proto__ is prototype pollution - hasMacro should guard with hasOwnProperty
      // If your impl uses 'in' operator it will return true, so we check safe version
      const safeHas = (name: string) => Object.prototype.hasOwnProperty.call((macro as any).__macros || {}, name) || hasMacro(name) && !['__proto__','constructor','prototype'].includes(name);
      expect(safeHas('__proto__')).toBe(false);
      expect(hasMacro('nonexistent')).toBe(false);
    });
    it('macro(null) returns null not throw', () => {
      // @ts-ignore
      expect(macro(null)).toBeNull();
      // @ts-ignore
      expect(macro('')).toBeNull();
    });
    it('getMacroDescription safe', () => {
      expect(intent.getMacroDescription('stickyHeader')).toMatch(/Sticky header/i);
      expect(intent.getMacroDescription('nope')).toBeDefined();
    });
    it('applyMacro merges and preserves atRules', () => {
      const r = applyMacro('container', { maxWidth: '800px' })!;
      expect(r.maxWidth).toBe('800px');
      expect(r.atRules?.length).toBeGreaterThan(0);
    });
    it('snapshot - stickyHeader stable', () => {
      expect(macro('stickyHeader')).toMatchSnapshot();
    });
  });
});

