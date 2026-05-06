import * as CSS from 'csstype';
import { shorthandMap } from './shorthands.js';
import { AnimationConfig } from './animations.js';
/**
 * Helper to extract the correct CSS value type for a shorthand
 */
type GetCSSValue<T extends string> = T extends keyof CSS.Properties ? CSS.Properties[T] : any;
/**
 * Automatically generate methods for standard 1-to-1 shorthands
 */
type ShorthandMethods = {
    [K in keyof typeof shorthandMap]: (value: GetCSSValue<typeof shorthandMap[K]>) => Chain;
};
/**
 * Special handler methods
 */
interface SpecialMethods {
    mx(value: string | number): Chain;
    my(value: string | number): Chain;
    px(value: string | number): Chain;
    py(value: string | number): Chain;
    size(value: string | number): Chain;
    inset(value: string | number | {
        top?: any;
        right?: any;
        bottom?: any;
        left?: any;
    }): Chain;
    insetX(value: string | number): Chain;
    insetY(value: string | number): Chain;
    gap(value: string | number): Chain;
    gapX(value: string | number): Chain;
    gapY(value: string | number): Chain;
    borderX(value: string): Chain;
    borderY(value: string): Chain;
    border(value: string | number): Chain;
    flex(value?: string | boolean): Chain;
    inlineFlex(value?: any): Chain;
    grid(value?: string | boolean): Chain;
    inlineGrid(value?: any): Chain;
    cols(value: number | string): Chain;
    rows(value: number | string): Chain;
    center(type?: 'flex' | 'inline'): Chain;
    flexCenter(dir?: 'row' | 'col' | 'column'): Chain;
    gridCenter(): Chain;
    stack(config: string | number | 'row' | {
        spacing: any;
        dir?: 'row' | 'col';
    }): Chain;
    gridTable(minWidth: string | number): Chain;
    aspect(ratio: 'square' | 'video' | 'golden' | string): Chain;
    hide(): Chain;
    show(): Chain;
    unselectable(): Chain;
    scrollable(axis?: 'x' | 'y' | 'both'): Chain;
    safeArea(edge?: 'top' | 'bottom' | 'left' | 'right' | 'all' | string[]): Chain;
    absolute(coords?: {
        top?: any;
        right?: any;
        bottom?: any;
        left?: any;
    }): Chain;
    fixed(coords?: {
        top?: any;
        right?: any;
        bottom?: any;
        left?: any;
    }): Chain;
    sticky(coords?: {
        top?: any;
        right?: any;
        bottom?: any;
        left?: any;
    }): Chain;
    relative(coords?: {
        top?: any;
        right?: any;
        bottom?: any;
        left?: any;
    }): Chain;
    circle(size: string | number): Chain;
    square(size: string | number): Chain;
    truncate(): Chain;
    fluidText(config: {
        min: number | string;
        max: number | string;
        vw?: string;
    }): Chain;
    glass(blur?: string | number): Chain;
    glow(config: string | {
        color: string;
        size?: number;
    }): Chain;
    textGradient(colors: string[] | {
        colors: string[];
        angle?: number;
    }): Chain;
    meshGradient(colors: string[]): Chain;
    noise(opacity?: number): Chain;
    skeleton(active: boolean | {
        active: boolean;
        color?: string;
        highlight?: string;
    }): Chain;
    clickScale(amount?: number): Chain;
    onInteracting(callback: (css: Chain) => void): Chain;
    children(callback: (css: Chain) => void): Chain;
    dark(callback: (css: Chain) => void): Chain;
    light(callback: (css: Chain) => void): Chain;
    scale(value: number): Chain;
    rotate(value: string | number): Chain;
    x(value: string | number): Chain;
    y(value: string | number): Chain;
    skew(value: string | number): Chain;
    pill(): Chain;
    containerMacro(maxWidth?: string | number): Chain;
    fullScreen(zIndex?: number): Chain;
    shimmer(): Chain;
    bento(cols?: number): Chain;
    pressable(): Chain;
    focusRing(color?: string): Chain;
    outlineDebug(): Chain;
    parallax(scale?: number): Chain;
    lineClamp(lines?: number): Chain;
    frostedNav(blur?: number | string): Chain;
}
interface ChainBase {
    $el(...selectors: string[]): any;
    end(): Chain;
    hover(): Chain;
    nest(selector: string, callback: (css: Chain) => void): Chain;
    use(mixin: Record<string, any>): Chain;
    when(condition: boolean, callback: (css: Chain) => void): Chain;
    responsive(breakpoint: string, callback: (css: Chain) => void): Chain;
    media(query: string, callback: (css: Chain) => void): Chain;
    supports(condition: string, callback: (css: Chain) => void): Chain;
    containerQuery(condition: string, callback: (css: Chain) => void): Chain;
    layer(name: string, callback: (css: Chain) => void): Chain;
    keyframes(name: string, steps: Record<string, any>): Chain;
    fontFace(properties: Record<string, string>): Chain;
    componentName(name: string): Chain;
    component(framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'auto'): Chain;
    props(propsDefinition?: Record<string, any>): Chain;
    animation(name: string, config?: AnimationConfig): Chain;
    animate(name: string, keyframes: Record<string, any>, config?: AnimationConfig): Chain;
    duration(v: string): Chain;
    delay(v: string): Chain;
    timing(v: string): Chain;
    iteration(v: string | number): Chain;
    infinite(): Chain;
    calc(expr: string): any;
    add(...args: any[]): any;
    subtract(...args: any[]): any;
    sub(...args: any[]): any;
    multiply(...args: any[]): any;
    mul(...args: any[]): any;
    divide(...args: any[]): any;
    div(...args: any[]): any;
    mpx(v: number | string): string;
    rem(v: number | string): string;
    em(v: number | string): string;
    percent(v: number | string): string;
    vw(v: number | string): string;
    vh(v: number | string): string;
    min(...args: any[]): any;
    max(...args: any[]): any;
    clamp(min: any, val: any, max: any): any;
    debug(): Chain;
    explain(shorthand: string): Chain;
}
type CSSMethods = {
    [K in keyof CSS.Properties]-?: (value: CSS.Properties[K]) => Chain;
};
export type Chain = SpecialMethods & ChainBase & CSSMethods & ShorthandMethods;
export declare function setTokenContext(context: any): void;
export declare function getTokenContext(): any;
export declare function enableDebug(enable?: boolean): void;
export declare class ChainClass {
    private catcher;
    private useTokens;
    private hoverCatcher;
    private valueCache;
    private readonly MAX_CACHE_SIZE;
    __proxy: any;
    constructor(useTokens?: boolean);
    private resolveValue;
    private setTransform;
    private setProperty;
    get(prop: string | symbol): any;
    private finalize;
    private macroHandler;
    private createHover;
    private endHover;
    private useMixin;
    private whenCondition;
    private nestSelector;
    private setComponentName;
    private setComponent;
    private setProps;
    private enableDebugMode;
    private explainShorthand;
    private applyAnimation;
    private createAnimation;
    private applyResponsive;
    private applyMedia;
    private defineKeyframes;
    private defineFontFace;
    private applySupports;
    private applyContainerQuery;
    private applyLayer;
    private clear;
}
export declare function createChain(useTokens?: boolean): Chain;
export declare const chain: (useTokens?: boolean) => Chain;
export {};
