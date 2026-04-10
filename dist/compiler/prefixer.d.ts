export interface PrefixerConfig {
    browsers?: string[];
    enabled?: boolean;
    mode?: 'auto' | 'full' | 'lightweight';
    sourceMap?: boolean;
    sourceMapInline?: boolean;
}
export interface PrefixerResult {
    css: string;
    map: string | null;
}
export interface ProcessOptionsWithPaths {
    from?: string;
    to?: string;
}
export interface CaniuseFeature {
    stats: Record<string, Record<string, string>>;
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
    constructor(config?: PrefixerConfig);
    determineMode(): Promise<'auto' | 'full' | 'lightweight'>;
    process(cssString: string, options?: ProcessOptionsWithPaths): Promise<PrefixerResult>;
    private processWithAutoprefixer;
    private processWithBuiltIn;
    private createBuiltInPlugin;
    private processBuiltInDeclaration;
    private addPrefixesFromCaniuse;
    private addSpecialValuePrefixes;
    private findFeature;
    private getCommonProperties;
}
export { ChainCSSPrefixer as default };
//# sourceMappingURL=prefixer.d.ts.map