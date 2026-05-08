// ============================================================================
// FILE: __tests__/unit/layout-macros.test.ts
// Tests for semantic layout macros (v2.3)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { intent, macro, applyMacro, getMacros, hasMacro } from '../../src/compiler/intent-engine.js';

describe('Layout Macros', () => {
  describe('stickyHeader', () => {
    it('generates sticky header properties', () => {
      const result = macro('stickyHeader');
      expect(result).not.toBeNull();
      expect(result!.position).toBe('sticky');
      expect(result!.top).toBe('0');
      expect(result!.zIndex).toBe('50');
      expect(result!.backdropFilter).toBe('blur(8px)');
    });

    it('includes responsive atRules', () => {
      const result = macro('stickyHeader');
      expect(result!.atRules).toBeDefined();
      expect(result!.atRules.length).toBe(2);
      expect(result!.atRules[0].type).toBe('media');
      expect(result!.atRules[0].query).toContain('max-width');
    });

    it('includes CSS custom property defaults', () => {
      const result = macro('stickyHeader');
      expect(result!['--header-bg']).toBe('white');
      expect(result!['--header-shadow']).toBeDefined();
    });
  });

  describe('card', () => {
    it('generates card with shadow and transition', () => {
      const result = macro('card');
      expect(result).not.toBeNull();
      expect(result!.borderRadius).toBe('12px');
      expect(result!.transition).toContain('box-shadow');
      expect(result!.overflow).toBe('hidden');
    });

    it('includes hover atRule', () => {
      const result = macro('card');
      const hoverRule = result!.atRules?.find((r: any) => r.query?.includes('hover'));
      expect(hoverRule).toBeDefined();
      expect(hoverRule.styles['&:hover']).toBeDefined();
    });
  });

  describe('hero', () => {
    it('generates centered hero section', () => {
      const result = macro('hero');
      expect(result!.display).toBe('flex');
      expect(result!.justifyContent).toBe('center');
      expect(result!.alignItems).toBe('center');
      expect(result!.minHeight).toBe('60vh');
    });

    it('has mobile-responsive height', () => {
      const result = macro('hero');
      const mobileRule = result!.atRules?.find((r: any) => r.query?.includes('max-width: 768px'));
      expect(mobileRule).toBeDefined();
      expect(mobileRule.styles.minHeight).toBe('40vh');
    });
  });

  describe('container', () => {
    it('generates centered container with max-width', () => {
      const result = macro('container');
      expect(result!.maxWidth).toBe('1200px');
      expect(result!.marginLeft).toBe('auto');
      expect(result!.marginRight).toBe('auto');
    });

    it('has responsive padding', () => {
      const result = macro('container');
      expect(result!.atRules!.length).toBe(2);
    });
  });

  describe('center', () => {
    it('generates flexbox centering', () => {
      const result = macro('center');
      expect(result!.display).toBe('flex');
      expect(result!.justifyContent).toBe('center');
      expect(result!.alignItems).toBe('center');
    });
  });

  describe('gridList', () => {
    it('generates auto-fit grid', () => {
      const result = macro('gridList');
      expect(result!.display).toBe('grid');
      expect(result!.gridTemplateColumns).toContain('auto-fit');
      expect(result!.gap).toBe('24px');
    });

    it('collapses to single column on mobile', () => {
      const result = macro('gridList');
      const mobileRule = result!.atRules?.find((r: any) => r.query?.includes('max-width: 640px'));
      expect(mobileRule).toBeDefined();
      expect(mobileRule.styles.gridTemplateColumns).toBe('1fr');
    });
  });

  describe('sidebar', () => {
    it('generates sidebar layout', () => {
      const result = macro('sidebar');
      expect(result!.display).toBe('grid');
      expect(result!.gridTemplateColumns).toBe('280px 1fr');
    });
  });

  describe('pill', () => {
    it('generates pill shape', () => {
      const result = macro('pill');
      expect(result!.borderRadius).toBe('9999px');
      expect(result!.display).toBe('inline-flex');
    });
  });

  describe('glass', () => {
    it('generates glass morphism effect', () => {
      const result = macro('glass');
      expect(result!.backdropFilter).toBe('blur(16px)');
      expect(result!.backgroundColor).toContain('rgba');
    });
  });

  describe('truncate', () => {
    it('generates text truncation', () => {
      const result = macro('truncate');
      expect(result!.textOverflow).toBe('ellipsis');
      expect(result!.overflow).toBe('hidden');
      expect(result!.whiteSpace).toBe('nowrap');
    });
  });

  describe('srOnly', () => {
    it('generates screen-reader-only styles', () => {
      const result = macro('srOnly');
      expect(result!.position).toBe('absolute');
      expect(result!.width).toBe('1px');
      expect(result!.height).toBe('1px');
    });
  });

  describe('Macro Discovery', () => {
    it('getMacros returns all available macros', () => {
      const macros = getMacros();
      expect(macros.length).toBeGreaterThanOrEqual(11);
      expect(macros).toContain('stickyHeader');
      expect(macros).toContain('card');
      expect(macros).toContain('hero');
      expect(macros).toContain('container');
      expect(macros).toContain('gridList');
    });

    it('hasMacro returns true for valid macros', () => {
      expect(hasMacro('stickyHeader')).toBe(true);
      expect(hasMacro('card')).toBe(true);
      expect(hasMacro('nonexistent')).toBe(false);
    });

    it('getMacroDescription returns description', () => {
      const desc = intent.getMacroDescription('stickyHeader');
      expect(desc).toContain('Sticky header');
    });

    it('macro returns null for unknown macro', () => {
      expect(macro('nonexistent')).toBeNull();
    });
  });

  describe('applyMacro', () => {
    it('merges macro properties with overrides', () => {
      const result = applyMacro('card', { backgroundColor: 'red' });
      expect(result).not.toBeNull();
      expect(result!.backgroundColor).toBe('red');
      expect(result!.borderRadius).toBe('12px'); // from macro
    });

    it('returns macro as-is without overrides', () => {
      const result = applyMacro('pill');
      expect(result!.borderRadius).toBe('9999px');
    });

    it('returns null for unknown macro', () => {
      expect(applyMacro('nope')).toBeNull();
    });
  });
});