// @ts-nocheck — optional peer dependency
// src/runtime/types.ts

import type { StyleObject } from '@core/usecases/style-compiler.js';

/**
 * Runtime ChainCSS Type Definitions
 * Only needed if using runtime mode
 */

// ============================================================================
// Core Runtime Types
// ============================================================================

export interface UseChainStylesOptions {
  /** Cache compiled styles */
  cache?: boolean;
  /** CSS class namespace prefix */
  namespace?: string;
  /** Watch for changes (development only) */
  watch?: boolean;
  /** Debug mode */
  debug?: boolean;
  /** Server-side rendering mode */
  ssr?: boolean;
}

export interface UseChainStylesReturn {
  classes: Record<string, string>;
  styleVars: Record<string, string>;
  cx: (...names: string[]) => string;
  cn: (...names: string[]) => string;
}

export interface RuntimeCompiledResult {
  [key: string]: string;
}

// ============================================================================
// Style Injector Public Interface
// ============================================================================

export interface StyleInjector {
  inject(className: string, css: string, debug?: boolean): void;
  injectMultiple(styles: Record<string, StyleObject>, moduleId?: string): Record<string, string>;
  remove(className: string): void;
  removeModule(moduleId: string): void;
  removeAll(): void;
  enableDebug(enable?: boolean): void;
  setTokens(tokens: TokenStore): void;
  getToken(path: string): any;
  resolveTokens(value: any): any;
  getStyleElement(): HTMLStyleElement | null;
  getStats(): { injectedStyles: number; modules: number; deduplicatedHashes: number };
}

// ============================================================================
// Token Types
// ============================================================================

export interface TokenStore {
  colors?: Record<string, string>;
  spacing?: Record<string, string>;
  typography?: {
    fontFamily?: Record<string, string>;
    fontSize?: Record<string, string>;
    fontWeight?: Record<string, string>;
    lineHeight?: Record<string, string>;
    letterSpacing?: Record<string, string>;
  };
  breakpoints?: Record<string, string>;
  zIndex?: Record<string, string>;
  shadows?: Record<string, string>;
  borderRadius?: Record<string, string>;
  animations?: Record<string, any>;
  [key: string]: any;
}

// ============================================================================
// Manifest Types
// ============================================================================

export interface ChainCSSManifest {
  atomicMap: Record<string, string>;
  version: string;
  timestamp?: number;
  stats?: {
    totalStyles: number;
    atomicStyles: number;
    uniqueProperties: number;
    savings: string;
  };
}

// ============================================================================
// Framework-Specific Types
// ============================================================================

// React
export interface UseAtomicClassesReturn extends UseChainStylesReturn {
  inject?: (styles: Record<string, any>) => void;
}

export interface UseDynamicChainStylesReturn extends UseAtomicClassesReturn {
  updateStyles: (newStyles: Record<string, any>) => void;
}

// Vue — useChainStyles return type
export interface UseChainStylesReturnVue {
  classes: { value: Record<string, string> };
  styleVars: { value: Record<string, string> };
  cx: (name: string) => string;
  cn: (...names: string[]) => string;
}

// Vue — legacy
export interface UseAtomicClassesReturnVue {
  classes: { value: Record<string, string> };
  cx: (name: string) => string;
  cn: (...names: string[]) => string;
  inject: (styles: Record<string, any>) => void;
}

// Svelte — useChainStyles return type
export interface UseChainStylesReturnSvelte {
  classes: Record<string, string>;
  styleVars: Record<string, string>;
  cx: (name: string) => string;
  cn: (...names: string[]) => string;
  inject?: (styles: Record<string, any>) => void;
}

// Svelte — legacy
export interface UseAtomicClassesReturnSvelte {
  subscribe: (callback: (value: Record<string, string>) => void) => () => void;
  get: () => Record<string, string>;
  cx: (name: string) => string;
  cn: (...names: string[]) => string;
}

// Solid — useChainStyles return type
export interface UseChainStylesReturnSolid {
  classes: () => Record<string, string>;
  styleVars: () => Record<string, string>;
  cx: (...names: string[]) => string;
  cn: (...names: string[]) => string;
  inject?: (styles: Record<string, any>) => void;
}

// Solid — legacy
export interface UseAtomicClassesReturnSolid {
  classes: () => Record<string, string>;
  cx: (...names: string[]) => string;
  inject: (styles: Record<string, any>) => void;
}

// ============================================================================
// HMR Types
// ============================================================================

export interface HMRPayload {
  file: string;
  css?: string;
  map?: Record<string, string>;
  styles?: Record<string, any>;
  timestamp: number;
  moduleId?: string;
}

export interface HMRUpdateEvent {
  type: 'chaincss:update';
  data: HMRPayload;
}

// ============================================================================
// Debug Types
// ============================================================================

export interface ChainCSSDebugger {
  enabled: boolean;
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
}

export interface DebugOptions {
  enabled?: boolean;
  verbose?: boolean;
  prefix?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type CSSValue = string | number | undefined;
export type CSSProperties = Record<string, CSSValue>;

export type ResponsiveValue<T> = T | {
  base?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
  [key: string]: T | undefined;
};

export type TokenValue<T = string> = T | `$${string}`;

export interface RuntimeStyleDefinition {
  className?: string;
  selectors?: string[];
  dynamic?: Record<string, Function>;  // Functions accept context: (ctx) => value
  [key: string]: any;
}

// ============================================================================
// Global Augmentations (debug flags only — no state)
// ============================================================================

declare global {
  interface Window {
    __CHAINCSS_TOKENS__?: TokenStore;
    __CHAINCSS_MANIFEST__?: ChainCSSManifest;
    __CHAINCSS_DEBUG__?: boolean;
    __CHAINCSS_VUE_DEBUG__?: boolean;
    __CHAINCSS_SVELTE_DEBUG__?: boolean;
    __CHAINCSS_SOLID_DEBUG__?: boolean;
    __CHAINCSS_REACT_DEBUG__?: boolean;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isStyleInjector(obj: any): obj is StyleInjector {
  return obj && typeof obj === 'object' && 
    typeof obj.injectMultiple === 'function' &&
    typeof obj.removeModule === 'function';
}

export function isChainCSSManifest(obj: any): obj is ChainCSSManifest {
  return obj && typeof obj === 'object' && 
    'atomicMap' in obj && 
    'version' in obj;
}

export function isTokenStore(obj: any): obj is TokenStore {
  return obj && typeof obj === 'object';
}

export function isHMRPayload(obj: any): obj is HMRPayload {
  return obj && typeof obj === 'object' && 
    'file' in obj && 
    'timestamp' in obj;
}