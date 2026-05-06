export interface StyleDefinition {
    selectors?: string[];
    hover?: Record<string, string | number>;
    [key: string]: any;
}
export interface TokenStore {
    colors?: Record<string, string>;
    spacing?: Record<string, string>;
    typography?: Record<string, any>;
    [key: string]: any;
}
declare class StyleInjector {
    private styleElement;
    private injectedHashes;
    private moduleMap;
    private debugMode;
    private get tokenStore();
    constructor();
    /**
     * Enable debug logging
     */
    enableDebug(enable?: boolean): void;
    /**
     * Set global tokens (e.g., brand colors, spacing scales)
     */
    setTokens(tokens: TokenStore): void;
    /**
     * Get a token value by path
     */
    getToken(path: string): any;
    /**
     * Resolves $variables within a string using the tokenStore
     */
    resolveToken(value: any): any;
    private generateCSS;
    injectMultiple(styles: Record<string, StyleDefinition>, moduleId?: string): Record<string, string>;
    writeToDOM(css: string): void;
    removeModule(moduleId: string): void;
    removeAll(): void;
    getStyleElement(): HTMLStyleElement | null;
    getStats(): {
        injectedStyles: number;
        modules: number;
    };
}
export declare const styleInjector: StyleInjector;
export declare const setTokens: (t: TokenStore) => void;
export declare const compileRuntime: (s: Record<string, StyleDefinition>, moduleId?: string) => Record<string, string>;
export declare const removeRuntimeModule: (moduleId: string) => void;
export declare const clearRuntimeStyles: () => void;
export declare const enableRuntimeDebug: (enabled: boolean) => void;
export declare function runRuntime(...styles: StyleDefinition[]): string;
export {};
