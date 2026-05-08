/**
 * ChainCSS Build-Time Compiler
 * Core compilation, AT-rules, CSS property loading, source maps
 */
import { DesignTokens } from './tokens.js';
import type { AtomicOptimizer } from './atomic-optimizer.js';
import type { StyleDefinition } from '../core/types.js';
export type { StyleDefinition };
export { setBreakpoints } from './breakpoints.js';
export { chain, enableDebug } from './Chain.js';
export { enableTimeline, getStyleHistory, getStyleChanges, getStyleDiff, exportTimeline, clearTimeline, takeSnapshot, isTimelineEnabled } from './timeline.js';
export type { StyleSnapshot, StyleChange } from './timeline.js';
export { scanContent, scanFileForStyles } from './scanner.js';
export { recipe } from './recipe.js';
export type { RecipeOptions, Recipe } from './recipe.js';
export { generateComponentCode, detectFramework } from './component-generator.js';
export type { ComponentInfo } from './component-generator.js';
export declare function setSourceComments(enabled: boolean): void;
export interface ChainObject {
    cssOutput: string;
    cachedValidProperties: string[];
    classMap: Record<string, string>;
    atomicStats: any;
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
export declare const run: (...args: any[]) => string;
export declare const compile: (obj: Record<string, StyleDefinition>) => string;
export { atomicOptimizer, chains as chainObject };
