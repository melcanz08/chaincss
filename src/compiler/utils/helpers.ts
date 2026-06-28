// src/compiler/utils/helpers.ts

// Types
export type Unit = 'px' | 'rem' | 'em' | '%' | 'vw' | 'vh' | 'vmin' | 'vmax' | 'ch' | 'ex';
export type MathOperation = 'add' | 'subtract' | 'multiply' | 'divide';

export interface CalcOptions {
  precision?: number;
  simplify?: boolean;
}

// Utility to parse and normalize values
function normalizeValue(value: any): string {
  if (value === null || value === undefined) return '0';
  if (typeof value === 'number') return `${value}px`;
  return String(value);
}

// Perform calculation with proper unit handling
function performCalculation(
  a: any, 
  b: any, 
  operation: MathOperation, 
  options: CalcOptions = {}
): string {
  const valA = normalizeValue(a);
  const valB = normalizeValue(b);
  
  let result: string;
  
  switch (operation) {
    case 'add':
      result = `calc(${valA} + ${valB})`;
      break;
    case 'subtract':
      result = `calc(${valA} - ${valB})`;
      break;
    case 'multiply':
      result = `calc(${valA} * ${valB})`;
      break;
    case 'divide':
      result = `calc(${valA} / ${valB})`;
      break;
    default:
      result = `calc(${valA} ${operation} ${valB})`;
  }
  
  if (options.simplify) {
    result = simplifyCalc(result);
  }
  
  return result;
}

// Simplify calc expressions when possible
function simplifyCalc(calcExpr: string): string {
  // Remove unnecessary calc wrappers
  if (calcExpr.startsWith('calc(') && calcExpr.endsWith(')')) {
    const inner = calcExpr.slice(5, -1);
    // If the inner doesn't contain operations, unwrap it
    if (!inner.includes('+') && !inner.includes('-') && !inner.includes('*') && !inner.includes('/')) {
      return inner.trim();
    }
  }
  return calcExpr;
}

// Create a calc expression with proper formatting
function createCalc(expr: string, options: CalcOptions = {}): string {
  let result = `calc(${expr})`;
  if (options.simplify) {
    result = simplifyCalc(result);
  }
  return result;
}

