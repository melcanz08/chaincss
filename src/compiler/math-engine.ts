// ============================================================================
// FILE: src/compiler/math-engine.ts
// Zero-runtime CSS Math Engine with Unit Resolution
// ============================================================================

import type { 
  CSSUnit, 
  CSSMathValue, 
  MathContext, 
  MathResult, 
  FluidTypeConfig 
} from '../core/types.js';

// ============================================================================
// Types
// ============================================================================

export type { CSSUnit, CSSMathValue, MathContext, MathResult, FluidTypeConfig };

export type MathOp = 'add' | 'subtract' | 'multiply' | 'divide';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONTEXT: Required<MathContext> = {
  rootFontSize: 16,
  viewportWidth: 1920,
  viewportHeight: 1080,
  parentFontSize: 16,
  dpi: 96,
  elementWidth: 1920,
  elementHeight: 1080,
};

const UNIT_CATEGORIES: Record<string, CSSUnit[]> = {
  absolute: ['px', 'cm', 'mm', 'in', 'pt', 'pc'],
  relative: ['rem', 'em', '%', 'ch', 'ex'],
  viewport: ['vw', 'vh', 'vmin', 'vmax'],
  angle: ['deg', 'rad', 'turn', 'grad'],
  time: ['s', 'ms'],
  resolution: ['dpi', 'dpcm', 'dppx'],
};

const PX_CONVERSIONS: Record<string, number> = {
  'cm': 37.795,
  'mm': 3.7795,
  'in': 96,
  'pt': 1.333,
  'pc': 16,
};

// ============================================================================
// Parsing Utilities
// ============================================================================

function parseCSSValue(input: string | number): CSSMathValue {
  if (typeof input === 'number') {
    return { value: input, unit: 'px' };
  }
  
  const trimmed = input.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc|deg|rad|turn|grad|s|ms|dpi|dpcm|dppx)?$/i);
  
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: (match[2]?.toLowerCase() as CSSUnit) || 'px',
    };
  }
  
  // Fallback: try to extract numeric value
  const numMatch = trimmed.match(/(-?\d+(?:\.\d+)?)/);
  return {
    value: numMatch ? parseFloat(numMatch[1]) : 0,
    unit: 'px',
  };
}

function getUnitCategory(unit: CSSUnit): string {
  for (const [category, units] of Object.entries(UNIT_CATEGORIES)) {
    if (units.includes(unit)) return category;
  }
  return 'unknown';
}

// ============================================================================
// Unit Resolution Engine
// ============================================================================

function resolveToPx(value: CSSMathValue, context: Required<MathContext>): number {
  const { value: v, unit } = value;
  
  switch (unit) {
    case 'px': return v;
    case 'rem': return v * context.rootFontSize;
    case 'em': return v * context.parentFontSize;
    case '%': return (v / 100) * context.parentFontSize; // Default to font-relative
    case 'vw': return (v / 100) * context.viewportWidth;
    case 'vh': return (v / 100) * context.viewportHeight;
    case 'vmin': return (v / 100) * Math.min(context.viewportWidth, context.viewportHeight);
    case 'vmax': return (v / 100) * Math.max(context.viewportWidth, context.viewportHeight);
    case 'cm': return v * (PX_CONVERSIONS['cm'] || 37.795);
    case 'mm': return v * (PX_CONVERSIONS['mm'] || 3.7795);
    case 'in': return v * (PX_CONVERSIONS['in'] || 96);
    case 'pt': return v * (PX_CONVERSIONS['pt'] || 1.333);
    case 'pc': return v * (PX_CONVERSIONS['pc'] || 16);
    // ch/ex are approximate
    case 'ch': return v * (context.parentFontSize * 0.5);
    case 'ex': return v * (context.parentFontSize * 0.45);
    default: return v;
  }
}

