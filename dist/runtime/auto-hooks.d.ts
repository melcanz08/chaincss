import React from 'react';
export interface UseSmartStylesOptions {
    debug?: boolean;
    ssr?: boolean;
    moduleId?: string;
}
export declare function useSmartStyles<T extends Record<string, any>>(styleBuilder: (chain: any) => any, deps?: any[], options?: UseSmartStylesOptions): Record<string, string>;
export declare function createSmartComponent<P extends Record<string, any>>(Component: React.ComponentType<P>, baseStyles?: (chain: any) => any): React.FC<P & {
    className?: string;
}>;
export declare function withSmartStyles<P extends Record<string, any>>(WrappedComponent: React.ComponentType<P>, styles: (chain: any) => any): React.FC<P>;
