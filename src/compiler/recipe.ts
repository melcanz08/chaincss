// ============================================================================
// FILE: src/compiler/recipe.ts
// ChainCSS Type-Safe Component Variant Compiler Engine
// ============================================================================

import type { StyleDefinition, StyleObject } from "../shared/types/index.js";
import { run } from "@core/usecases/style-compiler.js";

export interface RecipeOptions<
  TVariants extends Record<
    string,
    Record<string, StyleDefinition | (() => StyleDefinition)>
  >,
> {
  base?: StyleDefinition | (() => StyleDefinition);
  variants?: TVariants;
  defaultVariants?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
  compoundVariants?: Array<{
    variants: Partial<{
      [K in keyof TVariants]: keyof TVariants[K] | Array<keyof TVariants[K]>;
    }>;
    style: StyleDefinition | (() => StyleDefinition);
  }>;
  namespace?: string;
}

export type Recipe<TVariants extends Record<string, Record<string, any>>> = {
  (
    selection?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>,
  ): StyleDefinition;
  variants: TVariants;
  defaultVariants: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
  base: StyleDefinition;
  getAllVariants: () => Array<
    Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>
  >;
  compileAll: () => string;
  getVariantClassNames: () => Record<string, string>;
};

/**
 * Deep merges style definitions immutably to safeguard nested structures.
 */
function deepMergeStyles(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  if (!source || typeof source !== "object") return target || {};
  const output = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (key === "selectors") {
      const targetSelectors = Array.isArray(output.selectors)
        ? output.selectors
        : [];
      const sourceSelectors = Array.isArray(value) ? value : [value];
      output.selectors = [
        ...new Set([...targetSelectors, ...sourceSelectors]),
      ];
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = deepMergeStyles(output[key] || {}, value);
    } else {
      output[key] = value;
    }
  }

  return output;
}

export function recipe<
  TVariants extends Record<
    string,
    Record<string, StyleDefinition | (() => StyleDefinition)>
  >,