// Math helpers for CSS calc() expressions
export const helpers = {
  // Basic calc
  calc: (expr: string, options?: CalcOptions) => createCalc(expr, options),
  
  // Arithmetic operations
  add: (a: any, b: any, options?: CalcOptions) => 
    performCalculation(a, b, 'add', options),
  subtract: (a: any, b: any, options?: CalcOptions) => 
    performCalculation(a, b, 'subtract', options),
  sub: (a: any, b: any, options?: CalcOptions) => 
    performCalculation(a, b, 'subtract', options),
  multiply: (a: any, b: any, options?: CalcOptions) => 
    performCalculation(a, b, 'multiply', options),
  mul: (a: any, b: any, options?: CalcOptions) => 
    performCalculation(a, b, 'multiply', options),
  divide: (a: any, b: any, options?: CalcOptions) => 
    performCalculation(a, b, 'divide', options),
  div: (a: any, b: any, options?: CalcOptions) => 
    performCalculation(a, b, 'divide', options),
  
  // Complex operations
  sum: (...values: any[]) => {
    const expr = values.map(v => normalizeValue(v)).join(' + ');
    return createCalc(expr);
  },
  
  difference: (a: any, ...rest: any[]) => {
    const expr = [a, ...rest].map(v => normalizeValue(v)).join(' - ');
    return createCalc(expr);
  },
  
  product: (...values: any[]) => {
    const expr = values.map(v => normalizeValue(v)).join(' * ');
    return createCalc(expr);
  },
  
  quotient: (a: any, ...rest: any[]) => {
    const expr = [a, ...rest].map(v => normalizeValue(v)).join(' / ');
    return createCalc(expr);
  },
  
  // Unit helpers with conversion
  mpx: (value: number | string): string => {
    if (typeof value === 'number') return `${value}px`;
    // If it's already a string with a unit, just return it
    if (/^\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh)$/.test(value)) return value;
    // If it's a number string, add px
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}px`;
    return value;
  },
  
  rem: (value: number | string, base: number = 16): string => {
    if (typeof value === 'number') return `${value}rem`;
    if (/^\d+(?:\.\d+)?rem$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?px$/.test(value)) {
      const px = parseFloat(value);
      return `${px / base}rem`;
    }
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}rem`;
    return value;
  },
  
  em: (value: number | string, context: number = 16): string => {
    if (typeof value === 'number') return `${value}em`;
    if (/^\d+(?:\.\d+)?em$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?px$/.test(value)) {
      const px = parseFloat(value);
      return `${px / context}em`;
    }
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}em`;
    return value;
  },
  
  percent: (value: number | string): string => {
    if (typeof value === 'number') return `${value}%`;
    if (/^\d+(?:\.\d+)?%$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}%`;
    return value;
  },
  
  vw: (value: number | string): string => {
    if (typeof value === 'number') return `${value}vw`;
    if (/^\d+(?:\.\d+)?vw$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}vw`;
    return value;
  },
  
  vh: (value: number | string): string => {
    if (typeof value === 'number') return `${value}vh`;
    if (/^\d+(?:\.\d+)?vh$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}vh`;
    return value;
  },
  
  vmin: (value: number | string): string => {
    if (typeof value === 'number') return `${value}vmin`;
    if (/^\d+(?:\.\d+)?vmin$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}vmin`;
    return value;
  },
  
  vmax: (value: number | string): string => {
    if (typeof value === 'number') return `${value}vmax`;
    if (/^\d+(?:\.\d+)?vmax$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}vmax`;
    return value;
  },
  
  ch: (value: number | string): string => {
    if (typeof value === 'number') return `${value}ch`;
    if (/^\d+(?:\.\d+)?ch$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}ch`;
    return value;
  },
  
  ex: (value: number | string): string => {
    if (typeof value === 'number') return `${value}ex`;
    if (/^\d+(?:\.\d+)?ex$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}ex`;
    return value;
  },
  
  // Convert between units
  convert: (value: string | number, fromUnit: Unit, toUnit: Unit, context: number = 16): string => {
    let numericValue: number;
    
    if (typeof value === 'number') {
      numericValue = value;
    } else {
      numericValue = parseFloat(value);
    }
    
    // Convert to pixels first (base unit)
    let inPx: number;
    switch (fromUnit) {
      case 'px':
        inPx = numericValue;
        break;
      case 'rem':
        inPx = numericValue * context;
        break;
      case 'em':
        inPx = numericValue * context;
        break;
      case '%':
        inPx = (numericValue / 100) * context;
        break;
      case 'vw':
        inPx = (numericValue / 100) * 1920; // Assume 1920px viewport
        break;
      case 'vh':
        inPx = (numericValue / 100) * 1080; // Assume 1080px viewport
        break;
      default:
        inPx = numericValue;
    }
    
    // Convert from pixels to target unit
    let result: number;
    switch (toUnit) {
      case 'px':
        result = inPx;
        break;
      case 'rem':
        result = inPx / context;
        break;
      case 'em':
        result = inPx / context;
        break;
      case '%':
        result = (inPx / context) * 100;
        break;
      case 'vw':
        result = (inPx / 1920) * 100;
        break;
      case 'vh':
        result = (inPx / 1080) * 100;
        break;
      default:
        result = inPx;
    }
    
    // Format result
    if (Math.abs(result - Math.round(result)) < 0.01) {
      return `${Math.round(result)}${toUnit}`;
    }
    return `${result.toFixed(2)}${toUnit}`;
  },
  
  // Min/Max/Clamp with better formatting
  min: (...values: any[]) => {
    const formatted = values.map(v => normalizeValue(v)).join(', ');
    return `min(${formatted})`;
  },
  
  max: (...values: any[]) => {
    const formatted = values.map(v => normalizeValue(v)).join(', ');
    return `max(${formatted})`;
  },
  
  clamp: (min: any, preferred: any, max: any, options?: CalcOptions) => {
    const minVal = normalizeValue(min);
    const prefVal = normalizeValue(preferred);
    const maxVal = normalizeValue(max);
    let result = `clamp(${minVal}, ${prefVal}, ${maxVal})`;
    if (options?.simplify) {
      result = simplifyCalc(result);
    }
    return result;
  },
  
  // Rounding helpers
  round: (value: number | string, precision: number = 2): string => {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return num.toFixed(precision);
  },
  
  ceil: (value: number | string): string => {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Math.ceil(num).toString();
  },
  
  floor: (value: number | string): string => {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Math.floor(num).toString();
  },
  
  // Color helpers (returns CSS color values)
  rgba: (r: number, g: number, b: number, a: number = 1): string => {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },
  
  hsla: (h: number, s: number, l: number, a: number = 1): string => {
    return `hsla(${h}, ${s}%, ${l}%, ${a})`;
  },
  
  // String helpers
  url: (path: string): string => {
    return `url(${path})`;
  },
  
  format: (strings: TemplateStringsArray, ...values: any[]): string => {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
      result += strings[i];
      if (i < values.length) {
        result += normalizeValue(values[i]);
      }
    }
    return result;
  },
  
  // Conditional helpers
  if: (condition: boolean, trueValue: any, falseValue: any): any => {
    return condition ? trueValue : falseValue;
  },
  
  // String manipulation
  camelToKebab: (str: string): string => {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  },
  
  kebabToCamel: (str: string): string => {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  },

  toPx: (value: number | string): string => {
    if (typeof value === 'number') return `${value}px`;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}px`;
    return value;
  },
  
  toRem: (value: number | string, base: number = 16): string => {
    if (typeof value === 'number') return `${value / base}rem`;
    if (/^\d+(?:\.\d+)?px$/.test(value)) {
      const px = parseFloat(value);
      return `${px / base}rem`;
    }
    if (/^\d+(?:\.\d+)?$/.test(value)) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      return `${numValue / base}rem`;
    }
    return value;
  },

};

// Type for math helper functions
export type MathHelpers = typeof helpers;

// Helper function to create a value with unit
export function withUnit(value: number | string, unit: Unit): string {
  if (typeof value === 'string' && /^\d+(?:\.\d+)?[a-z%]+$/.test(value)) {
    return value; // Already has a unit
  }
  const num = typeof value === 'number' ? value : parseFloat(value);
  return `${num}${unit}`;
}

// Helper to extract numeric value from a CSS value
export function extractNumeric(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

// Helper to extract unit from a CSS value
export function extractUnit(value: string): Unit | null {
  const match = value.match(/[a-z%]+$/);
  return match ? (match[0] as Unit) : null;
}

// Create a fluid typography formula
export function fluidType(
  minSize: number,
  maxSize: number,
  minWidth: number = 320,
  maxWidth: number = 1280,
  unit: 'px' | 'rem' = 'px'
): string {
  const slope = (maxSize - minSize) / (maxWidth - minWidth);
  const intercept = minSize - slope * minWidth;
  
  const slopeVw = slope * 100;
  const result = `clamp(${minSize}${unit}, ${slopeVw.toFixed(2)}vw + ${intercept.toFixed(2)}${unit}, ${maxSize}${unit})`;
  
  return result;
}

// Export default helpers
export default helpers;export const toPx = (v: number | string) => typeof v === "number" ? `${v}px` : v;
export const toRem = (v: number | string) => typeof v === "number" ? `${v/16}rem` : v;
