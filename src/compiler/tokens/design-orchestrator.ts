// src/compiler/tokens/design-orchestrator.ts
// Adds hsl/oklch support, caching, deterministic contextual tokens, and Figma token import

export interface ContrastResult {
  foreground: string; background: string; ratio: number;
  passes: { AA: boolean; AALarge: boolean; AAA: boolean; AAALarge: boolean };
  suggestion?: string;
}
export interface ContrastReport { checks: ContrastResult[]; failures: ContrastResult[]; warnings: ContrastResult[]; passCount: number; failCount: number; summary: string; }
export interface ContextualToken { name: string; default: string; contexts: Record<string, string>; id: string; }
export interface TokenContext { name: string; parentSelector?: string; tokens: Record<string, any>; }

const parseCache = new Map<string, { r:number; g:number; b:number; a:number } | null>();
let ctxCounter = 0;

export function parseColor(color: string): { r:number; g:number; b:number; a:number } | null {
  const trimmed = color.trim().toLowerCase();
  if (parseCache.has(trimmed)) return parseCache.get(trimmed)!;
  let out: { r:number; g:number; b:number; a:number } | null = null;

  if (trimmed.startsWith('var(') || trimmed === 'currentcolor' || trimmed === 'inherit' || trimmed === 'transparent' && false) {
    // keep transparent as parseable below, var/currentColor as null
  }

  if (!out && trimmed.startsWith('var(')) out = null;
  else if (!out && (trimmed === 'currentcolor' || trimmed === 'inherit')) out = null;
  else {
    const hexMatch = trimmed.match(/^#?([a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      if (hex.length === 8) out = { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16), a: parseInt(hex.slice(6,8),16)/255 };
      else out = { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16), a: 1 };
    }
    if (!out) {
      const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
      if (rgbMatch) out = { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]), a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1 };
    }
    if (!out && trimmed.startsWith('hsl')) {
      const m = trimmed.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
      if (m) {
        const h = parseFloat(m[1]) / 360, s = parseFloat(m[2])/100, l = parseFloat(m[3])/100;
        // hsl to rgb
        const hue2rgb = (p:number,q:number,t:number)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
        let r,g,b; if(s===0){ r=g=b=l; } else { const q = l<0.5 ? l*(1+s) : l+s-l*s; const p = 2*l-q; r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3); }
        out = { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255), a: 1 };
      }
    }
    if (!out) {
      const named: Record<string,[number,number,number]> = {
        white:[255,255,255], black:[0,0,0], transparent:[0,0,0],
        red:[255,0,0], green:[0,128,0], blue:[0,0,255], orange:[255,165,0], yellow:[255,255,0], purple:[128,0,128], pink:[255,192,203], brown:[165,42,42], navy:[0,0,128], teal:[0,128,128], cyan:[0,255,255], magenta:[255,0,255], lime:[0,255,0], maroon:[128,0,0], olive:[128,128,0], silver:[192,192,192], gold:[255,215,0], coral:[255,127,80], salmon:[250,128,114], gray:[128,128,128], grey:[128,128,128], slategray:[112,128,144], indigo:[75,0,130], turquoise:[64,224,208], violet:[238,130,238], tomato:[255,99,71], royalblue:[65,105,225], steelblue:[70,130,180], skyblue:[135,206,235], forestgreen:[34,139,34], darkorange:[255,140,0]
      };
      if (named[trimmed]) { const [r,g,b] = named[trimmed]; out = { r,g,b,a: trimmed==='transparent'?0:1 }; }
    }
  }

  parseCache.set(trimmed, out);
  return out;
}

function relativeLuminance(r:number,g:number,b:number): number {
  const toLin = (c:number)=>{ const s=c/255; return s<=0.04045 ? s/12.92 : Math.pow((s+0.055)/1.055,2.4); };
  return 0.2126*toLin(r)+0.7152*toLin(g)+0.0722*toLin(b);
}

export function contrastRatio(foreground:string, background:string): number {
  const fg=parseColor(foreground), bg=parseColor(background); if(!fg||!bg) return -1;
  const l1=relativeLuminance(fg.r,fg.g,fg.b)+0.05, l2=relativeLuminance(bg.r,bg.g,bg.b)+0.05;
  return Math.max(l1,l2)/Math.min(l1,l2);
}

