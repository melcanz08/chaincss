/// <reference types="react" />

declare module '@melcanz85/chaincss' {
  // Style definition returned by .block()
  export interface StyleDefinition {
    selectors: string[];
    [cssProperty: string]: any;
  }
  export const createTokens: any;
  export const responsive: any;
  // Base interface for CSS properties (dynamic)
  export interface CSSPropertyBuilder {
    [key: string]: (value: string | number) => ChainBuilder;
  }
  // Special methods interface
  export interface SpecialMethods {
    block(...selectors: string[]): StyleDefinition;
    token?(path: string): ChainBuilder;
  }
  // ChainBuilder is the intersection of both
  export type ChainBuilder = CSSPropertyBuilder & SpecialMethods;
  // The main $ function
  export function $(): ChainBuilder;
  // Run function for inline styles
  export function run(...styles: StyleDefinition[]): string;
  // Compile function for objects
  export function compile(styles: Record<string, StyleDefinition>): void;
  // Get function for importing (VM-safe version)
  export function get(filename: string): any;
  // Chain object (internal state)
  export const chain: {
    cssOutput: string;
    catcher: any;
    cachedValidProperties: string[];
  };
  // Processor function
  export function processor(inputFile: string, outputFile: string): Promise<void>;
  // Watch function
  export function watch(inputFile: string, outputFile: string): void;
  // Atomic optimizer configuration
  export interface AtomicConfig {
    enabled?: boolean;
    threshold?: number;
    naming?: 'hash' | 'readable' | 'short';
    cache?: boolean;
    cachePath?: string;
    minify?: boolean;
  }
  // Prefixer configuration
  export interface PrefixerConfig {
    mode?: 'auto' | 'full';
    browsers?: string[];
    enabled?: boolean;
    sourceMap?: boolean;
    sourceMapInline?: boolean;
  }
  // ChainCSS configuration
  export interface ChainCSSConfig {
    atomic?: AtomicConfig;
    prefixer?: PrefixerConfig;
    sourceMaps?: boolean;
  }
  // Function to configure ChainCSS
  export function configure(config: ChainCSSConfig): void;
  // Atomic optimizer instance
  export const atomicOptimizer: {
    optimize(styles: Record<string, StyleDefinition>): string;
    getStats(): {
      totalStyles: number;
      atomicStyles: number;
      uniqueProperties: number;
      savings?: string;
    };
  };
  // Token system types
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
  // React hooks types (add to your existing declare module)
  export interface UseChainStylesOptions {
    cache?: boolean;
    namespace?: string;
    watch?: boolean;
  }
  export function useChainStyles(
    styles: Record<string, any> | (() => Record<string, any>),
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
    options?: UseChainStylesOptions
  ): Record<string, string>;
  export const ChainCSSGlobal: React.FC<{ styles: Record<string, any> }>;
  export function withChainStyles(
    styles: Record<string, any> | ((props: any) => Record<string, any>),
    options?: UseChainStylesOptions
  ): <P extends object>(Component: React.ComponentType<P>) => React.FC<P & { chainStyles?: Record<string, string> }>;
  export function cx(...classes: (string | undefined | null | false)[]): string;
}