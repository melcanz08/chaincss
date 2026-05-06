// src/core/types.ts
/**
 * Core ChainCSS Types - Build-Time Only
 * These types are for the compiler and never ship to browser
 */

export interface StyleDefinition {
  selectors: string[];
  hover?: Record<string, string | number>;
  atRules?: AtRule[];
  nestedRules?: NestedRule[];
  themes?: ThemeBlock[];
  _componentName?: string;
  _generateComponent?: boolean;
  _framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';
  _propsDefinition?: Record<string, any>;
  /** Explicit bucket for custom CSS properties to avoid index signature issues */
  customProperties?: Record<string, string | number>;
}

export interface AtRule {
  type: 'media' | 'keyframes' | 'font-face' | 'supports' | 'container' | 'layer' | 'counter-style' | 'property';
  query?: string;
  condition?: string;
  name?: string;
  styles?: any;
  steps?: Record<string, Record<string, string>>;
  properties?: Record<string, string>;
  descriptors?: Record<string, string>;
}

export interface NestedRule {
  selector: string;
  styles: Record<string, string | number>;
}

export interface ThemeBlock {
  name: string;
  styles: StyleDefinition;
  tokens: any;
  fallback: any;
}

export interface AtomicClass {
  className: string;
  prop: string;
  value: string;
  usageCount: number;
  sourceFile?: string;
  hash?: string;
  rules?: string;
}

export interface CompileResult {
  css: string;
  classMap: Record<string, string>;
  atomicClasses: AtomicClass[];
  stats: CompileStats;
  warnings?: string[];
  errors?: string[];
}

export interface CompileStats {
  totalStyles: number;
  atomicStyles: number;
  uniqueProperties: number;
  savings: string;
  cacheHitRate?: number;
  compileTime?: number;
}

export interface AtomicOptimizerOptions {
  enabled: boolean;
  threshold: number;
  naming: 'hash' | 'readable';
  cache: boolean;
  cachePath: string;
  minify: boolean;
  mode: 'standard' | 'atomic' | 'hybrid';
  outputStrategy: 'component-first' | 'utility-first';
  alwaysAtomic: string[];
  neverAtomic: string[];
  verbose: boolean;
}

export interface TokenContext {
  tokens: Record<string, any>;
  prefix: string;
  transform?: (value: any) => any;
}

export interface ChainCSSConfig {
  inputs?: string[];
  output?: {
    cssFile?: string;
    classMapFile?: string;
    typesFile?: string;
    minify?: boolean;
    generateGlobalCSS?: boolean;
    outputDir?: string;
  };
  
  tokens?: {
    enabled?: boolean;
    prefix?: string;
    transform?: (value: any) => any;
    tokens?: Record<string, any>;
  };
  
  atomic?: {
    enabled?: boolean;
    threshold?: number;
    naming?: 'hash' | 'readable';
    cache?: boolean;
    cachePath?: string;
    minify?: boolean;
    mode?: 'standard' | 'atomic' | 'hybrid';
    outputStrategy?: 'component-first' | 'utility-first';
    alwaysAtomic?: string[];
    neverAtomic?: string[];
    verbose?: boolean;
    maxAtomicClasses?: number;
    reuseThreshold?: number;
  };
  
  prefixer?: {
    enabled?: boolean;
    mode?: 'auto' | 'full' | 'lightweight';
    browsers?: string[];
    sourceMap?: boolean;
    sourceMapInline?: boolean;
    remove?: boolean;
  };
  
  cachePath?: string;
  cacheEnabled?: boolean;
  persistentCachePath?: string;
  cacheMaxAgeDays?: number;
  cacheMaxSizeMB?: number;
  
  timeline?: boolean;
  sourceComments?: boolean;
  debug?: boolean;
  sourceMap?: boolean;
  watch?: boolean;
  hmr?: boolean;
  
  breakpoints?: Record<string, string>;
  
  framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'angular' | 'auto';
  esmOnly?: boolean;
  
  namespace?: string;
  verbose?: boolean;
  silent?: boolean;
  profiling?: boolean;
  
  classNameGenerator?: (name: string, options?: any) => string;
  
  plugins?: ChainCSSPlugin[];
  
  minifySelectors?: boolean;
  extractCritical?: boolean;
}

export interface ChainCSSPlugin {
  name: string;
  setup?: (compiler: any) => void;
  transform?: (code: string, id: string) => string | null;
  transformCSS?: (css: string, filePath: string) => string;
  transformAST?: (ast: any) => any;
}

export interface CompileOptions {
  writeFiles?: boolean;
  minify?: boolean;
  sourceMap?: boolean;
  verbose?: boolean;
  watch?: boolean;
}

export interface ScanResult {
  files: string[];
  styles: StyleDefinition[];
  errors: Error[];
  warnings: string[];
}

export interface CacheEntry {
  hash: string;
  timestamp: number;
  result: CompileResult;
  dependencies: string[];
  accessCount: number;
}

export interface TokenValue {
  value: any;
  description?: string;
  deprecated?: boolean;
  aliases?: string[];
}

export interface DesignTokens {
  colors: Record<string, TokenValue | string>;
  spacing: Record<string, TokenValue | string>;
  typography: Record<string, TokenValue | string>;
  breakpoints: Record<string, TokenValue | string>;
  animations: Record<string, TokenValue | any>;
  [key: string]: any;
}

export interface BreakpointConfig {
  name: string;
  minWidth?: number;
  maxWidth?: number;
  query: string;
  priority?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// ============================================================================
// Type Guards
// ============================================================================

export function isStyleDefinition(value: any): value is StyleDefinition {
  return value && typeof value === 'object' && Array.isArray(value.selectors);
}

export function isAtRule(value: any): value is AtRule {
  return value && typeof value === 'object' && value.type && 
    ['media', 'keyframes', 'font-face', 'supports', 'container', 'layer'].includes(value.type);
}

export function isAtomicClass(value: any): value is AtomicClass {
  return value && typeof value === 'object' && 
    typeof value.className === 'string' &&
    typeof value.prop === 'string';
}

export function isCompileResult(value: any): value is CompileResult {
  return value && typeof value === 'object' && 
    typeof value.css === 'string' &&
    typeof value.classMap === 'object' &&
    typeof value.stats === 'object';
}