/// <reference types="react" />

declare module '@melcanz85/chaincss' {
  // ============================================================================
  // Core Types
  // ============================================================================
  
  export interface StyleDefinition {
    selectors: string[];
    hover?: Record<string, string | number>;
    [cssProperty: string]: any;
  }
  
  export interface ChainBuilder {
    // CSS Properties - dynamic
    [key: string]: (value: string | number) => ChainBuilder;
    
    // Special Methods
    block(...selectors: string[]): StyleDefinition;
    hover(): ChainBuilder;
    end(): ChainBuilder;
    token?(path: string): ChainBuilder;
    
    // At-Rules
    media(query: string, cb: (chain: ChainBuilder) => void): ChainBuilder;
    keyframes(name: string, cb: (keyframes: KeyframeBuilder) => void): ChainBuilder;
    fontFace(cb: (chain: ChainBuilder) => void): ChainBuilder;
    supports(condition: string, cb: (chain: ChainBuilder) => void): ChainBuilder;
    container(condition: string, cb: (chain: ChainBuilder) => void): ChainBuilder;
    layer(name: string, cb: (chain: ChainBuilder) => void): ChainBuilder;
    counterStyle(name: string, cb: (chain: ChainBuilder) => void): ChainBuilder;
    property(name: string, cb: (chain: ChainBuilder) => void): ChainBuilder;
    
    // Selector shortcut
    $(selector: string): ChainBuilder;
  }
  
  export interface KeyframeBuilder {
    from(styles: Record<string, string>): KeyframeBuilder;
    to(styles: Record<string, string>): KeyframeBuilder;
    [percentage: string]: ((styles: Record<string, string>) => KeyframeBuilder) | any;
  }
  
  // ============================================================================
  // Core Functions
  // ============================================================================
  
  export function $(useTokens?: boolean): ChainBuilder;
  export function run(...styles: StyleDefinition[]): string;
  export function compile(styles: Record<string, StyleDefinition>): void;
  export function get(filename: string): any;
  
  export const chain: {
    cssOutput: string;
    catcher: any;
    cachedValidProperties: string[];
  };
  
  // ============================================================================
  // Token System
  // ============================================================================
  
  export interface Tokens {
    colors: Record<string, string | Record<string, string>>;
    spacing: Record<string, string>;
    typography: {
      fontFamily: Record<string, string>;
      fontSize: Record<string, string>;
      fontWeight: Record<string, string>;
      lineHeight: Record<string, string>;
    };
    breakpoints: Record<string, string>;
    zIndex: Record<string, string>;
    shadows: Record<string, string>;
    borderRadius: Record<string, string>;
  }
  
  export class DesignTokens {
    constructor(tokens: Partial<Tokens>);
    get(path: string, defaultValue?: string): string;
    toCSSVariables(prefix?: string): string;
    createTheme(name: string, overrides: Record<string, any>): DesignTokens;
  }
  
  export const tokens: DesignTokens;
  export function createTokens(customTokens: Partial<Tokens>): DesignTokens;
  export function responsive(values: Record<string, string> | string): string;
  
  // ============================================================================
  // React Integration
  // ============================================================================
  
  export interface UseChainStylesOptions {
    cache?: boolean;
    namespace?: string;
    watch?: boolean;
  }
  
  export function useChainStyles(
    styles: Record<string, any> | (() => Record<string, any>),
    deps?: any[],
    options?: UseChainStylesOptions
  ): Record<string, string>;
  
  export function useDynamicChainStyles(
    styleFactory: () => Record<string, any>,
    deps?: any[],
    options?: UseChainStylesOptions
  ): Record<string, string>;
  
  export function useThemeChainStyles(
    styles: Record<string, any> | ((theme: any) => Record<string, any>),
    theme: any,
    deps?: any[],
    options?: UseChainStylesOptions
  ): Record<string, string>;
  
  export const ChainCSSGlobal: React.FC<{ styles: Record<string, any> }>;
  
  export function withChainStyles<P extends object>(
    styles: Record<string, any> | ((props: P) => Record<string, any>),
    options?: UseChainStylesOptions
  ): (Component: React.ComponentType<P>) => React.FC<P & { chainStyles?: Record<string, string> }>;
  
  export function cx(...classes: (string | undefined | null | false)[]): string;
  
  // ============================================================================
  // Configuration
  // ============================================================================
  
  export interface AtomicConfig {
    enabled?: boolean;
    threshold?: number;
    naming?: 'hash' | 'readable' | 'short';
    cache?: boolean;
    cachePath?: string;
    minify?: boolean;
  }
  
  export interface PrefixerConfig {
    mode?: 'auto' | 'full';
    browsers?: string[];
    enabled?: boolean;
    sourceMap?: boolean;
    sourceMapInline?: boolean;
  }
  
  export interface ChainCSSConfig {
    atomic?: AtomicConfig;
    prefixer?: PrefixerConfig;
    sourceMaps?: boolean;
  }
  
  export function configure(config: ChainCSSConfig): void;
  
  export const atomicOptimizer: {
    optimize(styles: Record<string, StyleDefinition>): string;
    getStats(): {
      totalStyles: number;
      atomicStyles: number;
      uniqueProperties: number;
      savings?: string;
    };
  };
  
  // ============================================================================
  // Build Tools (Node.js)
  // ============================================================================
  
  export function processor(inputFile: string, outputFile: string): Promise<void>;
  export function watch(inputFile: string, outputFile: string): void;
  
  // ============================================================================
  // Vite Plugin
  // ============================================================================
  
  export interface VitePluginOptions {
    extension?: string;
    minify?: boolean;
    prefix?: boolean;
    hmr?: boolean;
  }
  
  export function vitePlugin(options?: VitePluginOptions): any;
}

// ============================================================================
// Vite Plugin Subpath Export
// ============================================================================

declare module '@melcanz85/chaincss/vite-plugin' {
  import { Plugin } from 'vite';
  import { VitePluginOptions } from '@melcanz85/chaincss';
  
  export default function chaincssVite(options?: VitePluginOptions): Plugin;
}

// ============================================================================
// React Subpath Export
// ============================================================================

declare module '@melcanz85/chaincss/react' {
  export * from '@melcanz85/chaincss';
  
  // Re-export React-specific hooks
  export const useChainStyles: typeof import('@melcanz85/chaincss').useChainStyles;
  export const useDynamicChainStyles: typeof import('@melcanz85/chaincss').useDynamicChainStyles;
  export const useThemeChainStyles: typeof import('@melcanz85/chaincss').useThemeChainStyles;
  export const ChainCSSGlobal: typeof import('@melcanz85/chaincss').ChainCSSGlobal;
  export const withChainStyles: typeof import('@melcanz85/chaincss').withChainStyles;
  export const cx: typeof import('@melcanz85/chaincss').cx;
}

// ============================================================================
// Recipe - Variants
// ============================================================================

export interface RecipeOptions<TVariants extends Record<string, Record<string, any>>> {
  base?: StyleDefinition;
  variants?: TVariants;
  defaultVariants?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
  compoundVariants?: Array<{
    variants: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
    style: StyleDefinition;
  }>;
}

export type Recipe<TVariants extends Record<string, Record<string, any>>> = {
  (selection?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>): StyleDefinition;
  variants: TVariants;
  defaultVariants: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
  base: StyleDefinition;
  getAllVariants: () => Array<Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>>;
  compileAll: () => string;
};

export function recipe<TVariants extends Record<string, Record<string, any>>>(
  options: RecipeOptions<TVariants>
): Recipe<TVariants>;