function resolveFromPx(px: number, targetUnit: CSSUnit, context: Required<MathContext>): number {
  switch (targetUnit) {
    case 'px': return px;
    case 'rem': return px / context.rootFontSize;
    case 'em': return px / context.parentFontSize;
    case '%': return (px / context.parentFontSize) * 100;
    case 'vw': return (px / context.viewportWidth) * 100;
    case 'vh': return (px / context.viewportHeight) * 100;
    case 'vmin': return (px / Math.min(context.viewportWidth, context.viewportHeight)) * 100;
    case 'vmax': return (px / Math.max(context.viewportWidth, context.viewportHeight)) * 100;
    case 'cm': return px / (PX_CONVERSIONS['cm'] || 37.795);
    case 'mm': return px / (PX_CONVERSIONS['mm'] || 3.7795);
    case 'in': return px / (PX_CONVERSIONS['in'] || 96);
    case 'pt': return px / (PX_CONVERSIONS['pt'] || 1.333);
    case 'pc': return px / (PX_CONVERSIONS['pc'] || 16);
    case 'ch': return px / (context.parentFontSize * 0.5);
    case 'ex': return px / (context.parentFontSize * 0.45);
    default: return px;
  }
}

function canResolve(a: CSSMathValue, b: CSSMathValue, context: Required<MathContext>): boolean {
  const catA = getUnitCategory(a.unit);
  const catB = getUnitCategory(b.unit);
  
  // Same category can resolve
  if (catA === catB) return true;
  
  // Mixed absolute/relative can resolve with context
  if ((catA === 'absolute' || catA === 'relative') && 
      (catB === 'absolute' || catB === 'relative')) return true;
  
  return false;
}

// ============================================================================
// Result Factory
// ============================================================================

function createResult(
  value: number, 
  unit: CSSUnit | 'calc' | 'mixed', 
  expression: string, 
  resolved: CSSMathValue | null,
  explanations: string[] = []
): MathResult {
  return {
    value,
    unit,
    expression,
    resolved,
    explanations,
    toString(): string {
      return this.expression;
    },
    toCalc(): string {
      return unit === 'calc' ? expression : `calc(${expression})`;
    },
  };
}

// ============================================================================
// Core Math Operations
// ============================================================================

function operate(
  a: string | number,
  op: MathOp,
  b: string | number,
  context?: MathContext
): MathResult {
  const ctx: Required<MathContext> = { ...DEFAULT_CONTEXT, ...context };
  const valA = parseCSSValue(a);
  const valB = parseCSSValue(b);
  const explanations: string[] = [];
  
  // Same unit — direct operation
  if (valA.unit === valB.unit) {
    let result: number;
    switch (op) {
      case 'add': result = valA.value + valB.value; break;
      case 'subtract': result = valA.value - valB.value; break;
      case 'multiply': result = valA.value * valB.value; break;
      case 'divide': result = valA.value / valB.value; break;
    }
    
    const rounded = Math.round(result * 100) / 100;
    explanations.push(`Same unit (${valA.unit}) — direct ${op}`);
    
    return createResult(
      rounded,
      valA.unit,
      `${rounded}${valA.unit}`,
      { value: rounded, unit: valA.unit },
      explanations
    );
  }
  
  // Can resolve to common unit
  if (canResolve(valA, valB, ctx)) {
    const pxA = resolveToPx(valA, ctx);
    const pxB = resolveToPx(valB, ctx);
    
    let pxResult: number;
    switch (op) {
      case 'add': pxResult = pxA + pxB; break;
      case 'subtract': pxResult = pxA - pxB; break;
      case 'multiply': pxResult = pxA * pxB; break;
      case 'divide': pxResult = pxA / pxB; break;
    }
    
    const rounded = Math.round(pxResult * 100) / 100;
    explanations.push(`Resolved ${valA.value}${valA.unit} → ${Math.round(pxA * 100) / 100}px`);
    explanations.push(`Resolved ${valB.value}${valB.unit} → ${Math.round(pxB * 100) / 100}px`);
    explanations.push(`${op} → ${rounded}px`);
    
    return createResult(
      rounded,
      'px',
      `${rounded}px`,
      { value: rounded, unit: 'px' },
      explanations
    );
  }
  
  // Cannot resolve — emit calc()
  const expr = `${valA.value}${valA.unit} ${getOpSymbol(op)} ${valB.value}${valB.unit}`;
  explanations.push(`Cannot resolve ${valA.unit} ↔ ${valB.unit} — using calc()`);
  
  return createResult(
    0,
    'calc',
    `calc(${expr})`,
    null,
    explanations
  );
}

