export type ValueType = 'static' | 'dynamic' | 'runtime-only';
export type Mode = 'build' | 'runtime' | 'hybrid' | 'auto';
export interface DetectedPart {
    type: ValueType;
    prop: string;
    value: any;
    originalValue: any;
    index: number;
}
export interface AnalysisResult {
    staticParts: DetectedPart[];
    dynamicParts: DetectedPart[];
    runtimeOnlyParts: DetectedPart[];
    isHybrid: boolean;
    mode: Mode;
}
export declare class AutoDetector {
    private static instance;
    private dynamicPatterns;
    private staticPatterns;
    private debug;
    static getInstance(): AutoDetector;
    enableDebug(enabled: boolean): void;
    detectValueType(value: any, prop?: string): ValueType;
    analyzeChain(calls: Array<{
        prop: string;
        value: any;
        index: number;
    }>): AnalysisResult;
    addDynamicPattern(pattern: RegExp): void;
    addStaticPattern(pattern: RegExp): void;
    reset(): void;
}
export declare const autoDetector: AutoDetector;
