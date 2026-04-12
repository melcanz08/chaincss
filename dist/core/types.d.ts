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
    [cssProperty: string]: any;
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
}
export interface CompileResult {
    css: string;
    classMap: Record<string, string>;
    atomicClasses: AtomicClass[];
    stats: {
        totalStyles: number;
        atomicStyles: number;
        uniqueProperties: number;
        savings: string;
    };
}
export interface ChainCSSConfig {
    tokens?: {
        enabled?: boolean;
        prefix?: string;
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
    };
    prefixer?: {
        enabled?: boolean;
        mode?: 'auto' | 'full' | 'lightweight';
        browsers?: string[];
        sourceMap?: boolean;
    };
    output?: {
        cssFile?: string;
        classMapFile?: string;
        typesFile?: string;
        minify?: boolean;
        generateGlobalCSS?: boolean;
    };
    timeline?: boolean;
    sourceComments?: boolean;
    debug?: boolean;
    breakpoints?: Record<string, string>;
    namespace?: string;
    verbose?: boolean;
}
//# sourceMappingURL=types.d.ts.map