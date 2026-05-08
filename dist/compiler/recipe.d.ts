import type { StyleDefinition } from '../core/types.js';
export interface RecipeOptions<TVariants extends Record<string, Record<string, any>>> {
    base?: StyleDefinition | (() => StyleDefinition);
    variants?: TVariants;
    defaultVariants?: Partial<{
        [K in keyof TVariants]: keyof TVariants[K];
    }>;
    compoundVariants?: Array<{
        variants: Partial<{
            [K in keyof TVariants]: keyof TVariants[K];
        }>;
        style: StyleDefinition | (() => StyleDefinition);
    }>;
}
export type Recipe<TVariants extends Record<string, Record<string, any>>> = {
    (selection?: Partial<{
        [K in keyof TVariants]: keyof TVariants[K];
    }>): StyleDefinition;
    variants: TVariants;
    defaultVariants: Partial<{
        [K in keyof TVariants]: keyof TVariants[K];
    }>;
    base: StyleDefinition;
    getAllVariants: () => Array<Partial<{
        [K in keyof TVariants]: keyof TVariants[K];
    }>>;
    compileAll: () => string;
    getVariantClassNames: () => Record<string, string>;
};
export declare function recipe<TVariants extends Record<string, Record<string, any>>>(options: RecipeOptions<TVariants>): Recipe<TVariants>;
