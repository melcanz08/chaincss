// src/core/entities/property-store.ts

import { shorthandMap, macros } from "@compiler/utils/shorthands.js";
import { classifyValue, type ValueClass } from '../usecases/value-classifier.js';

export interface PropertyStoreEntry { realProp: string; value: any; classification: ValueClass; }
interface TransformEntry { value: string; rawValue: any; classification: ValueClass; }

const UNITLESS = new Set([
  'zIndex','opacity','flex','flexGrow','flexShrink','order',
  'fontWeight','lineHeight','scale','zoom','animationIterationCount',
  'columnCount','orphans','widows','tabSize','fillOpacity','strokeOpacity',
  'aspectRatio','gridRow','gridColumn','gridRowStart','gridRowEnd','gridColumnStart','gridColumnEnd',
  'strokeWidth','strokeDashoffset','strokeDasharray','gridArea','lineClamp','WebkitLineClamp'
]);

const TRANSFORM_ORDER = ['translateX','translateY','rotate','scale','skew'] as const;
const TRANSFORM_ALIAS: Record<string, string> = { x: 'translateX', y: 'translateY', scale: 'scale', rotate: 'rotate', skew: 'skew' };
const TRANSFORM_PROPS = new Set(['scale','rotate','skew','x','y','translateX','translateY']);

export class PropertyStore {
  private properties: Record<string, any> = {};
  private transforms: Record<string, TransformEntry> = {};
  private tokens: any;

  // FIX: accept optional tokens arg to match style-collector.ts usage
  constructor(tokens?: any) {
    this.tokens = tokens;
  }

  set(prop: string, value: any): PropertyStoreEntry {
    const valueClass = classifyValue(value);

    const macroFn = (macros as any)[prop];
    if (macroFn) {
      const tmp: Record<string, any> = {};
      macroFn(value, tmp, true);
      if (tmp[prop] === value) delete tmp[prop];
      let overall: ValueClass = 'static';
      for (const [k, v] of Object.entries(tmp)) {
        const r = this.set(k, v);
        if (r.classification === 'dynamic') overall = 'dynamic';
      }
      return { realProp: prop, value: '[macro]', classification: overall };
    }

    if (TRANSFORM_PROPS.has(prop)) {
      this.setTransform(prop, value, valueClass);
      const isDyn = Object.values(this.transforms).some(t => t.classification === 'dynamic') ? 'dynamic' : 'static';
      return { realProp: 'transform', value: this.buildTransformString(), classification: isDyn };
    }

    const realProp = (shorthandMap as any)[prop] || prop;

    // FIX: explicit any for first param to satisfy noImplicitAny
    const camel = realProp.includes('-')
      ? realProp.replace(/-([a-z])/g, (_match: string, c: string) => c.toUpperCase())
      : realProp;

    let finalValue = value;
    if (typeof value === 'number' && !UNITLESS.has(camel)) finalValue = `${value}px`;

    this.properties[realProp] = finalValue;
    return { realProp, value: finalValue, classification: valueClass };
  }

  get(prop: string): any {
    if (prop in this.properties) return this.properties[prop];
    const tName = (TRANSFORM_ALIAS as any)[prop] || prop;
    if (tName in this.transforms) return this.transforms[tName].rawValue;
    if (prop === 'transform' && Object.keys(this.transforms).length) return this.buildTransformString();
    return undefined;
  }

  getAll(): Record<string, any> {
    const r = { ...this.properties };
    if (Object.keys(this.transforms).length) r.transform = this.buildTransformString();
    return r;
  }

  getRaw(): Record<string, any> { return { ...this.properties }; }
  isEmpty(): boolean { return Object.keys(this.properties).length === 0 && Object.keys(this.transforms).length === 0; }
  reset(): void { this.properties = {}; this.transforms = {}; }

  private setTransform(type: string, value: any, classification: ValueClass): void {
    const name = (TRANSFORM_ALIAS as any)[type] || type;
    let formatted = String(value);
    if (typeof value === 'number') {
      if (type === 'x' || type === 'y') formatted = `${value}px`;
      else if (type === 'rotate' || type === 'skew') formatted = `${value}deg`;
    }
    this.transforms[name] = { value: formatted, rawValue: value, classification };
  }

  private buildTransformString(): string {
    const ordered: string[] = [];
    for (const k of TRANSFORM_ORDER) if (k in this.transforms) ordered.push(`${k}(${this.transforms[k].value})`);
    for (const [k, v] of Object.entries(this.transforms)) if (!(TRANSFORM_ORDER as readonly string[]).includes(k)) ordered.push(`${k}(${v.value})`);
    return ordered.join(' ');
  }
}

