// src/compiler/breakpoints.ts

import { math } from './math-engine.js';

export interface BreakpointConfig { name: string; minWidth?: number; maxWidth?: number; query: string; priority?: number; }
export type BreakpointsMap = Record<string, string>;
export type BreakpointValues = Record<string, number>;

const DEFAULT_BREAKPOINTS = {
  sm: '(min-width: 640px)', md: '(min-width: 768px)', lg: '(min-width: 1024px)', xl: '(min-width: 1280px)', '2xl': '(min-width: 1536px)',
  mobile: '(max-width: 767px)', tablet: '(min-width: 768px) and (max-width: 1023px)', desktop: '(min-width: 1024px)',
  'mobile-sm': '(max-width: 375px)', 'mobile-md': '(min-width: 376px) and (max-width: 767px)',
  'tablet-sm': '(min-width: 768px) and (max-width: 834px)', 'tablet-lg': '(min-width: 835px) and (max-width: 1024px)',
  'desktop-sm': '(min-width: 1025px) and (max-width: 1280px)', 'desktop-md': '(min-width: 1281px) and (max-width: 1440px)', 'desktop-lg': '(min-width: 1441px)',
  portrait: '(orientation: portrait)', landscape: '(orientation: landscape)',
  dark: '(prefers-color-scheme: dark)', light: '(prefers-color-scheme: light)',
  reducedMotion: '(prefers-reduced-motion: reduce)', highContrast: '(prefers-contrast: high)',
  print: 'print', hover: '(hover: hover)', 'no-hover': '(hover: none)', fine: '(pointer: fine)', coarse: '(pointer: coarse)',
} as const satisfies BreakpointsMap;

let _current: BreakpointsMap = {...DEFAULT_BREAKPOINTS };
let _values: BreakpointValues = {};
let _sortedCache: Array<{ name: string; query: string; minWidth: number; maxWidth: number }> | null = null;

// --- NOW POWERED BY math-engine ---
function toPx(n: number, unit: string): number {
  // math handles rem/em/px with rootFontSize 16, plus vw/vh if needed
  try {
    return math.toPx(`${n}${unit || 'px'}`);
  } catch {
    return n;
  }
}

function parseQueryRange(query: string): { min: number; max: number } {
  let min = 0, max = Infinity;
  const re = /(?:\(?\s*(?:min-width|width)\s*(?:>=|:)\s*(\d+(?:\.\d+)?)(px|rem|em)?\s*\)?)|(?:\(?\s*(\d+(?:\.\d+)?)(px|rem|em)\s*<=\s*width)/gi;
  const reMax = /(?:\(?\s*(?:max-width|width)\s*(?:<=|:)\s*(\d+(?:\.\d+)?)(px|rem|em)?\s*\)?)|(?:width\s*<=\s*(\d+(?:\.\d+)?)(px|rem|em)\s*\)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query))!== null) {
    const val = parseFloat(m[1] || m[3]); const unit = m[2] || m[4] || 'px';
    if (!isNaN(val)) min = Math.max(min, toPx(val, unit));
  }
  while ((m = reMax.exec(query))!== null) {
    const val = parseFloat(m[1] || m[3]); const unit = m[2] || m[4] || 'px';
    if (!isNaN(val)) max = Math.min(max, toPx(val, unit));
  }
  return { min, max };
}

function rebuild(): void {
  const vals: BreakpointValues = {};
  const sorted: Array<{ name: string; query: string; minWidth: number; maxWidth: number }> = [];
  for (const [name, query] of Object.entries(_current)) {
    const { min, max } = parseQueryRange(query);
    if (min > 0) vals[name] = min;
    sorted.push({ name, query, minWidth: min, maxWidth: max });
  }
  sorted.sort((a, b) => a.minWidth - b.minWidth || a.maxWidth - b.maxWidth);
  _values = vals;
  _sortedCache = sorted;
}
rebuild();

export function getAllBreakpoints(): BreakpointsMap { return {..._current }; }
export function getBreakpoint(name: string): string | undefined { return _current[name]; }
export function hasBreakpoint(name: string): boolean { return name in _current; }
export function getBreakpointNames(): string[] { return Object.keys(_current); }
export function getBreakpointValue(name: string): number | undefined { return _values[name]; }
export function getBreakpointRange(name: string): { min: number; max: number } | null {
  const q = _current[name]; if (!q) return null; return parseQueryRange(q);
}
export function getSortedBreakpoints() { return _sortedCache? [..._sortedCache] : []; }
export function getBreakpointForWidth(width: number): string | null {
  const sorted = _sortedCache || [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const bp = sorted[i];
    if (width >= bp.minWidth && width <= bp.maxWidth) return bp.name;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const bp = sorted[i];
    if (bp.minWidth === 0 && width <= bp.maxWidth) return bp.name;
  }
  return null;
}

