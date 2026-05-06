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
/**
 * Theme class with getter method
 */
export declare class Theme {
    private tokens;
    constructor(tokens: ThemeTokens);
    get(path: string): string | undefined;
    set(path: string, value: string): void;
    toObject(): ThemeTokens;
    toCSSVariables(prefix?: string): string;
}
/**
 * Create a theme contract that defines the expected shape of themes
 */
export declare function createThemeContract<T extends ThemeContract>(contractShape: T): T & {
    __isContract: true;
    __validate: (theme: ThemeTokens) => boolean;
};
/**
 * Validate that a theme matches the contract
 * @returns true if valid, throws error otherwise
 */
export declare function validateTheme(contract: ThemeContract, theme?: ThemeTokens, path?: string): boolean;
/**
 * Create an actual theme from a contract and values
 */
export declare function createTheme<T extends ThemeContract>(contract: T | (T & {
    __isContract: boolean;
}), themeValues: ThemeTokens): Theme;
export declare function isThemeContract(obj: any): obj is ThemeContract & {
    __isContract: true;
};
declare const _default: {
    Theme: typeof Theme;
    createThemeContract: typeof createThemeContract;
    validateTheme: typeof validateTheme;
    createTheme: typeof createTheme;
    isThemeContract: typeof isThemeContract;
};
export default _default;
