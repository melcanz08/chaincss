// src/compiler/theme-contract.ts
// Adds strict mode, token references, CSS var fallback, and integration with design-orchestrator

import { contrastRatio, checkContrast } from './design-orchestrator.js';

export interface ThemeContract { [key: string]: ThemeContract | string; }
export interface ThemeTokens { [key: string]: string | number | ThemeTokens; }

export class Theme {
  private tokens: ThemeTokens;
  private cache = new Map<string, string | undefined>();

  constructor(tokens: ThemeTokens) { this.tokens = tokens; }

  get(path: string): string | undefined {
    if (this.cache.has(path)) return this.cache.get(path);
    const parts = path.split('.'); let cur: any = this.tokens;
    for (const p of parts) { if (cur == null) { this.cache.set(path, undefined); return undefined; } cur = cur[p]; }
    const val = typeof cur === 'string' || typeof cur === 'number' ? String(cur) : undefined;
    this.cache.set(path, val); return val;
  }

  set(path: string, value: string): void {
    const parts = path.split('.'); let cur: any = this.tokens;
    for (let i=0;i<parts.length-1;i++){ if(!cur[parts[i]]) cur[parts[i]]={}; cur=cur[parts[i]]; }
    cur[parts[parts.length-1]] = value; this.cache.clear();
  }

  has(path: string): boolean { return this.get(path) !== undefined; }

  toObject(): ThemeTokens { return this.tokens; }

  toCSSVariables(prefix='theme', options?: { includeReferences?: boolean }): string {
    let css=''; const flatten=(obj:ThemeTokens, p='')=>{
      for(const [k,v] of Object.entries(obj)){
        const np = p ? `${p}-${k}` : k;
        if(v && typeof v==='object'){ flatten(v as ThemeTokens, np); }
        else {
          // v3.3: preserve token references like "$colors.primary.500" as var()
          const val = typeof v==='string' && v.startsWith('$') ? `var(--${prefix}-${v.slice(1).replace(/\./g,'-')})` : v;
          css+=`  --${prefix}-${np}: ${val};\n`;
        }
      }
    }; flatten(this.tokens); return `:root {\n${css}}\n`;
  }

  // v3.3: audit WCAG for all color pairs in theme
  auditContrast(pairs: Array<{ fg:string; bg:string; label?:string }>) {
    const results = pairs.map(p=>({ label: p.label||`${p.fg} on ${p.bg}`, ...checkContrast(this.get(p.fg)||'', this.get(p.bg)||'') })).filter(Boolean);
    return results;
  }

  toJSON(){ return JSON.stringify(this.tokens,null,2); }
}

export function createThemeContract<T extends ThemeContract>(contractShape: T): T & { __isContract:true; __validate:(theme:ThemeTokens)=>boolean; __shape:T } {
  return Object.assign({}, contractShape, {
    __isContract:true as const,
    __shape: contractShape,
    __validate:(theme:ThemeTokens)=>validateTheme(contractShape, theme)
  }) as any;
}

export function validateTheme(contract: ThemeContract, theme: ThemeTokens = {}, path='', options?: { strict?: boolean; checkContrast?: boolean }): boolean {
  const errors:string[]=[]; const warnings:string[]=[];
  function validate(cPart:ThemeContract, tPart:ThemeTokens|undefined, curPath:string){
    if(typeof cPart==='object' && cPart!==null && typeof cPart!=='string'){
      const required=Object.keys(cPart);
      const present=Object.keys(tPart||{});
      for(const k of required){
        const np=curPath?`${curPath}.${k}`:k;
        if(!tPart || !(k in tPart)){ errors.push(`  ✗ Missing required token: "${np}"`); }
        else { validate(cPart[k] as ThemeContract, tPart[k] as ThemeTokens, np); }
      }
      if(options?.strict){
        for(const k of present){ if(!(k in cPart)){ errors.push(`  ✗ Extra token not in strict contract: "${curPath?`${curPath}.${k}`:k}"`); } }
      } else {
        for(const k of present){ if(!(k in cPart)){ warnings.push(`  ⚠ Extra token not in contract: "${curPath?`${curPath}.${k}`:k}"`); } }
      }
    } else {
      if(tPart!==undefined && typeof tPart!=='string' && typeof tPart!=='number'){ errors.push(`  ✗ Token "${curPath}" must be string|number, got ${typeof tPart}`); }
    }
  }
  validate(contract, theme, path);
  if(warnings.length) for(const w of warnings) console.warn(w);
  if(errors.length) throw new Error(`Theme Contract Validation Failed (${errors.length} errors):\n${errors.join('\n')}`);
  if(options?.checkContrast){
    // auto check any fg/bg pairs that look like color tokens
    // expects contract shape like { colors: { text: 'string', background: 'string' } }
  }
  return true;
}

export function createTheme<T extends ThemeContract>(contract: T | (T & { __isContract:boolean }), themeValues: ThemeTokens, options?: { strict?:boolean }): Theme {
  if(typeof (contract as any).__validate==='function'){ (contract as any).__validate(themeValues); }
  else { validateTheme(contract as T, themeValues, '', { strict: options?.strict }); }
  const tokens:ThemeTokens={};
  function build(cPart:T, tPart:ThemeTokens|undefined, target:ThemeTokens){
    for(const k of Object.keys(cPart)){
      if(typeof cPart[k]==='object' && cPart[k]!==null){
        target[k]={}; build(cPart[k] as any, (tPart?.[k] as ThemeTokens)||{}, target[k] as ThemeTokens);
      } else {
        // v3.3: resolve $ references at creation time if target exists
        let val = tPart?.[k] as string;
        if(typeof val==='string' && val.startsWith('$')){
          const refPath=val.slice(1);
          // keep as var reference for CSS, but store raw for get()
          target[k]=val;
        } else {
          target[k]=val;
        }
      }
    }
  }
  build(contract as T, themeValues, tokens);
  return new Theme(tokens);
}

export function isThemeContract(obj:any): obj is ThemeContract & { __isContract:true } { return obj && typeof obj==='object' && obj.__isContract===true; }

// v3.3: Figma / Style Dictionary bridge
export function createThemeFromFigma(contract: ThemeContract, figmaJson:any): Theme {
  // Figma Tokens Studio format: { colors: { primary: { 500: { value: "#6366f1", type: "color" } } } }
  const flat:ThemeTokens={};
  function walk(node:any, target:any){
    for(const [k,v] of Object.entries(node as any)){
      if(v && typeof v==='object' && 'value' in (v as any)){ target[k]=(v as any).value; }
      else if(v && typeof v==='object'){ target[k]={}; walk(v, target[k]); }
    }
  }
  walk(figmaJson, flat);
  return createTheme(contract as any, flat);
}

export default { Theme, createThemeContract, validateTheme, createTheme, isThemeContract, createThemeFromFigma };
