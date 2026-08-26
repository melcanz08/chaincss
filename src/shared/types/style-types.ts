// ============================================================================
// // src/shared/types/style-types.ts
// ============================================================================

export type DynamicValueGetter = (...args: unknown[]) => unknown;

// Basic CSS value types
export type CSSPrimitiveValue = string | number | (string | number)[];

export interface CSSProperties {
  [property: string]: CSSPrimitiveValue | DynamicValueGetter;
}

export interface PseudoStyles {
  [cssProperty: string]: CSSPrimitiveValue;
}

export interface PseudoClasses {
  [pseudoSelector: `&:${string}`]: PseudoStyles;
}

export interface StyleObject {
  selectors?: string | string[];
  _atRules?: any[];
  _nestedRules?: any[];
  nestedRules?: any[];
  atRules?: any[];
  _classes?: string[];
  _transforms?: Array<{ type: string; [key: string]: unknown }>;
  _name?: string;
  _mixed?: boolean;
  _intents?: string[];

  [property: string]:
    | CSSPrimitiveValue
    | DynamicValueGetter
    | PseudoStyles
    | any[]
    | string
    | string[]
    | Array<{ type: string; [key: string]: unknown }>
    | boolean
    | undefined;
}

