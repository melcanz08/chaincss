export interface PrefixerConfig {
    browsers?: string[];
    enabled?: boolean;
    mode?: 'auto' | 'full' | 'lightweight';
    sourceMap?: boolean;
    sourceMapInline?: boolean;
    remove?: boolean;
    add?: boolean;
    verbose?: boolean;
    flexbox?: boolean | 'no-2009';
    grid?: boolean | 'autoplace' | 'no-autoplace';
}
export interface PrefixerResult {
    css: string;
    map: string | null;
    warnings?: string[];
}
export interface ProcessOptionsWithPaths {
    from?: string;
    to?: string;
    map?: boolean | object;
}
export interface CaniuseFeature {
    title: string;
    description: string;
    stats: Record<string, Record<string, string>>;
    spec?: string;
    status?: string;
}
export declare class ChainCSSPrefixer {
    config: Required<PrefixerConfig>;
    hasBuiltInDeps: boolean;
    hasAutoprefixer: boolean;
    prefixerMode: 'auto' | 'full' | 'lightweight';
    caniuseData: Record<string, CaniuseFeature> | null;
    commonProperties: string[];
    specialValues: Record<string, string[]>;
    browserPrefixMap: Record<string, string>;
    targetBrowsers: string[] | null;
    private warnings;
    constructor(config?: PrefixerConfig);
    determineMode(): Promise<'auto' | 'full' | 'lightweight'>;
    process(cssString: string, options?: ProcessOptionsWithPaths): Promise<PrefixerResult>;
    private processWithAutoprefixer;
    private processWithBuiltIn;
    private lightweightPrefix;
    private createBuiltInPlugin;
    private processBuiltInDeclaration;
    private shouldKeepPrefix;
    private addPrefixesFromCaniuse;
    private addSpecialValuePrefixes;
    private findFeature;
    private getCommonProperties;
    needsPrefix(property: string, browser: string, version: number): boolean;
    getAvailablePrefixes(property: string): string[];
    reset(): void;
}
export { ChainCSSPrefixer as default };
