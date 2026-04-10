/**
 * Theme Contract System for ChainCSS
 * Validates that themes match the expected shape
 */
export interface ThemeContract {
    [key: string]: ThemeContract | string;
}
export interface ThemeTokens {
    [key: string]: string | ThemeTokens;
}
export interface TokensStructure {
    colors: Record<string, string | Record<string, string>>;
    spacing: Record<string, string>;
    typography: {
        fontFamily: Record<string, string>;
        fontSize: Record<string, string>;
        fontWeight: Record<string, string>;
        lineHeight: Record<string, string>;
    };
    breakpoints: Record<string, string>;
    zIndex: Record<string, string>;
    shadows: Record<string, string>;
    borderRadius: Record<string, string>;
}
/**
 * Theme class with getter method
 */
export declare class Theme {
    private tokens;
    constructor(tokens: ThemeTokens);
    get(path: string): string | undefined;
    toObject(): ThemeTokens;
}
/**
 * Create a theme contract that defines the expected shape of themes
 * @param contractShape - The contract object defining required token paths
 * @returns Proxy contract with validation methods
 */
export declare function createThemeContract(contractShape: ThemeContract): ThemeContract & {
    __isContract: boolean;
    __validate: (theme: ThemeTokens) => boolean;
};
/**
 * Validate that a theme matches the contract
 * @param contract - The contract to validate against
 * @param theme - The theme to validate
 * @param path - Current path for error messages
 * @returns true if valid, throws error otherwise
 */
export declare function validateTheme(contract: ThemeContract, theme?: ThemeTokens, path?: string): boolean;
/**
 * Create an actual theme from a contract and values
 * @param contract - The contract defining the shape
 * @param themeValues - The actual theme values
 * @returns Theme object with getter method
 */
export declare function createTheme(contract: ThemeContract | (ThemeContract & {
    __isContract: boolean;
    __validate: (theme: ThemeTokens) => boolean;
}), themeValues: ThemeTokens): Theme;
//# sourceMappingURL=theme-contract.d.ts.map