// ============================================================================
// FILE: src/compiler/math-engine.ts 
// ============================================================================

import type { 
  CSSUnit, 
  CSSMathValue, 
  MathContext, 
  MathResult, 
  FluidTypeConfig 
} from '@shared/types/index.js';

export type { CSSUnit, CSSMathValue, MathContext, MathResult, FluidTypeConfig };
export type MathOp = 'add' | 'subtract' | 'multiply' | 'divide';

// Internal extended type to handle unitless and expression at runtime
type InternalMathValue = CSSMathValue & { 
  expression?: string; 
  unit: CSSUnit | '' | 'expression' | string;
  isUnitless?: boolean;
};

const DEFAULT_CONTEXT: Required<MathContext> = Object.freeze({
  rootFontSize: 16,
  viewportWidth: 1920,
  viewportHeight: 1080,
  parentFontSize: 16,
  dpi: 96,
  elementWidth: 1920,
  elementHeight: 1080,
} as Required<MathContext>);

const UNIT_CATEGORIES: Record<string, CSSUnit[]> = {
  absolute: ['px', 'cm', 'mm', 'in', 'pt', 'pc'],
  relative: ['rem', 'em', 'ch', 'ex'],
  viewport: ['vw', 'vh', 'vmin', 'vmax'],
  angle: ['deg', 'rad', 'turn', 'grad'],
  time: ['s', 'ms'],
  resolution: ['dpi', 'dpcm', 'dppx'],
};

const UNIT_LOOKUP: Record<string, string> = {};
for (const [category, units] of Object.entries(UNIT_CATEGORIES)) {
  for (const unit of units) UNIT_LOOKUP[unit] = category;
}