export function setBreakpoints(breakpoints: Partial<BreakpointsMap>): void {
  _current = {...DEFAULT_BREAKPOINTS,...breakpoints } as BreakpointsMap;
  rebuild();
}
export function resetBreakpoints(): void { _current = {...DEFAULT_BREAKPOINTS }; rebuild(); }
export function addBreakpoint(name: string, query: string): void { _current[name] = query; rebuild(); }
export function removeBreakpoint(name: string): boolean {
  if (!(name in _current)) return false;
  delete _current[name]; rebuild(); return true;
}

export const currentBreakpoints: BreakpointsMap = _current;
export const breakpointValues: BreakpointValues = _values;

import { kebabCase as kebabCaseUtil } from "../shared/utils/index.js";
const toKebab = (s: string) => {
  try { return kebabCaseUtil(s); } catch { return s.replace(/([A-Z])/g, '-$1').toLowerCase(); }
};

export function createMediaQuery(min?: number | string, max?: number | string, unit: 'px' | 'rem' | 'em' = 'px'): string {
  const conds: string[] = [];
  if (min!== undefined) conds.push(`(min-width: ${typeof min === 'number'? `${min}${unit}` : min})`);
  if (max!== undefined) conds.push(`(max-width: ${typeof max === 'number'? `${max}${unit}` : max})`);
  return conds.join(' and ');
}

export interface ResponsiveStyle<T = any> { base?: T; sm?: T; md?: T; lg?: T; xl?: T; '2xl'?: T; [key: string]: T | undefined; }

export function generateResponsiveCSS(selector: string, styles: ResponsiveStyle<Record<string, any>>): string {
  let css = '';
  if (styles.base) {
    css += `${selector} {\n`;
    for (const [p, v] of Object.entries(styles.base)) css += ` ${toKebab(p)}: ${v};\n`;
    css += `}\n`;
  }
  const sortedKeys = Object.keys(styles).filter(k => k!== 'base' && styles[k]).sort((a, b) => {
    const av = _values[a]?? parseQueryRange(_current[a] || '').min;
    const bv = _values[b]?? parseQueryRange(_current[b] || '').min;
    return av - bv;
  });
  for (const bp of sortedKeys) {
    const bStyles = styles[bp]; if (!bStyles) continue;
    const query = _current[bp]; if (!query) continue;
    const media = query.startsWith('(') || query.startsWith('print')? `@media ${query}` : `@media ${query}`;
    css += `${media} {\n ${selector} {\n`;
    for (const [p, v] of Object.entries(bStyles)) css += ` ${toKebab(p)}: ${v};\n`;
    css += ` }\n}\n`;
  }
  return css;
}

export function responsive<T>(value: T | ResponsiveStyle<T>, defaultBreakpoint: keyof ResponsiveStyle = 'base'): ResponsiveStyle<T> {
  if (value && typeof value === 'object' &&!Array.isArray(value)) {
    const keys = Object.keys(value as object);
    if (keys.some(k => k in _current || k === 'base')) return value as ResponsiveStyle<T>;
  }
  return { [defaultBreakpoint]: value as T } as ResponsiveStyle<T>;
}

export function mergeResponsiveStyles(...styles: ResponsiveStyle<any>[]): ResponsiveStyle<any> {
  const merged: ResponsiveStyle<any> = {};
  for (const style of styles) {
    if (!style) continue;
    for (const [bp, bpStyles] of Object.entries(style)) {
      if (!bpStyles) continue;
      merged[bp] = {...merged[bp],...bpStyles };
    }
  }
  return merged;
}

export function getBreakpointQuery(name: string, unit: 'px' | 'rem' | 'em' = 'px'): string | undefined {
  const q = _current[name]; if (!q) return undefined;
  if (unit === 'px') return q;
  return q.replace(/(\d+(?:\.\d+)?)px/gi, (_, n) => `${parseFloat(n) / 16}${unit}`);
}

export function logBreakpoints(): void {
  console.log('\n📱 Current Breakpoints:'); console.log('═'.repeat(50));
  for (const [name, query] of Object.entries(_current)) console.log(` ${name.padEnd(15)} → ${query}`);
  console.log('═'.repeat(50) + '\n');
}