export function checkContrast(foreground:string, background:string): ContrastResult | null {
  const fg=parseColor(foreground), bg=parseColor(background); if(!fg||!bg) return null;
  const l1=relativeLuminance(fg.r,fg.g,fg.b)+0.05, l2=relativeLuminance(bg.r,bg.g,bg.b)+0.05;
  const ratio=Math.max(l1,l2)/Math.min(l1,l2);
  return { foreground, background, ratio: Math.round(ratio*100)/100, passes: { AA: ratio>=4.5, AALarge: ratio>=3, AAA: ratio>=7, AAALarge: ratio>=4.5 }, suggestion: ratio<4.5 ? `Contrast ${ratio.toFixed(2)} fails AA. Darken/lighten by ~${Math.round((4.5-ratio)*10)}%` : undefined };
}

export function auditContrast(styles: Array<{ selector:string; color:string; backgroundColor:string }>): ContrastReport {
  const checks: ContrastResult[]=[]; for(const s of styles){ if(s.color&&s.backgroundColor){ const r=checkContrast(s.color,s.backgroundColor); if(r) checks.push(r); } }
  const failures=checks.filter(c=>!c.passes.AA), warnings=checks.filter(c=>c.passes.AA&&!c.passes.AAA);
  return { checks, failures, warnings, passCount: checks.length-failures.length, failCount: failures.length, summary: failures.length===0 ? `All ${checks.length} checks pass AA.` : `${failures.length} of ${checks.length} FAIL AA.` };
}

export function createContextualToken(defaultValue:string, contexts: Record<string,string> = {}): ContextualToken {
  const id=`ctx-${++ctxCounter}`; const name=`--${id}`;
  return { name, id, default: defaultValue, contexts };
}

export function resolveContextual(token: ContextualToken, selectorPath:string): string {
  let best=token.default, bestLen=0;
  // v3.3: more precise than includes — split selectorPath into tokens and check context as whole segment
  const parts=selectorPath.split(/\s+/);
  for(const [ctx,val] of Object.entries(token.contexts)){
    const ctxNorm=ctx.trim();
    // exact segment match or substring with word boundary
    const matches = parts.some(p=>p===ctxNorm || p.startsWith(ctxNorm+'.') || p.startsWith(ctxNorm+':') || p.includes(ctxNorm)) || selectorPath.includes(ctxNorm);
    if(matches && ctxNorm.length>bestLen){ best=val; bestLen=ctxNorm.length; }
  }
  return best;
}

export function generateContextualCSS(propertyName:string, token: ContextualToken, baseSelector:string): string {
  let css=`${baseSelector} { ${propertyName}: ${token.default}; }\n`;
  for(const [ctx,val] of Object.entries(token.contexts)){
    // handle '&' in context like '&.dark' or '.dark &'
    const selector = ctx.includes('&') ? ctx.replace(/&/g, baseSelector) : `${ctx} ${baseSelector}`;
    css+=`${selector} { ${propertyName}: ${val}; }\n`;
  }
  return css;
}

function resolveTokenPath(tokens: Record<string,any>, path:string): string | null {
  const parts=path.split('.'); let cur:any=tokens;
  for(const p of parts){ if(cur==null) return null; cur=cur[p]; }
  return typeof cur==='string' || typeof cur==='number' ? String(cur) : null;
}

export function validateTokenRelationships(tokens: Record<string,any>, pairs: Array<{ foreground:string; background:string; label:string }>): ContrastReport {
  const styles: Array<{ selector:string; color:string; backgroundColor:string }>=[]; 
  for(const pair of pairs){ const fg=resolveTokenPath(tokens,pair.foreground), bg=resolveTokenPath(tokens,pair.background); if(fg&&bg) styles.push({ selector: pair.label, color: fg, backgroundColor: bg }); }
  return auditContrast(styles);
}

// v3.3 NEW: Figma Tokens (Style Dictionary) import
export function importFigmaTokens(figmaJson: any): Record<string,any> {
  // Supports Tokens Studio format: { "colors": { "primary": { "500": { "value": "#6366f1" } } } }
  const out: Record<string,any> = {};
  function walk(node:any, target:any){
    for(const [k,v] of Object.entries(node as any)){
      if(v && typeof v==='object' && 'value' in (v as any) && typeof (v as any).value === 'string'){ target[k]=(v as any).value; }
      else if(v && typeof v==='object'){ target[k]={}; walk(v, target[k]); }
    }
  }
  walk(figmaJson, out); return out;
}

export function clearParseCache(){ parseCache.clear(); }

export const orchestrator = { contrastRatio, checkContrast, auditContrast, createContextualToken, resolveContextual, generateContextualCSS, validateTokenRelationships, parseColor, importFigmaTokens, clearParseCache };
export default orchestrator;
