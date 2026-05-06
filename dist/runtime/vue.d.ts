import { Ref } from 'vue';
export interface UseAtomicClassesOptions {
    atomic?: boolean;
    global?: boolean;
    debug?: boolean;
}
export interface AtomicClassesReturn {
    classes: Ref<Record<string, string>>;
    cx: (name: string) => string;
    cn: (...names: string[]) => string;
    inject: (styles: Record<string, any>) => void;
}
export declare function useAtomicClasses(styles: any, options?: UseAtomicClassesOptions): AtomicClassesReturn;
export declare const ChainCSSGlobal: {
    name: string;
    props: {
        styles: {
            type: ObjectConstructor;
            required: boolean;
            default: () => {};
        };
        tokens: {
            type: ObjectConstructor;
            required: boolean;
            default: () => {};
        };
        debug: {
            type: BooleanConstructor;
            default: boolean;
        };
    };
    setup(props: any): () => null;
};
/**
 * Create a styled Vue component
 */
export declare function createStyledComponent(styles: Record<string, any> | (() => Record<string, any>), tag?: string, options?: UseAtomicClassesOptions): {
    name: string;
    props: {
        className: {
            type: StringConstructor;
            default: string;
        };
        as: {
            type: StringConstructor;
            default: string;
        };
    };
    setup(props: any, { slots, attrs }: any): () => any;
};
/**
 * Create multiple styled Vue components at once
 */
export declare function createStyledComponents(components: Record<string, any>, options?: UseAtomicClassesOptions): Record<string, any>;
/**
 * CSS-in-JS with computed props (Vue)
 */
export declare function useComputedStyles<T extends Record<string, any>>(styles: (props: T) => Record<string, any>, props: T, options?: UseAtomicClassesOptions): {
    classes: Ref<Record<string, string>>;
    rootClass: Ref<string>;
};
/**
 * Style provider for theme/context (Vue)
 */
export declare function provideStyleContext(theme: any): Ref<any>;
export declare function injectStyleContext(): Ref<any>;
/**
 * Debug utilities for Vue
 */
export declare function enableVueDebug(): void;
export declare function disableVueDebug(): void;
export declare function isVueDebugEnabled(): boolean;