function getOpSymbol(op: MathOp): string {
  switch (op) {
    case 'add': return '+';
    case 'subtract': return '-';
    case 'multiply': return '*';
    case 'divide': return '/';
  }
}

// ============================================================================
// Public API
// ============================================================================

export const math = {
  /**
   * Add two CSS values with unit resolution.
   * 
   * @example
   * math.add('10px', '2rem')                    // → '42px' (with default context)
   * math.add('10px', '2rem', { rootFontSize: 16 }) // → '42px'
   * math.add('10px', '2vw')                     // → 'calc(10px + 2vw)'
   */
  add(a: string | number, b: string | number, context?: MathContext): MathResult {
    return operate(a, 'add', b, context);
  },

  /**
   * Subtract two CSS values with unit resolution.
   */
  subtract(a: string | number, b: string | number, context?: MathContext): MathResult {
    return operate(a, 'subtract', b, context);
  },

  /**
   * Multiply two CSS values with unit resolution.
   */
  multiply(a: string | number, b: string | number, context?: MathContext): MathResult {
    return operate(a, 'multiply', b, context);
  },

  /**
   * Divide two CSS values with unit resolution.
   */
  divide(a: string | number, b: string | number, context?: MathContext): MathResult {
    return operate(a, 'divide', b, context);
  },

  /**
   * Sum multiple CSS values.
   */
  sum(...values: (string | number)[]): MathResult {
    if (values.length === 0) {
      return createResult(0, 'px', '0px', { value: 0, unit: 'px' });
    }
    if (values.length === 1) {
      const parsed = parseCSSValue(values[0]);
      return createResult(parsed.value, parsed.unit, `${parsed.value}${parsed.unit}`, parsed);
    }
    
    let result = this.add(values[0], values[1]);
    for (let i = 2; i < values.length; i++) {
      result = this.add(result.expression, values[i]);
    }
    return result;
  },

  /**
   * Resolve a CSS value to pixels.
   */
  toPx(value: string | number, context?: MathContext): number {
    const ctx: Required<MathContext> = { ...DEFAULT_CONTEXT, ...context };
    const parsed = parseCSSValue(value);
    return resolveToPx(parsed, ctx);
  },

  /**
   * Convert between CSS units.
   */
  convert(
    value: string | number,
    toUnit: CSSUnit,
    context?: MathContext
  ): MathResult {
    const ctx: Required<MathContext> = { ...DEFAULT_CONTEXT, ...context };
    const parsed = parseCSSValue(value);
    const px = resolveToPx(parsed, ctx);
    const converted = resolveFromPx(px, toUnit, ctx);
    const rounded = Math.round(converted * 1000) / 1000;
    
    return createResult(
      rounded,
      toUnit,
      `${rounded}${toUnit}`,
      { value: rounded, unit: toUnit },
      [`${parsed.value}${parsed.unit} → ${rounded}${toUnit}`]
    );
  },

  /**
   * Create a fluid typography clamp() expression.
   * 
   * @example
   * math.fluidType({ minSize: 14, maxSize: 20 }) 
   *   // → 'clamp(14px, 0.625vw + 12px, 20px)'
   * math.fluidType({ minSize: 14, maxSize: 20, unit: 'rem', rootFontSize: 16 })
   *   // → 'clamp(0.875rem, 0.625vw + 0.75rem, 1.25rem)'
   */
  fluidType(config: FluidTypeConfig): MathResult {
    const {
      minSize,
      maxSize,
      minWidth = 320,
      maxWidth = 1280,
      unit = 'px',
      rootFontSize = 16,
    } = config;
    
    const slope = (maxSize - minSize) / (maxWidth - minWidth);
    const intercept = minSize - slope * minWidth;
    const slopeVw = Math.round(slope * 100 * 10000) / 10000;
    const interceptRounded = Math.round(intercept * 100) / 100;
    
    const minStr = unit === 'rem' ? `${minSize / rootFontSize}rem` : `${minSize}${unit}`;
    const maxStr = unit === 'rem' ? `${maxSize / rootFontSize}rem` : `${maxSize}${unit}`;
    const prefStr = `${slopeVw}vw + ${unit === 'rem' ? interceptRounded / rootFontSize + 'rem' : interceptRounded + unit}`;
    
    const expression = `clamp(${minStr}, ${prefStr}, ${maxStr})`;
    
    return createResult(
      0,
      'calc',
      expression,
      null,
      [`Fluid type: ${minSize}${unit} → ${maxSize}${unit} between ${minWidth}px and ${maxWidth}px`]
    );
  },

  /**
   * Scale a value by a factor with unit preservation.
   */
  scale(value: string | number, factor: number): MathResult {
    const parsed = parseCSSValue(value);
    const scaled = Math.round(parsed.value * factor * 100) / 100;
    
    return createResult(
      scaled,
      parsed.unit,
      `${scaled}${parsed.unit}`,
      { value: scaled, unit: parsed.unit },
      [`Scaled ${parsed.value}${parsed.unit} × ${factor} = ${scaled}${parsed.unit}`]
    );
  },

  /**
   * Clamp a CSS value between min and max.
   */
  clampValue(
    value: string | number,
    min: string | number,
    max: string | number,
    context?: MathContext
  ): MathResult {
    const parsed = parseCSSValue(value);
    const parsedMin = parseCSSValue(min);
    const parsedMax = parseCSSValue(max);
    
    // If all same unit, resolve directly
    if (parsed.unit === parsedMin.unit && parsed.unit === parsedMax.unit) {
      const clamped = Math.max(parsedMin.value, Math.min(parsedMax.value, parsed.value));
      return createResult(
        clamped,
        parsed.unit,
        `${clamped}${parsed.unit}`,
        { value: clamped, unit: parsed.unit },
        [`Clamped ${parsed.value} between ${parsedMin.value} and ${parsedMax.value}`]
      );
    }
    
    // Otherwise emit clamp()
    const valStr = `${parsed.value}${parsed.unit}`;
    const minStr = `${parsedMin.value}${parsedMin.unit}`;
    const maxStr = `${parsedMax.value}${parsedMax.unit}`;
    
    return createResult(
      0,
      'calc',
      `clamp(${minStr}, ${valStr}, ${maxStr})`,
      null,
      ['Mixed units — using clamp()']
    );
  },

  /**
   * Parse a CSS value into its numeric and unit parts.
   */
  parse(value: string | number): CSSMathValue {
    return parseCSSValue(value);
  },

  /**
   * Check if two values have compatible units for direct operations.
   */
  compatible(a: string | number, b: string | number): boolean {
    const valA = parseCSSValue(a);
    const valB = parseCSSValue(b);
    return valA.unit === valB.unit || getUnitCategory(valA.unit) === getUnitCategory(valB.unit);
  },

  /**
   * Get the category of a CSS unit.
   */
  unitCategory(unit: CSSUnit): string {
    return getUnitCategory(unit);
  },

  /**
   * Create a CSS min() expression.
   */
  cssMin(...values: (string | number)[]): string {
    const formatted = values.map(v => {
      const parsed = parseCSSValue(v);
      return `${parsed.value}${parsed.unit}`;
    });
    return `min(${formatted.join(', ')})`;
  },

  /**
   * Create a CSS max() expression.
   */
  cssMax(...values: (string | number)[]): string {
    const formatted = values.map(v => {
      const parsed = parseCSSValue(v);
      return `${parsed.value}${parsed.unit}`;
    });
    return `max(${formatted.join(', ')})`;
  },

  /**
   * Format a number with specified precision.
   */
  precision(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
  },
};

// ============================================================================
// Convenience exports (match helpers.ts pattern)
// ============================================================================

export const add = math.add.bind(math);
export const subtract = math.subtract.bind(math);
export const multiply = math.multiply.bind(math);
export const divide = math.divide.bind(math);
export const fluidType = math.fluidType.bind(math);
export const convert = math.convert.bind(math);
export const toPx = math.toPx.bind(math);
export const scale = math.scale.bind(math);

export default math;