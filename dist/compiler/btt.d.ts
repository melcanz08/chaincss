import { DesignTokens } from './tokens.js';
import type { AtomicOptimizer } from './atomic-optimizer.js';
export { setBreakpoints } from './breakpoints.js';
export { chain, enableDebug } from './Chain.js';
interface StyleSnapshot {
    id: string;
    timestamp: number;
    selector: string;
    styles: Record<string, any>;
    source: string;
    hash: string;
}
interface StyleChange {
    id: string;
    timestamp: number;
    selector: string;
    property: string;
    oldValue: any;
    newValue: any;
    type: 'add' | 'remove' | 'modify';
}
export declare function enableTimeline(enable?: boolean): void;
export declare function getStyleHistory(): StyleSnapshot[];
export declare function getStyleChanges(): StyleChange[];
export declare function getStyleDiff(snapshotId1: string, snapshotId2: string): Record<string, any>;
export declare function exportTimeline(): string;
export declare function clearTimeline(): void;
interface ComponentInfo {
    name: string;
    selector: string;
    styles: Record<string, any>;
    propsDefinition?: Record<string, any>;
    framework: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';
}
export declare function generateComponentCode(info: ComponentInfo): string;
export declare function setSourceComments(enabled: boolean): void;
export interface ChainObject {
    cssOutput: string;
    cachedValidProperties: string[];
    classMap: Record<string, string>;
    atomicStats: any;
    componentMap?: Map<string, any>;
    initializeProperties: () => Promise<void>;
    getCachedProperties: () => string[] | null;
}
export declare const chains: ChainObject;
declare let atomicOptimizer: AtomicOptimizer | null;
export declare function setAtomicOptimizer(optimizer: AtomicOptimizer | null): void;
export declare function configureAtomic(opts: Record<string, any>): void;
export declare const tokens: DesignTokens;
export declare function createTokens(tokenValues: Record<string, any>): DesignTokens;
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
export interface StyleDefinition {
    selectors: string[];
    hover?: Record<string, string | number>;
    atRules?: AtRule[];
    nestedRules?: NestedRule[];
    themes?: ThemeBlock[];
    [cssProperty: string]: any;
}
export declare const run: (...args: any[]) => string;
export declare const compile: (obj: Record<string, StyleDefinition>) => string;
export interface RecipeOptions<TVariants extends Record<string, Record<string, any>>> {
    base?: StyleDefinition | (() => StyleDefinition);
    variants?: TVariants;
    defaultVariants?: Partial<{
        [K in keyof TVariants]: keyof TVariants[K];
    }>;
    compoundVariants?: Array<{
        variants: Partial<{
            [K in keyof TVariants]: keyof TVariants[K];
        }>;
        style: StyleDefinition | (() => StyleDefinition);
    }>;
}
export type Recipe<TVariants extends Record<string, Record<string, any>>> = {
    (selection?: Partial<{
        [K in keyof TVariants]: keyof TVariants[K];
    }>): StyleDefinition;
    variants: TVariants;
    defaultVariants: Partial<{
        [K in keyof TVariants]: keyof TVariants[K];
    }>;
    base: StyleDefinition;
    getAllVariants: () => Array<Partial<{
        [K in keyof TVariants]: keyof TVariants[K];
    }>>;
    compileAll: () => string;
    getVariantClassNames: () => Record<string, string>;
};
export declare function recipe<TVariants extends Record<string, Record<string, any>>>(options: RecipeOptions<TVariants>): Recipe<TVariants>;
/**
 * The "Brain": Extracts ChainCSS calls from raw text
 */
export declare const scanContent: (text: string) => string[];
/**
 * The "Worker": Reads the file, uses the Brain, feeds the Optimizer
 */
export declare function scanFileForStyles(filePath: string, optimizer: any, source?: string | null): {
    foundCount: number;
    errors: Error[];
};
export { atomicOptimizer, chains as chainObject };
