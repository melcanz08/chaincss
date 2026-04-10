import { Ref } from 'vue';
export interface UseAtomicClassesOptions {
    atomic?: boolean;
    global?: boolean;
}
export declare function useAtomicClasses(styles: any, options?: UseAtomicClassesOptions): {
    classes: import("vue").ComputedRef<Record<string, string>>;
    cx: (name: string) => string;
    cn: (...names: string[]) => string;
};
export declare const ChainCSSGlobal: {
    name: string;
    props: {
        styles: {
            type: ObjectConstructor;
            required: boolean;
        };
    };
    setup(props: any): () => null;
};
/**
 * Create a styled Vue component
 */
export declare function createStyledComponent(styles: Record<string, any> | (() => Record<string, any>), tag?: string): {
    name: string;
    props: {
        className: {
            type: StringConstructor;
            default: string;
        };
    };
    setup(props: any, { slots, attrs }: any): () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
        [key: string]: any;
    }>;
};
/**
 * Create multiple styled Vue components at once
 */
export declare function createStyledComponents(components: Record<string, any>): Record<string, any>;
/**
 * CSS-in-JS with computed props (Vue)
 */
export declare function useComputedStyles<T extends Record<string, any>>(styles: (props: T) => Record<string, any>, props: T): {
    classes: import("vue").ComputedRef<Record<string, string>>;
    rootClass: import("vue").ComputedRef<string>;
};
/**
 * Style provider for theme/context (Vue)
 */
export declare function provideStyleContext(theme: any): Ref<any, any>;
export declare function injectStyleContext(): Ref<any, any>;
//# sourceMappingURL=vue.d.ts.map