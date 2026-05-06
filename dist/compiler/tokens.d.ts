export interface TokenColors {
    [key: string]: string | Record<string, string>;
}
export interface TokenSpacing {
    [key: string]: string;
}
export interface TokenTypography {
    fontFamily: Record<string, string>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
    letterSpacing?: Record<string, string>;
}
export interface TokenBreakpoints {
    [key: string]: string;
}
export interface TokenZIndex {
    [key: string]: string;
}
export interface TokenShadows {
    [key: string]: string;
}
export interface TokenBorderRadius {
    [key: string]: string;
}
export interface TokensStructure {
    colors: TokenColors;
    spacing: TokenSpacing;
    typography: TokenTypography;
    breakpoints: TokenBreakpoints;
    zIndex: TokenZIndex;
    shadows: TokenShadows;
    borderRadius: TokenBorderRadius;
    [key: string]: any;
}
export interface TokenValue {
    value: any;
    description?: string;
    deprecated?: boolean;
    aliases?: string[];
}
export type FlattenedTokens = Record<string, string>;
export declare const defaultTokens: TokensStructure;
export declare class DesignTokens {
    private customTokens;
    private customFlattened;
    private defaultFlattened;
    private tokenCache;
    constructor(customTokens?: Partial<TokensStructure>);
    private deepClone;
    private deepFreeze;
    flattenTokens(obj: Record<string, any>, prefix?: string): FlattenedTokens;
    get(path: string, defaultValue?: string): string;
    getColor(path: string, defaultValue?: string): string;
    getSpacing(path: string, defaultValue?: string): string;
    getFontSize(path: string, defaultValue?: string): string;
    getFontWeight(path: string, defaultValue?: string): string;
    getLineHeight(path: string, defaultValue?: string): string;
    getBreakpoint(path: string, defaultValue?: string): string;
    getZIndex(path: string, defaultValue?: string): string;
    getShadow(path: string, defaultValue?: string): string;
    getBorderRadius(path: string, defaultValue?: string): string;
    getCustomTokens(): FlattenedTokens;
    getDefaultTokens(): FlattenedTokens;
    has(path: string): boolean;
    toCSSVariables(prefix?: string): string;
    toMediaQueries(): Record<string, string>;
    createTheme(name: string, overrides: Record<string, string>): DesignTokens;
    merge(tokens: Partial<TokensStructure>): DesignTokens;
    clearCache(): void;
    getSuggestions(partialPath: string): string[];
}
export declare const tokens: DesignTokens;
export declare function createTokens(customTokens: Partial<TokensStructure>): DesignTokens;
export declare function resolveTokenReferences(value: string, tokens: DesignTokens, prefix?: string): string;
export declare function isTokenReference(value: any, prefix?: string): boolean;
export { DesignTokens as default };
