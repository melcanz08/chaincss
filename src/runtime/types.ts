// @ts-nocheck — optional peer dependency
// src/runtime/types.ts

/**
 * Runtime ChainCSS Type Definitions
 * Only needed if using runtime mode
 */

// ============================================================================
// Core Runtime Types
// ============================================================================

export interface RuntimeStyleDefinition {
  selectors?: string[];
  hover?: Record<string, string | number>;
  _classes?: string[];
  _name?: string;
  [cssProperty: string]: any;
}

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

export interface RuntimeCompiledResult {
  [key: string]: string;
}

// ============================================================================
// Style Injector Types
// ============================================================================

export interface StyleInjector {
  inject(styleId: string, style: RuntimeStyleDefinition): string;
  injectMultiple(styles: Record<string, RuntimeStyleDefinition>, moduleId?: string): Record<string, string>;
  update(styleId: string, style: RuntimeStyleDefinition): string;
  remove(styleId: string): void;
  removeModule(moduleId: string): void;
  clear(): void;
  setTokens(tokens: TokenStore): void;
  getStyleElement(): HTMLStyleElement | null;
  getStats(): { injectedStyles: number; modules: number };
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
// Framework-Specific Types (optional imports)
// ============================================================================

// React-specific types
export interface UseAtomicClassesReturn {
  classes: Record<string, string>;
  cx: (name: string) => string;
  cn: (...names: string[]) => string;
  inject?: (styles: Record<string, any>) => void;
}

export interface UseDynamicChainStylesReturn extends UseAtomicClassesReturn {
  updateStyles: (newStyles: Record<string, any>) => void;
}

export interface UseThemeChainStylesReturn extends UseAtomicClassesReturn {
  theme: any;
  setTheme: (theme: any) => void;
}

// Vue-specific types
export interface UseAtomicClassesReturnVue {
  classes: import('vue').Ref<Record<string, string>>;
  cx: (name: string) => string;
  cn: (...names: string[]) => string;
  inject: (styles: Record<string, any>) => void;
}

export interface UseComputedStylesReturnVue {
  classes: import('vue').Ref<Record<string, string>>;
  rootClass: import('vue').ComputedRef<string>;
}

// Svelte-specific types
export interface UseAtomicClassesReturnSvelte {
  subscribe: (callback: (value: Record<string, string>) => void) => () => void;
  get: () => Record<string, string>;
  cx: (name: string) => string;
  cn: (...names: string[]) => string;
}

export interface UseComputedStylesReturnSvelte {
  classes: UseAtomicClassesReturnSvelte;
  rootClass: import('svelte/store').Readable<string>;
}

// Solid-specific types (using type alias to avoid direct import error)
// These will work if solid-js is installed, otherwise they default to any
type SolidAccessor<T> = T extends any ? (() => T) : never;

export interface UseAtomicClassesReturnSolid {
  classes: SolidAccessor<Record<string, string>>;
  cx: (...names: string[]) => string;
  inject: (styles: Record<string, any>) => void;
}

export interface UseComputedStylesReturnSolid {
  classes: SolidAccessor<Record<string, string>>;
  rootClass: SolidAccessor<string>;
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

// ============================================================================
// Global Augmentations
// ============================================================================

declare global {
  interface Window {
    __CHAINCSS_V2_TOKENS__?: TokenStore;
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

export function isRuntimeStyleDefinition(obj: any): obj is RuntimeStyleDefinition {
  return obj && typeof obj === 'object' && (obj.selectors === undefined || Array.isArray(obj.selectors));
}

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