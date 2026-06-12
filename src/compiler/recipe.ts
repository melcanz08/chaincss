// src/compiler/recipe.ts
/**
 * Recipe System - Type-safe component variants
 */
import { chain } from '../core/style-collector.js';
import type { StyleDefinition } from '../core/types.js';
import { run } from '../core/style-compiler.js';

export interface RecipeOptions<TVariants extends Record<string, Record<string, any>>> {
  base?: StyleDefinition | (() => StyleDefinition);
  variants?: TVariants;
  defaultVariants?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
  compoundVariants?: Array<{
    variants: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
    style: StyleDefinition | (() => StyleDefinition);
  }>;
}

export type Recipe<TVariants extends Record<string, Record<string, any>>> = {
  (selection?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>): StyleDefinition;
  variants: TVariants;
  defaultVariants: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
  base: StyleDefinition;
  getAllVariants: () => Array<Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>>;
  compileAll: () => string;
  getVariantClassNames: () => Record<string, string>;
};

export function recipe<TVariants extends Record<string, Record<string, any>>>(
  options: RecipeOptions<TVariants>
): Recipe<TVariants> {
  const { base, variants = {} as TVariants, defaultVariants = {}, compoundVariants = [] } = options;

  const baseStyle = typeof base === 'function' ? (base as () => StyleDefinition)() : base;
  const variantStyles: Record<string, Record<string, StyleDefinition>> = {};

  for (const [variantName, variantMap] of Object.entries(variants)) {
    variantStyles[variantName] = {};
    for (const [variantKey, variantStyle] of Object.entries(variantMap as Record<string, any>)) {
      variantStyles[variantName][variantKey] = typeof variantStyle === 'function'
        ? (variantStyle as () => StyleDefinition)()
        : variantStyle;
    }
  }

  const compoundStyles = compoundVariants.map(cv => ({
    condition: cv.variants || cv,
    style: typeof cv.style === 'function' ? (cv.style as () => StyleDefinition)() : cv.style
  }));

  function mergeStyles(...styles: (StyleDefinition | undefined)[]): StyleDefinition {
    const merged: StyleDefinition = { selectors: [] } as StyleDefinition;
    for (const style of styles) {
      if (!style) continue;
      for (const [key, value] of Object.entries(style)) {
        if (key === 'selectors') {
          const newSelectors = Array.isArray(value) ? value : [value];
          merged.selectors = [...new Set([...(merged.selectors || []), ...newSelectors])];
        } else if (key === 'hover' && typeof value === 'object') {
          if (!merged.hover) merged.hover = {};
          Object.assign(merged.hover, value);
        } else if (key !== 'selectors') {
          (merged as any)[key] = value;
        }
      }
    }
    return merged;
  }

  function pick(variantSelection: Partial<Record<keyof TVariants, any>> = {}): StyleDefinition {
    const selected = { ...defaultVariants, ...variantSelection } as Record<string, any>;
    const stylesToMerge: StyleDefinition[] = [];

    if (baseStyle) stylesToMerge.push(baseStyle);
    for (const [variantName, variantValue] of Object.entries(selected)) {
      const variantStyle = variantStyles[variantName]?.[variantValue];
      if (variantStyle) stylesToMerge.push(variantStyle);
    }
    for (const cv of compoundStyles) {
      if (Object.entries(cv.condition).every(([key, value]) => selected[key] === value) && cv.style) {
        stylesToMerge.push(cv.style);
      }
    }

    const merged = mergeStyles(...stylesToMerge);
    let styleBuilder: any = chain();

    for (const [prop, value] of Object.entries(merged)) {
      if (prop === 'selectors' || prop === 'hover') continue;
      if (styleBuilder[prop]) styleBuilder = styleBuilder[prop](value);
    }
    if (merged.hover) {
      styleBuilder = styleBuilder.hover();
      for (const [hoverProp, hoverValue] of Object.entries(merged.hover)) {
        if (styleBuilder[hoverProp]) styleBuilder = styleBuilder[hoverProp](hoverValue);
      }
      styleBuilder = styleBuilder.end();
    }

    return styleBuilder.$el(...(merged.selectors || []));
  }

  (pick as any).variants = variants;
  (pick as any).defaultVariants = defaultVariants;
  (pick as any).base = baseStyle;

  (pick as any).getAllVariants = () => {
    const result: Array<Partial<Record<keyof TVariants, any>>> = [];
    const variantKeys = Object.keys(variants) as (keyof TVariants)[];
    function generate(current: Partial<Record<keyof TVariants, any>>, index: number): void {
      if (index === variantKeys.length) { result.push({ ...current }); return; }
      for (const v of Object.keys(variants[variantKeys[index]] as Record<string, any>)) {
        current[variantKeys[index]] = v as any;
        generate(current, index + 1);
      }
    }
    generate({}, 0);
    return result;
  };

  (pick as any).getVariantClassNames = () => {
    const classNames: Record<string, string> = {};
    for (const variant of (pick as any).getAllVariants()) {
      const key = Object.entries(variant).map(([k, v]) => `${k}-${v}`).join('_');
      const def = pick(variant);
      if (def.selectors?.[0]) classNames[key] = def.selectors[0].replace(/^\./, '');
    }
    return classNames;
  };

  (pick as any).compileAll = () => {
    const all = (pick as any).getAllVariants();
    const styles: StyleDefinition[] = [];
    if (baseStyle?.selectors) styles.push(baseStyle);
    for (const v of all) { const d = pick(v); if (d?.selectors) styles.push(d); }
    return run(...styles);
  };

  return pick as Recipe<TVariants>;
}
