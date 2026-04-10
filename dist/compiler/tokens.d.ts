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
export type FlattenedTokens = Record<string, string>;
export declare class DesignTokens {
    tokens: TokensStructure;
    flattened: FlattenedTokens;
    constructor(tokens?: Partial<TokensStructure>);
    deepFreeze<T extends object>(obj: T): T;
    flattenTokens(obj: Record<string, any>, prefix?: string): FlattenedTokens;
    get(path: string, defaultValue?: string): string;
    toCSSVariables(prefix?: string): string;
    createTheme(name: string, overrides: Record<string, string>): DesignTokens;
    expandTokens(flattened: FlattenedTokens): TokensStructure;
}
export declare const defaultTokens: TokensStructure;
export declare const tokens: DesignTokens;
export declare function createTokens(customTokens: Partial<TokensStructure>): DesignTokens;
export declare function responsive(values: Record<string, string> | string): string;
export { DesignTokens as default };
//# sourceMappingURL=tokens.d.ts.map