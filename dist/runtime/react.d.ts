import React from 'react';
export interface UseChainStylesOptions {
    cache?: boolean;
    namespace?: string;
    watch?: boolean;
    debug?: boolean;
    ssr?: boolean;
}
/**
 * React hook for ChainCSS runtime styles
 */
export declare function useChainStyles(styles: Record<string, any>, deps?: any[], options?: UseChainStylesOptions): Record<string, string>;
/**
 * Dynamic styles hook - re-runs when deps change
 */
export declare function useDynamicChainStyles(styleFactory: () => Record<string, any>, deps?: any[], options?: UseChainStylesOptions): Record<string, string>;
/**
 * Theme-aware styles hook
 */
export declare function useThemeChainStyles(styles: Record<string, any> | ((theme: any) => Record<string, any>), theme: any, options?: UseChainStylesOptions): Record<string, string>;
/**
 * Global style injection component
 */
export declare function ChainCSSGlobal({ styles, tokens, children }: {
    styles?: Record<string, any>;
    tokens?: any;
    children?: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
/**
 * Class name utility (like clsx)
 */
export declare function cx(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string;
/**
 * HOC for class components
 */
export declare function withChainStyles<P extends object>(styles: Record<string, any> | ((props: P) => Record<string, any>), options?: UseChainStylesOptions): (props: P & {
    chainStyles?: Record<string, string>;
}) => import("react/jsx-runtime").JSX.Element;
/**
 * Create a styled component (React)
 */
export declare function createStyledComponent<T extends keyof React.JSX.IntrinsicElements = "div">(elementType: T, styles: Record<string, any> | (() => Record<string, any>), options?: UseChainStylesOptions): React.FC<React.ComponentProps<T> & {
    className?: string;
}>;
/**
 * Create multiple styled components at once
 */
export declare function createStyledComponents(components: Record<string, any>): Record<string, React.FC>;
/**
 * CSS-in-JS hook with computed styles
 */
export declare function useComputedStyles<T extends Record<string, any>>(styles: (props: T) => Record<string, any>, props: T, deps?: any[], options?: UseChainStylesOptions): Record<string, string>;
/**
 * Set global tokens from React
 */
export declare function setTokens(tokens: any): void;
export declare function enableChainCSSDebug(): void;
export declare function disableChainCSSDebug(): void;
export declare function isDebugEnabled(): boolean;
