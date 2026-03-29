/// <reference types="react" />

declare module 'chaincss' {
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

    // Theme method
    theme<T extends Record<string, any>>(
      tokens: T,
      callback: (chain: ChainBuilder) => void
    ): ChainBuilder;
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

  export function enableChainCSSDebug(): void;
  export function disableChainCSSDebug(): void;
  export function isDebugEnabled(): boolean;
  
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
    debug?: boolean;  
    treeShake?: boolean; 
  }
  
  export function vitePlugin(options?: VitePluginOptions): any;
}

// ============================================================================
// Vite Plugin Subpath Export
// ============================================================================

declare module 'chaincss/vite-plugin' {
  import { Plugin } from 'vite';
  import { VitePluginOptions } from 'chaincss';
  
  export default function chaincssVite(options?: VitePluginOptions): Plugin;
}

// ============================================================================
// React Subpath Export
// ============================================================================

declare module 'chaincss/react' {
  export * from 'chaincss';
  
  // Re-export React-specific hooks
  export const useChainStyles: typeof import('chaincss').useChainStyles;
  export const useDynamicChainStyles: typeof import('chaincss').useDynamicChainStyles;
  export const useThemeChainStyles: typeof import('chaincss').useThemeChainStyles;
  export const ChainCSSGlobal: typeof import('chaincss').ChainCSSGlobal;
  export const withChainStyles: typeof import('chaincss').withChainStyles;
  export const cx: typeof import('chaincss').cx;
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

// ============================================================================
// THEME CONTRACT
// ============================================================================

export interface ThemeContract {
  [key: string]: string | Record<string, any>;
}

export function defineThemeContract<T extends ThemeContract>(
  contract: T
): T & { __isContract: true; __validate: (theme: any) => void };

export function createTheme<T extends Record<string, any>>(
  contract: T,
  values: T
): DesignTokens;

export function createTokens(
  customTokens: Partial<Tokens>,
  contract?: ThemeContract
): DesignTokens;

export function validateTheme(
  contract: ThemeContract,
  theme: any
): boolean;

// ============================================================================
// Vue JS composables
// ============================================================================

declare module 'chaincss/vue' {
  import { Ref, ComputedRef, Component } from 'vue';

  export interface UseAtomicClassesOptions {
    atomic?: boolean;
    global?: boolean;
  }

  export interface UseAtomicClassesReturn {
    classes: Ref<Record<string, any>>;
    cx: (name: string) => any;
    cn: (...names: string[]) => string;
  }

  export function useAtomicClasses(
    styles: Record<string, any> | Ref<Record<string, any>> | ComputedRef<Record<string, any>>,
    options?: UseAtomicClassesOptions
  ): UseAtomicClassesReturn;

  export const ChainCSSGlobal: Component<{
    styles: Record<string, any>;
    atomic?: boolean;
  }>;

  export function createStyledComponent(
    styles: Record<string, any> | ((props: any) => Record<string, any>),
    options?: {
      name?: string;
      atomic?: boolean;
      props?: Record<string, any>;
    }
  ): Component;

  export function createTheme<T extends Record<string, any>>(
    themes: T
  ): {
    currentTheme: Ref<keyof T>;
    themeStyles: ComputedRef<T[keyof T]>;
    setTheme: (themeName: keyof T) => void;
    toggleTheme: () => void;
  };
}