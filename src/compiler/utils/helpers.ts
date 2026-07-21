// src/compiler/utils/helpers.ts
import { math } from '../math-engine.js'

export type cssUnit = 'px'|'rem'|'em'|'%'|'vw'|'vh'|'vmin'|'vmax'|'dvw'|'dvh'|'svw'|'svh'|'lvw'|'lvh'|'ch'|'ex';

const toStr = (r: any): string => {
  if (typeof r === 'string') return r;
  return r?.expression ?? r?.raw ?? `${r?.value ?? ''}${r?.unit ?? ''}`;
}

// suffix adder - 16 -> 16rem, "16px" -> keep "16px"
const asUnit = (u: string) => (v: any) => {
  const s = String(v).trim();
  if (/[a-z%]$/i.test(s)) return s;
  if (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(s)) return `${s}${u}`;
  return s;
}

export const helpers = {
  // converter -> 1rem -> 16px
  mpx: (v: any) => {
    const px = (math as any).toPx(v);
    return typeof px === 'number' ? `${px}px` : toStr(px);
  },
  toPx: (v: any) => {
    const px = (math as any).toPx(v);
    return typeof px === 'number' ? `${px}px` : toStr(px);
  },
  toRem: (v: any, base = 16) => toStr((math as any).toRem(v, { rootFontSize: base })),
  toEm: (v: any, base = 16) => toStr((math as any).toEm(v, { parentFontSize: base })),

  // smart css
  clamp: (min: any, pref: any, max: any) => toStr((math as any).clampValue(pref, min, max)),
  min: (...v: any[]) => toStr((math as any).cssMin(...v)),
  max: (...v: any[]) => toStr((math as any).cssMax(...v)),

  // number helpers
  round: (v: any, prec = 2) => {
    const p = (math as any).parse(v);
    return `${Number(p.value).toFixed(prec)}${p.unit === 'expression' ? '' : p.unit || ''}`;
  },
  ceil: (v: any) => {
    const p = (math as any).parse(v);
    return `${Math.ceil(p.value)}${p.unit === 'expression' ? '' : p.unit || ''}`;
  },
  floor: (v: any) => {
    const p = (math as any).parse(v);
    return `${Math.floor(p.value)}${p.unit === 'expression' ? '' : p.unit || ''}`;
  },

  // suffix adders
  px: asUnit('px'),
  rem: asUnit('rem'),
  em: asUnit('em'),
  percent: asUnit('%'),
  vw: asUnit('vw'),
  vh: asUnit('vh'),
  vmin: asUnit('vmin'),
  vmax: asUnit('vmax'),
  dvw: asUnit('dvw'),
  dvh: asUnit('dvh'),
  svw: asUnit('svw'),
  svh: asUnit('svh'),
  lvw: asUnit('lvw'),
  lvh: asUnit('lvh'),
  ch: asUnit('ch'),
  ex: asUnit('ex'),

  // non-math
  rgba: (r: number, g: number, b: number, a = 1) => `rgba(${r}, ${g}, ${b}, ${a})`,
  hsla: (h: number, s: number, l: number, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`,
  url: (path: string) => `url("${String(path).replace(/"/g, '\\"')}")`,
  format: (strings: TemplateStringsArray, ...values: any[]) =>
    strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i] ?? '') : ''), ''),

  if: (c: boolean, t: any, f: any) => c ? t : f,
  camelToKebab: (str: string) => str.replace(/([A-Z])/g, '-$1').toLowerCase(),
  kebabToCamel: (str: string) => str.replace(/-([a-z])/g, (_, l) => l.toUpperCase()),
} as any;

export const toRem = helpers.toRem;
export const toEm = helpers.toEm;
export const toPx = helpers.toPx;
export { fluidType } from '../math-engine.js'
export default helpers;