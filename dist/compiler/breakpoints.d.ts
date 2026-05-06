export interface BreakpointConfig {
    name: string;
    minWidth?: number;
    maxWidth?: number;
    query: string;
    priority?: number;
}
export type BreakpointsMap = Record<string, string>;
export type BreakpointValues = Record<string, number>;
export declare const BREAKPOINT_VALUES: Record<string, number>;
export declare let currentBreakpoints: BreakpointsMap;
export declare function setBreakpoints(breakpoints: Partial<BreakpointsMap>): void;
export declare function getBreakpoint(name: string): string | undefined;
export declare function getAllBreakpoints(): BreakpointsMap;
export declare function resetBreakpoints(): void;
export declare function addBreakpoint(name: string, query: string): void;
export declare function removeBreakpoint(name: string): boolean;
export declare function createMediaQuery(min?: number | string, max?: number | string, unit?: 'px' | 'rem' | 'em'): string;
export declare function getBreakpointValue(name: string): number | undefined;
export declare function getBreakpointRange(name: string): {
    min: number;
    max: number;
} | null;
export declare function generateBreakpointCSS(selector: string, styles: Record<string, any>): string;
export declare function getSortedBreakpoints(): Array<{
    name: string;
    query: string;
    minWidth: number;
}>;
export declare function getBreakpointForWidth(width: number): string | null;
export declare function hasBreakpoint(name: string): boolean;
export declare function getBreakpointNames(): string[];
export interface ResponsiveStyle<T = any> {
    base?: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
    '2xl'?: T;
    [key: string]: T | undefined;
}
export declare function generateResponsiveCSS(selector: string, styles: ResponsiveStyle<Record<string, any>>): string;
export declare function responsive<T>(value: T | ResponsiveStyle<T>, defaultBreakpoint?: keyof ResponsiveStyle): ResponsiveStyle<T>;
export declare function mergeResponsiveStyles(...styles: ResponsiveStyle<any>[]): ResponsiveStyle<any>;
export declare function getBreakpointQuery(name: string, unit?: 'px' | 'rem' | 'em'): string | undefined;
export declare function logBreakpoints(): void;