const SIMPLE_NUMERIC_REGEX = /^(-?(?:\d+(?:\.\d+)?|\.\d+))\s*([a-zA-Z%]*)$/;
const CALC_PREFIX_REGEX = /^calc\(/i;

// Helpers to work around strict CSSUnit type
function isUnitless(v: InternalMathValue): boolean { return !!v.isUnitless; }
function isExpressionUnit(v: InternalMathValue): boolean { return (v.unit as string) === 'expression' || !!(v as any).expression; }
function getExpression(v: InternalMathValue): string { return (v as any).expression || ''; }
function asCSSUnit(u: string): CSSUnit { return u as unknown as CSSUnit; }

function parseCSSValue(input: string | number): InternalMathValue {
  if (typeof input === 'number') {
    return { value: input, unit: 'px' as any, isUnitless: true } as InternalMathValue;
  }
  const trimmed = input.trim();
  const match = trimmed.match(SIMPLE_NUMERIC_REGEX);
  if (match) {
    const unitStr = match[2].toLowerCase();
    return {
      value: parseFloat(match[1]),
      unit: (unitStr || 'px') as any,
      isUnitless: !unitStr,
    } as InternalMathValue;
  }
  return {
    value: 0,
    unit: 'expression' as any,
    expression: trimmed,
  } as InternalMathValue;
}

function getUnitCategory(unit: string): string {
  if (!unit) return 'unitless';
  return UNIT_LOOKUP[unit] || 'unknown';
}

function formatValue(value: InternalMathValue): string {
  if (isExpressionUnit(value)) return getExpression(value);
  return `${value.value}${value.unit}`;
}

function stripCalc(expr: string): string {
  const trimmed = expr.trim();
  if (CALC_PREFIX_REGEX.test(trimmed) && trimmed.endsWith(')')) {
    return trimmed.slice(5, -1).trim();
  }
  return trimmed;
}

function resolveToInternalBase(value: InternalMathValue, context: Required<MathContext>): { value: number; unit: string } {
  const { value: v } = value;
  const unit = value.unit as string;
  const cat = getUnitCategory(unit);
  if (cat === 'absolute') {
    switch (unit) {
      case 'px': return { value: v, unit: 'px' };
      case 'in': return { value: v * 96, unit: 'px' };
      case 'cm': return { value: v * (96 / 2.54), unit: 'px' };
      case 'mm': return { value: v * (96 / 25.4), unit: 'px' };
      case 'pt': return { value: v * (96 / 72), unit: 'px' };
      case 'pc': return { value: v * 16, unit: 'px' };
    }
  }
  if (cat === 'relative') {
    switch (unit) {
      case 'rem': return { value: v * context.rootFontSize, unit: 'px' };
      case 'em': return { value: v * context.parentFontSize, unit: 'px' };
      case 'ch': return { value: v * (context.parentFontSize * 0.5), unit: 'px' };
      case 'ex': return { value: v * (context.parentFontSize * 0.45), unit: 'px' };
    }
  }
  if (cat === 'viewport') {
    switch (unit) {
      case 'vw': return { value: (v * context.viewportWidth) / 100, unit: 'px' };
      case 'vh': return { value: (v * context.viewportHeight) / 100, unit: 'px' };
      case 'vmin': return { value: (v * Math.min(context.viewportWidth, context.viewportHeight)) / 100, unit: 'px' };
      case 'vmax': return { value: (v * Math.max(context.viewportWidth, context.viewportHeight)) / 100, unit: 'px' };
    }
  }
  if (cat === 'angle') {
    switch (unit) {
      case 'deg': return { value: v, unit: 'deg' };
      case 'rad': return { value: v * (180 / Math.PI), unit: 'deg' };
      case 'turn': return { value: v * 360, unit: 'deg' };
      case 'grad': return { value: v * 0.9, unit: 'deg' };
    }
  }
  if (cat === 'time') {
    switch (unit) {
      case 'ms': return { value: v, unit: 'ms' };
      case 's': return { value: v * 1000, unit: 'ms' };
    }
  }
  return { value: v, unit };
}

function convertFromInternalBase(v: number, fromBase: string, targetUnit: CSSUnit, context: Required<MathContext>): number {
  const target = targetUnit as string;
  if (fromBase === 'px') {
    switch (target) {
      case 'px': return v;
      case 'in': return v / 96;
      case 'cm': return v / (96 / 2.54);
      case 'mm': return v / (96 / 25.4);
      case 'pt': return v / (96 / 72);
      case 'pc': return v / 16;
      case 'rem': return v / context.rootFontSize;
      case 'em': return v / context.parentFontSize;
      case 'ch': return v / (context.parentFontSize * 0.5);
      case 'ex': return v / (context.parentFontSize * 0.45);
      case 'vw': return (v * 100) / context.viewportWidth;
      case 'vh': return (v * 100) / context.viewportHeight;
      case 'vmin': return (v * 100) / Math.min(context.viewportWidth, context.viewportHeight);
      case 'vmax': return (v * 100) / Math.max(context.viewportWidth, context.viewportHeight);
    }
  }
  if (fromBase === 'deg') {
    switch (target) {
      case 'deg': return v;
      case 'rad': return v * (Math.PI / 180);
      case 'turn': return v / 360;
      case 'grad': return v / 0.9;
    }
  }
  if (fromBase === 'ms') {
    switch (target) {
      case 'ms': return v;
      case 's': return v / 1000;
    }
  }
  return v;
}

function canResolve(a: InternalMathValue, b: InternalMathValue, context: Required<MathContext>): boolean {
  if (isExpressionUnit(a) || isExpressionUnit(b)) return false;
  
  // Statically resolve absolute/relative values (even if one is unitless and defaults to px)
  const catA = getUnitCategory(a.unit as string);
  const catB = getUnitCategory(b.unit as string);
  if (catA === 'unknown' || catB === 'unknown') return false;
  
  // Viewport units are dynamic and must compile to runtime expressions unless both sides share the exact same unit
  const isDynamicA = catA === 'viewport' || (a.unit as string) === '%';
  const isDynamicB = catB === 'viewport' || (b.unit as string) === '%';
  if (isDynamicA || isDynamicB) return (a.unit as string) === (b.unit as string);
  
  if ((catA === 'absolute' || catA === 'relative' || isUnitless(a)) && 
      (catB === 'absolute' || catB === 'relative' || isUnitless(b))) {
    return true;
  }
  return catA === catB;
}

function createResult(
  value: number, 
  unit: CSSUnit | 'calc' | 'mixed' | '' | string, 
  expression: string, 
  resolved: InternalMathValue | null,
  explanations: string[] = []
): MathResult {
  return {
    value,
    unit: unit as any,
    expression,
    resolved: resolved as any,
    explanations,
    toString(): string { return this.expression; },
    toCalc(): string { return (unit as string) === 'calc' ? expression : `calc(${expression})`; },
  } as MathResult;
}

function getOpSymbol(op: MathOp): string {
  switch (op) {
    case 'add': return '+';
    case 'subtract': return '-';
    case 'multiply': return '*';
    case 'divide': return '/';
  }
}

function createDynamicFallback(valA: InternalMathValue, op: MathOp, valB: InternalMathValue, explanations: string[]): MathResult {
  const cleanA = stripCalc(formatValue(valA));
  const cleanB = stripCalc(formatValue(valB));
  const expr = `calc(${cleanA} ${getOpSymbol(op)} ${cleanB})`;
  explanations.push(`Cannot resolve statically — generated safe runtime expression`);
  return createResult(0, 'calc', expr, null, explanations);
}

function operate(a: string | number, op: MathOp, b: string | number, context?: MathContext): MathResult {
  const ctx: Required<MathContext> = context ? { ...DEFAULT_CONTEXT, ...context } : DEFAULT_CONTEXT;
  const valA = parseCSSValue(a);
  const valB = parseCSSValue(b);
  const explanations: string[] = [];
  const isExprA = isExpressionUnit(valA);
  const isExprB = isExpressionUnit(valB);

  // Direct computation if identical units and both are not unitless
  if ((valA.unit as string) === (valB.unit as string) && !isExprA && !isExprB && !isUnitless(valA) && !isUnitless(valB)) {
    let result: number;
    let resultUnit = valA.unit as string;
    switch (op) {
      case 'add': result = valA.value + valB.value; break;
      case 'subtract': result = valA.value - valB.value; break;
      case 'multiply': 
        result = valA.value * valB.value; 
        explanations.push(`Warning: Direct multiplication of dimensions (${valA.unit}) results in physical area units. Forcing dynamic calc.`);
        return createDynamicFallback(valA, op, valB, explanations);
      case 'divide': 
        result = valA.value / valB.value; 
        resultUnit = '';
        break;
    }
    const rounded = Math.round(result! * 1000) / 1000;
    explanations.push(`Same unit (${valA.unit || 'unitless'}) — direct ${op}`);
    return createResult(rounded, resultUnit, `${rounded}${resultUnit}`, { value: rounded, unit: resultUnit as any } as any, explanations);
  }

  const unitAEmpty = isUnitless(valA);
  const unitBEmpty = isUnitless(valB);
  const isScalarMult = op === 'multiply' && ((!unitAEmpty && unitBEmpty) || (unitAEmpty && !unitBEmpty));
  const isScalarDiv = op === 'divide' && (!unitAEmpty && unitBEmpty);

  if ((isScalarMult || isScalarDiv) && !isExprA && !isExprB) {
    const dimension = !unitAEmpty ? valA : valB;
    const scalar = unitAEmpty ? valA : valB;
    const resultVal = op === 'multiply' ? dimension.value * scalar.value : valA.value / valB.value;
    const rounded = Math.round(resultVal * 1000) / 1000;
    explanations.push(`Scalar ${op}: ${dimension.value}${dimension.unit} with multiplier ${scalar.value}`);
    return createResult(rounded, dimension.unit as string, `${rounded}${dimension.unit}`, { value: rounded, unit: dimension.unit as any } as any, explanations);
  }
  
  if (canResolve(valA, valB, ctx)) {
    const resA = resolveToInternalBase(valA, ctx);
    const resB = resolveToInternalBase(valB, ctx);
    let resultVal: number;
    switch (op) {
      case 'add': resultVal = resA.value + resB.value; break;
      case 'subtract': resultVal = resA.value - resB.value; break;
      case 'multiply': resultVal = resA.value * resB.value; break;
      case 'divide': resultVal = resA.value / resB.value; break;
    }
    
    const targetUnit = ((valA.unit as string) === 'px' || (valB.unit as string) === 'px' || isUnitless(valA) || isUnitless(valB)) 
      ? 'px' 
      : ((valA.unit as string) || (valB.unit as string));

    const converted = convertFromInternalBase(resultVal, resA.unit, asCSSUnit(targetUnit), ctx);
    const rounded = Math.round(converted * 1000) / 1000;
    explanations.push(`Statically resolved ${valA.value}${valA.unit} ${op} ${valB.value}${valB.unit} to target unit ${targetUnit}`);
    return createResult(rounded, targetUnit, `${rounded}${targetUnit}`, { value: rounded, unit: asCSSUnit(targetUnit) } as any, explanations);
  }
  
  return createDynamicFallback(valA, op, valB, explanations);
}

export const math = {
  add(a: string | number, b: string | number, context?: MathContext): MathResult { return operate(a, 'add', b, context); },
  subtract(a: string | number, b: string | number, context?: MathContext): MathResult { return operate(a, 'subtract', b, context); },
  multiply(a: string | number, b: string | number, context?: MathContext): MathResult { return operate(a, 'multiply', b, context); },
  divide(a: string | number, b: string | number, context?: MathContext): MathResult { return operate(a, 'divide', b, context); },

  sum(...values: (string | number)[]): MathResult {
    if (values.length === 0) return createResult(0, 'px', '0px', { value: 0, unit: 'px' as any } as any);
    if (values.length === 1) {
      const parsed = parseCSSValue(values[0]);
      return createResult(parsed.value, parsed.unit as string, formatValue(parsed), parsed);
    }
    let staticPxTotal = 0;
    let hasStatic = false;
    const bucketTotals: Record<string, number> = {};
    const complexParts: string[] = [];
    const ctx = DEFAULT_CONTEXT;

    for (const val of values) {
      const parsed = parseCSSValue(val);
      if (isExpressionUnit(parsed)) { complexParts.push(stripCalc(getExpression(parsed))); continue; }
      const cat = getUnitCategory(parsed.unit as string);
      if (cat === 'absolute' || cat === 'relative' || cat === 'viewport') {
        const resolved = resolveToInternalBase(parsed, ctx);
        staticPxTotal += resolved.value;
        hasStatic = true;
      } else {
        const u = (parsed.unit as string) || 'unitless';
        bucketTotals[u] = (bucketTotals[u] || 0) + parsed.value;
      }
    }

    const parts: string[] = [];
    if (hasStatic) {
      const roundedPx = Math.round(staticPxTotal * 1000) / 1000;
      if (roundedPx !== 0 || (Object.keys(bucketTotals).length === 0 && complexParts.length === 0)) parts.push(`${roundedPx}px`);
    }
    for (const [unit, total] of Object.entries(bucketTotals)) {
      const rounded = Math.round(total * 1000) / 1000;
      if (rounded !== 0) parts.push(`${rounded}${unit}`);
    }
    parts.push(...complexParts);

    if (parts.length === 1) {
      const parsedSingle = parseCSSValue(parts[0]);
      return createResult(parsedSingle.value, parsedSingle.unit as string, parts[0], parsedSingle, ['Direct folded sum']);
    }
    if (parts.length === 0) return createResult(0, 'px', '0px', { value: 0, unit: 'px' as any } as any);
    return createResult(0, 'calc', `calc(${parts.join(' + ')})`, null, ['Dynamic folded expression']);
  },

  toPx(value: string | number, context?: MathContext): number {
    const ctx: Required<MathContext> = context ? { ...DEFAULT_CONTEXT, ...context } : DEFAULT_CONTEXT;
    const parsed = parseCSSValue(value);
    if (isExpressionUnit(parsed)) return 0;
    return resolveToInternalBase(parsed, ctx).value;
  },

  toRem(value: string | number, context?: MathContext): MathResult {
  return this.convert(value, 'rem' as CSSUnit, context);
  },
  toEm(value: string | number, context?: MathContext): MathResult {
    return this.convert(value, 'em' as CSSUnit, context);
  },

  convert(value: string | number, toUnit: CSSUnit, context?: MathContext): MathResult {
    const ctx: Required<MathContext> = context ? { ...DEFAULT_CONTEXT, ...context } : DEFAULT_CONTEXT;
    const parsed = parseCSSValue(value);
    if (isExpressionUnit(parsed)) {
      return createResult(0, 'calc', `calc(${getExpression(parsed)})`, null, ['Conversion bypassed for expression']);
    }
    const internal = resolveToInternalBase(parsed, ctx);
    const converted = convertFromInternalBase(internal.value, internal.unit, toUnit, ctx);
    const rounded = Math.round(converted * 1000) / 1000;
    return createResult(rounded, toUnit, `${rounded}${toUnit}`, { value: rounded, unit: toUnit } as any, [`${parsed.value}${parsed.unit} → ${rounded}${toUnit}`]);
  },

  fluidType(config: FluidTypeConfig): MathResult {
    const { minSize, maxSize, minWidth = 320, maxWidth = 1280, unit = 'px', rootFontSize = 16 } = config;
    const slope = (maxSize - minSize) / (maxWidth - minWidth);
    const intercept = minSize - slope * minWidth;
    const slopeVw = Math.round(slope * 100 * 10000) / 10000;
    let interceptVal = intercept;
    let unitStr = unit;
    if (unit === 'rem') interceptVal = intercept / rootFontSize;
    const interceptRounded = Math.round(interceptVal * 1000) / 1000;
    const minStr = unit === 'rem' ? `${minSize / rootFontSize}rem` : `${minSize}${unit}`;
    const maxStr = unit === 'rem' ? `${maxSize / rootFontSize}rem` : `${maxSize}${unit}`;
    const sign = interceptRounded >= 0 ? '+' : '-';
    const absIntercept = Math.abs(interceptRounded);
    const prefStr = `${slopeVw}vw ${sign} ${absIntercept}${unitStr}`;
    const expression = `clamp(${minStr}, ${prefStr}, ${maxStr})`;
    return createResult(0, 'calc', expression, null, [`Fluid range: ${minSize}${unit} to ${maxSize}${unit}`]);
  },

  scale(value: string | number, factor: number): MathResult {
    const parsed = parseCSSValue(value);
    if (isExpressionUnit(parsed)) {
      return createResult(0, 'calc', `calc(${getExpression(parsed)} * ${factor})`, null, ['Expression scaled dynamically']);
    }
    const scaled = Math.round(parsed.value * factor * 1000) / 1000;
    return createResult(scaled, parsed.unit as string, `${scaled}${parsed.unit}`, { value: scaled, unit: parsed.unit as any } as any, [`Scaled ${parsed.value}${parsed.unit} by ${factor}`]);
  },

  clampValue(value: string | number, min: string | number, max: string | number, context?: MathContext): MathResult {
    const ctx: Required<MathContext> = context ? { ...DEFAULT_CONTEXT, ...context } : DEFAULT_CONTEXT;
    const parsedVal = parseCSSValue(value);
    const parsedMin = parseCSSValue(min);
    const parsedMax = parseCSSValue(max);
    const canResolveAll = 
      ((parsedVal.unit as string) === (parsedMin.unit as string) && (parsedVal.unit as string) === (parsedMax.unit as string) && !isExpressionUnit(parsedVal)) ||
      (canResolve(parsedVal, parsedMin, ctx) && canResolve(parsedVal, parsedMax, ctx));
    if (canResolveAll) {
      const resVal = resolveToInternalBase(parsedVal, ctx);
      const resMin = resolveToInternalBase(parsedMin, ctx);
      const resMax = resolveToInternalBase(parsedMax, ctx);
      const clampedInternal = Math.max(resMin.value, Math.min(resMax.value, resVal.value));
      const targetUnitStr = (parsedVal.unit as string) !== 'px' && !isUnitless(parsedVal) ? (parsedVal.unit as string) : 'px';
      const converted = convertFromInternalBase(clampedInternal, resVal.unit, asCSSUnit(targetUnitStr), ctx);
      const rounded = Math.round(converted * 1000) / 1000;
      return createResult(rounded, targetUnitStr, `${rounded}${targetUnitStr}`, { value: rounded, unit: asCSSUnit(targetUnitStr) } as any, [`Statically clamped to ${rounded}${targetUnitStr}`]);
    }
    const valStr = stripCalc(formatValue(parsedVal));
    const minStr = stripCalc(formatValue(parsedMin));
    const maxStr = stripCalc(formatValue(parsedMax));
    return createResult(0, 'calc', `clamp(${minStr}, ${valStr}, ${maxStr})`, null, ['Dynamic clamp emitted due to mixed/dynamic units']);
  },

  parse(value: string | number): CSSMathValue { 
    const parsed = parseCSSValue(value);
    // Return standard CSSMathValue interface elements strictly (strips internal flags like isUnitless)
    return {
      value: parsed.value,
      unit: parsed.unit as CSSUnit
    };
  },
  compatible(a: string | number, b: string | number): boolean {
    const valA = parseCSSValue(a);
    const valB = parseCSSValue(b);
    if (isExpressionUnit(valA) || isExpressionUnit(valB)) return false;
    return (valA.unit as string) === (valB.unit as string) || getUnitCategory(valA.unit as string) === getUnitCategory(valB.unit as string);
  },
  unitCategory(unit: CSSUnit): string { return getUnitCategory(unit as string); },
  cssMin(...values: (string | number)[]): string {
    const formatted = values.map(v => stripCalc(formatValue(parseCSSValue(v))));
    return `min(${formatted.join(', ')})`;
  },
  cssMax(...values: (string | number)[]): string {
    const formatted = values.map(v => stripCalc(formatValue(parseCSSValue(v))));
    return `max(${formatted.join(', ')})`;
  },
  precision(value: number, decimals: number = 2): string { return value.toFixed(decimals); },
};

export const add = math.add.bind(math);
export const subtract = math.subtract.bind(math);
export const multiply = math.multiply.bind(math);
export const divide = math.divide.bind(math);
export const fluidType = math.fluidType.bind(math);
export const convert = math.convert.bind(math);
export const toPx = math.toPx.bind(math);
export const scale = math.scale.bind(math);

export default math;