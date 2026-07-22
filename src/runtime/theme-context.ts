// src/runtime/theme-context.ts
/**
 * ChainCSS Theme Context
 * 
 * Provides SSR-safe theme values for dynamic styles.
 * Functions in chain.dynamic() can optionally accept ThemeContext.
 */

import type { TokenStore } from './injector';

export interface ThemeContext {
  isDark: boolean;
  tokens: TokenStore;
  [key: string]: any;
}

let currentContext: ThemeContext = {
  isDark: false,
  tokens: {},
};

export function setThemeContext(context: Partial<ThemeContext>): void {
  currentContext = { ...currentContext, ...context };
}

export function getThemeContext(): ThemeContext {
  return currentContext;
}

export function resetThemeContext(): void {
  currentContext = { isDark: false, tokens: {} };
}