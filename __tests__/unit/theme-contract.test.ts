import { describe, it, expect } from 'vitest';
import { Theme, createThemeContract, createTheme, validateTheme } from '../../src/compiler/theme-contract.js';

describe('Theme Contract', () => {
  describe('Theme class', () => {
    it('should get nested values', () => {
      const theme = new Theme({
        colors: { primary: '#3b82f6', secondary: '#10b981' },
        spacing: { sm: '8px', md: '16px' },
      });

      expect(theme.get('colors.primary')).toBe('#3b82f6');
      expect(theme.get('spacing.md')).toBe('16px');
    });

    it('should return undefined for missing paths', () => {
      const theme = new Theme({ colors: { primary: '#3b82f6' } });
      expect(theme.get('colors.missing')).toBeUndefined();
    });

    it('should set values', () => {
      const theme = new Theme({ colors: {} });
      theme.set('colors.new', '#ff0000');
      expect(theme.get('colors.new')).toBe('#ff0000');
    });

    it('should generate CSS variables', () => {
      const theme = new Theme({
        colors: { primary: '#3b82f6' },
        spacing: { sm: '8px' },
      });

      const css = theme.toCSSVariables('mytheme');
      expect(css).toContain('--mytheme-colors-primary');
      expect(css).toContain('#3b82f6');
      expect(css).toContain('--mytheme-spacing-sm');
      expect(css).toContain('8px');
    });

    it('should export as object', () => {
      const tokens = { colors: { primary: '#3b82f6' } };
      const theme = new Theme(tokens);
      expect(theme.toObject()).toEqual(tokens);
    });
  });

  describe('createThemeContract', () => {
    it('should create a theme contract', () => {
      const contract = createThemeContract({
        colors: { primary: '#3b82f6' },
      });
      expect(contract).toBeDefined();
    });
  });

  describe('validateTheme', () => {
    it('should validate matching themes', () => {
      const contract = { colors: { primary: '' } };
      const theme = { colors: { primary: '#3b82f6' } };
      expect(validateTheme(contract, theme)).toBe(true);
    });

    it('should reject missing keys', () => {
      const contract = { colors: { primary: '', secondary: '' } };
      const theme = { colors: { primary: '#3b82f6' } };
      expect(() => validateTheme(contract, theme)).toThrow();
    });
  });
});