import { DesignTokens } from './tokens.js';
import type { AtomicOptimizer } from './atomic-optimizer.js';
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
export declare function setSourceComments(enabled: boolean): void;
declare function calc(expression: string): string;
declare function add(a: string | number, b: string | number): string;
declare function subtract(a: string | number, b: string | number): string;
declare function multiply(a: string | number, b: string | number): string;
declare function divide(a: string | number, b: string | number): string;
declare function percent(value: number): string;
declare function vw(value: number): string;
declare function vh(value: number): string;
declare function rem(value: number): string;
declare function em(value: number): string;
declare function px(value: number): string;
declare function min(...values: (string | number)[]): string;
declare function max(...values: (string | number)[]): string;
declare function clamp(min: string | number, preferred: string | number, max: string | number): string;
declare const helpers: {
    calc: typeof calc;
    add: typeof add;
    subtract: typeof subtract;
    sub: typeof subtract;
    multiply: typeof multiply;
    mul: typeof multiply;
    divide: typeof divide;
    div: typeof divide;
    percent: typeof percent;
    vw: typeof vw;
    vh: typeof vh;
    rem: typeof rem;
    em: typeof em;
    px: typeof px;
    min: typeof min;
    max: typeof max;
    clamp: typeof clamp;
};
declare function enableDebug(enable?: boolean): void;
declare function setBreakpoints(breakpoints: Record<string, string>): void;
export interface StyleDefinition {
    selectors: string[];
    hover?: Record<string, string | number>;
    atRules?: AtRule[];
    nestedRules?: NestedRule[];
    themes?: ThemeBlock[];
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
export interface ChainObject {
    cssOutput: string;
    catcher: any;
    cachedValidProperties: string[];
    classMap: Record<string, string>;
    atomicStats: any;
    componentMap?: Map<string, any>;
    initializeProperties: () => Promise<void>;
    getCachedProperties: () => string[] | null;
}
export declare const chain: ChainObject;
declare let atomicOptimizer: AtomicOptimizer | null;
export declare function setAtomicOptimizer(optimizer: AtomicOptimizer | null): void;
export declare function configureAtomic(opts: Record<string, any>): void;
export declare const tokens: DesignTokens;
export declare function createTokens(tokenValues: Record<string, any>): DesignTokens;
export declare const $: any;
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
};
export declare function recipe<TVariants extends Record<string, Record<string, any>>>(options: RecipeOptions<TVariants>): Recipe<TVariants>;
export { atomicOptimizer, chain as chainObject, setBreakpoints, enableDebug, helpers };
//# sourceMappingURL=btt.d.ts.map