>(options: RecipeOptions<TVariants>): Recipe<TVariants> {
  const {
    base,
    variants = {} as TVariants,
    defaultVariants = {},
    compoundVariants = [],
  } = options;
  const classPrefix = options.namespace || "chain-";

  // Evaluate lazy base style immutably
  const baseStyle = typeof base === "function" ? base() : base;

  // Process variants dictionary mapping
  const variantStyles: Record<string, Record<string, StyleDefinition>> = {};
  for (const [variantName, variantMap] of Object.entries(variants)) {
    variantStyles[variantName] = {};
    for (const [variantKey, variantStyle] of Object.entries(
      variantMap as Record<string, any>,
    )) {
      variantStyles[variantName][variantKey] =
        typeof variantStyle === "function" ? variantStyle() : variantStyle;
    }
  }

  // Pre-evaluate compound variant structures
  const compoundStyles = compoundVariants.map((cv) => ({
    condition: cv.variants || {},
    style: typeof cv.style === "function" ? cv.style() : cv.style,
  }));

  // Core selector matching and computation function
  const pick = (
    selection: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }> = {},
  ): StyleDefinition => {
    const selected = { ...defaultVariants, ...selection } as Record<
      string,
      any
    >;

    let merged: StyleDefinition = {
      selectors: [],
    } as unknown as StyleDefinition;

    let baseExplicitSelectors: string[] = [];
    if (baseStyle) {
      if (Array.isArray(baseStyle.selectors) && baseStyle.selectors.length > 0) {
        baseExplicitSelectors = [...baseStyle.selectors];
      }
      merged = deepMergeStyles(merged, baseStyle) as StyleDefinition;
    }

    let variantExplicitSelectors: string[] = [];

    // Blend matching active variant layouts
    for (const [variantName, variantValue] of Object.entries(selected)) {
      const variantStyle = variantStyles[variantName]?.[variantValue];
      if (variantStyle) {
        if (
          Array.isArray(variantStyle.selectors) &&
          variantStyle.selectors.length > 0
        ) {
          variantExplicitSelectors.push(...variantStyle.selectors);
        }
        merged = deepMergeStyles(merged, variantStyle) as StyleDefinition;
      }
    }

    // Blend compound intersections
    for (const cv of compoundStyles) {
      const conditions = Object.entries(cv.condition);
      if (
        conditions.length > 0 &&
        conditions.every(([key, expectedValue]) => {
          if (expectedValue === undefined) return false;
          const actualValue = selected[key];
          if (Array.isArray(expectedValue)) {
            return expectedValue.includes(actualValue);
          }
          return actualValue === expectedValue;
        })
      ) {
        if (
          Array.isArray(cv.style?.selectors) &&
          cv.style.selectors.length > 0
        ) {
          variantExplicitSelectors.push(...cv.style.selectors);
        }
        merged = deepMergeStyles(merged, cv.style) as StyleDefinition;
      }
    }

    // Construct key for variant combination
    const activeEntries = Object.entries(selected).filter(
      ([_, val]) => val !== undefined && val !== null && val !== "",
    );
    const variantKey = activeEntries.map(([k, v]) => `${k}-${v}`).join("_");

    // Determine target selector list
    if (variantExplicitSelectors.length > 0) {
      merged.selectors = [...new Set(variantExplicitSelectors)];
    } else if (baseExplicitSelectors.length > 0) {
      merged.selectors = variantKey
        ? baseExplicitSelectors.map((s) => `${s}_${variantKey}`)
        : [...baseExplicitSelectors];
    } else {
      merged.selectors = [variantKey || "base"];
    }

    // Safe, immutable selector prefix processing
    merged.selectors = merged.selectors.map((s) => {
      if (/^[.#\[:*]/.test(s) || s === "*") {
        return s;
      }
      return "." + classPrefix + s;
    });

    return merged;
  };

  // Cache matrix for computed variant paths
  let allVariantsCache: Array<
    Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>
  > | null = null;

  const getAllVariants = (): Array<
    Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>
  > => {
    if (allVariantsCache) return allVariantsCache;

    const result: Array<
      Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>
    > = [];
    const variantKeys = Object.keys(variants) as Array<keyof TVariants>;

    if (variantKeys.length === 0) {
      allVariantsCache = [{}];
      return allVariantsCache;
    }

    function generate(current: Record<string, any>, index: number): void {
      if (index === variantKeys.length) {
        if (result.length >= 1000) {
          throw new Error(
            "Recipe variant cross-product limit exceeded (1000 combinations max).",
          );
        }
        result.push(current as any);
        return;
      }

      const key = variantKeys[index] as string;
      const optionsMap = variants[key];

      for (const option of Object.keys(optionsMap)) {
        generate({ ...current, [key]: option }, index + 1);
      }
    }

    generate({}, 0);
    allVariantsCache = result;
    return result;
  };

  const getVariantClassNames = (): Record<string, string> => {
    const classNames: Record<string, string> = {};
    for (const variant of getAllVariants()) {
      const activeEntries = Object.entries(variant).filter(
        ([_, v]) => v !== undefined && v !== null && v !== "",
      );
      const key = activeEntries.map(([k, v]) => `${k}-${v}`).join("_") || "base";
      const def = pick(variant);
      if (def.selectors?.[0]) {
        classNames[key] = def.selectors[0].replace(/^\./, "");
      }
    }
    return classNames;
  };

  const compileAll = (): string => {
    const all = getAllVariants();
    const styles: StyleDefinition[] = all.map((v) => pick(v));
    return run(...(styles as unknown as StyleObject[]));
  };

  return Object.assign(pick, {
    variants,
    defaultVariants,
    base: baseStyle || ({ selectors: [] } as unknown as StyleDefinition),
    getAllVariants,
    getVariantClassNames,
    compileAll,
  }) as unknown as Recipe<TVariants>;
}