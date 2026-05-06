/**
 * 1. THE DICTIONARY (Simple 1-to-1 Swaps)
 * Handled by the ChainClass for performance.
 */
export declare const shorthandMap: Record<string, string>;
type MacroHandler = (value: any, catcher: Record<string, any>, useTokens: boolean) => void;
/**
 * 2. THE MACRO REGISTRY (Complex Logic)
 */
export declare const macros: Record<string, MacroHandler>;
/**
 * Main handler for shorthand processing
 * Returns true if the shorthand was handled, false otherwise
 */
export declare function handleShorthand(prop: string, value: any, catcher: Record<string, any>, useTokens?: boolean): boolean;
/**
 * Utility to check if a property is a registered shorthand
 */
export declare function isShorthand(prop: string): boolean;
/**
 * Get the expanded property name for a shorthand
 */
export declare function expandShorthand(prop: string): string | null;
/**
 * Get all available shorthands
 */
export declare function getAvailableShorthands(): string[];
export {};
