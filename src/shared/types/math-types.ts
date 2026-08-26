// ============================================================================
// // src/shared/types/math-types.ts
// ============================================================================

// Fix #6: Add modern viewport and container query units
export type CSSUnit =
  | "px" | "rem" | "em" | "%"
  | "vw" | "vh" | "vmin" | "vmax"
  | "dvw" | "dvh" | "svh" | "lvh"
  | "cqw" | "cqh" | "cqi" | "cqb" | "cqmin" | "cqmax"
  | "ch" | "ex" | "cm" | "mm" | "in" | "pt" | "pc"
  | "deg" | "rad" | "turn" | "grad"
  | "s" | "ms"
  | "dpi" | "dpcm" | "dppx";

export interface CSSMathValue {
  value: number;
  unit: CSSUnit;
}

export interface MathContext {
  rootFontSize?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  parentFontSize?: number;
  dpi?: number;
  elementWidth?: number;
  elementHeight?: number;
}

export interface MathResult {
  value: number;
  unit: CSSUnit | "calc" | "mixed";
  expression: string;
  resolved: CSSMathValue | null;
  explanations: string[];
  toString(): string;
  toCalc(): string;
}

export interface FluidTypeConfig {
  minSize: number;
  maxSize: number;
  minWidth?: number;
  maxWidth?: number;
  unit?: "px" | "rem";
  rootFontSize?: number;
}