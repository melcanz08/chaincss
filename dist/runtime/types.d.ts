/**
 * Runtime ChainCSS Type Definitions
 * Only needed if using runtime mode
 */
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
export interface StyleInjector {
    inject(styleId: string, style: RuntimeStyleDefinition): string;
    injectMultiple(styles: Record<string, RuntimeStyleDefinition>, moduleId?: string): Record<string, string>;
    update(styleId: string, style: RuntimeStyleDefinition): string;
    remove(styleId: string): void;
    removeModule(moduleId: string): void;
    clear(): void;
    setTokens(tokens: TokenStore): void;
    getStyleElement(): HTMLStyleElement | null;
    getStats(): {
        injectedStyles: number;
        modules: number;
    };
}
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
export declare function isRuntimeStyleDefinition(obj: any): obj is RuntimeStyleDefinition;
export declare function isStyleInjector(obj: any): obj is StyleInjector;
export declare function isChainCSSManifest(obj: any): obj is ChainCSSManifest;
export declare function isTokenStore(obj: any): obj is TokenStore;
export declare function isHMRPayload(obj: any): obj is HMRPayload;
export {};
