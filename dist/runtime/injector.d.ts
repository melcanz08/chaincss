/**
 * ChainCSS Runtime Style Injector
 * This is the core 3.2KB runtime that users opt into
 */
export interface StyleDefinition {
    selectors: string[];
    hover?: Record<string, string | number>;
    [key: string]: any;
}
export interface CompiledStyle {
    className: string;
    css: string;
}
declare class StyleInjector {
    private styleElement;
    private stylesCache;
    private injectedStyles;
    constructor();
    private initStyleElement;
    private generateClassName;
    private generateCSS;
    inject(styleId: string, style: StyleDefinition): string;
    injectMultiple(styles: Record<string, StyleDefinition>): Record<string, string>;
    update(styleId: string, style: StyleDefinition): string;
    remove(styleId: string): void;
    getStyleElement(): HTMLStyleElement | null;
    clear(): void;
}
export declare const styleInjector: StyleInjector;
export declare function chainRuntime(useTokens?: boolean): {};
export declare const $: {};
export declare function compileRuntime(styles: Record<string, StyleDefinition>): Record<string, string>;
export declare function runRuntime(...styles: StyleDefinition[]): string;
/**
 * Add animation presets to runtime
 */
export declare const runtimeAnimations: {
    fadeIn: {
        '0%': {
            opacity: number;
        };
        '100%': {
            opacity: number;
        };
    };
    fadeOut: {
        '0%': {
            opacity: number;
        };
        '100%': {
            opacity: number;
        };
    };
    slideInUp: {
        '0%': {
            transform: string;
            opacity: number;
        };
        '100%': {
            transform: string;
            opacity: number;
        };
    };
    pulse: {
        '0%, 100%': {
            transform: string;
        };
        '50%': {
            transform: string;
        };
    };
    spin: {
        '0%': {
            transform: string;
        };
        '100%': {
            transform: string;
        };
    };
};
/**
 * Add animation to runtime style
 */
export declare function withAnimation(style: Record<string, any>, animationName: keyof typeof runtimeAnimations, duration?: string, timing?: string): Record<string, any>;
export {};
//# sourceMappingURL=injector.d.ts.map