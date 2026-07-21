// src/runtime/svelte.ts — Store-based, works in Svelte 4 & 5, leak-safe, no hard dep
// @ts-nocheck
import { compileRuntime, removeRuntimeModule, styleInjector } from './injector.js';

let writable: any, get: any, onDestroyFn: any = null;
try { const svelte = require('svelte'); onDestroyFn = svelte.onDestroy || null; } catch { onDestroyFn = null; }
try {
  const store = require('svelte/store');
  writable = store.writable; get = store.get;
} catch {
  writable = (initial: any) => {
    let value = initial; const subs = new Set();
    return {
      set: (v: any) => { value = v; subs.forEach((fn:any)=>fn(value)); },
      update: (fn: any) => { value = fn(value); subs.forEach((f:any)=>f(value)); },
      subscribe: (fn: any) => { fn(value); subs.add(fn); return ()=>subs.delete(fn); },
    };
  };
  get = (store: any) => { let v: any; const u = store.subscribe((x:any)=>(v=x)); u(); return v; };
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return `chain-${(crypto as any).randomUUID().slice(0,8)}`;
  return `chain-${Math.random().toString(36).substring(2,11)}`;
}
function resolveStyles(styles: any) {
  if (typeof styles === 'function') { try { return styles(); } catch { return null; } }
  if (styles && typeof styles === 'object') return styles; return null;
}

export function useAtomicClasses(styles: any, options: any = {}) {
  const moduleId = `chaincss-svelte-${generateId()}`;
  const classesStore = writable({});
  const injectedIds: string[] = []; let destroyed = false;
  const compileStyles = (sourceStyles: any) => {
    if (!sourceStyles || Object.keys(sourceStyles).length===0) return;
    const compiled: any = {}; const names: any = {};
    for (const [k, def] of Object.entries(sourceStyles)) {
      const cn = `${k}-${moduleId}`; names[k]=cn;
      compiled[`${k}_${moduleId}`] = { selectors:[`.${cn}`], ...(typeof def==='function'?(def as any)():def) };
    }
    compileRuntime(compiled, moduleId);
    if (!destroyed) classesStore.set(names);
  };
  const initial = resolveStyles(styles);
  if (initial) compileStyles(initial);
  if (styles && typeof (styles as any).subscribe==='function') {
    (styles as any).subscribe((v:any)=>{ const r=resolveStyles(v); if(r) compileStyles(r); });
  }
  const cleanup = () => {
    if (destroyed) return; destroyed=true;
    try { removeRuntimeModule(moduleId); } catch {}
    for (const id of injectedIds) { try { removeRuntimeModule(id); } catch {} }
  };
  if (onDestroyFn) { try { onDestroyFn(cleanup); } catch {} }
  return {
    get classes() { return get(classesStore); },
    cx: (n:string)=>get(classesStore)[n]||'',
    cn: (...ns:string[])=>ns.map((n)=>get(classesStore)[n]).filter(Boolean).join(' '),
    inject: (newStyles:any)=>{
      const iid=`chaincss-injected-${generateId()}`; injectedIds.push(iid);
      const comp:any={}; const nm:any={};
      for (const [k,def] of Object.entries(newStyles)) {
        const cn=`${k}-${iid}`; nm[k]=cn;
        comp[`${k}_${iid}`]={ selectors:[`.${cn}`], ...(typeof def==='function'?(def as any)():def) };
      }
      compileRuntime(comp,iid); return nm;
    },
  };
}

export function ChainCSSGlobal(props:any): void {
  if (typeof document==='undefined') return;
  if (props.tokens && Object.keys(props.tokens).length>0) { try { styleInjector.setTokens(props.tokens); } catch {} }
  if (props.styles && Object.keys(props.styles).length>0) { useAtomicClasses(props.styles,{debug:props.debug}); }
}

export function createStyledComponent(styles:any, tag:string='div', options:any={}) {
  const resolved = typeof styles==='function'?(styles as any)():styles;
  const inst = useAtomicClasses({root:resolved}, options);
  return {
    $$render: (res:any, props:any={}, _b:any, slots:any={})=>{
      const rc=inst.classes['root']||''; const comb=[rc,props.class,props.className].filter(Boolean).join(' ');
      const attrs=Object.entries(props).filter(([k])=>k!=='class'&&k!=='className'&&k!=='as').map(([k,v])=>`${k}="${String(v).replace(/"/g,'&quot;')}"`).join(' ');
      const children=slots?.default?slots.default({}):''; const ft=props.as||tag;
      return `<${ft} class="${comb}" ${attrs}>${children}</${ft}>`;
    },
    render:(props:any={})=>({ tag:props.as||tag, class:[inst.classes['root']||'',props.class,props.className].filter(Boolean).join(' '), props, classes:inst.classes }),
    _instance:inst,
  };
}

export function createStyledComponents(comps:Record<string,any>, options?:any){
  const r:Record<string,any>={}; for(const [n,c] of Object.entries(comps)){ const {element='div',styles}=c as any; r[n]=createStyledComponent(styles,element,options); } return r;
}
export function useComputedStyles(f:any,p:any){ const comp={root:f(p)}; const {classes}=useAtomicClasses(comp); return { get classes(){return classes;}, get rootClass(){return classes['root']||'';} }; }
export function chainStyles(map:Record<string,any>){
  const mid=`chaincss-template-${generateId()}`; const comp:any={}; const names:any={};
  for(const [k,def] of Object.entries(map)){ const cn=`${k}-${mid}`; names[k]=cn; comp[`${k}_${mid}`]={ selectors:[`.${cn}`], ...(typeof def==='function'?(def as any)():def) }; }
  compileRuntime(comp,mid); return names;
}
const KEY=Symbol('chaincss'); function getCtx(){ try {return require('svelte');}catch{return null;} }
export function provideStyleContext(t:any){ const s=getCtx(); if(!s) return; try {s.setContext(KEY,writable(t));}catch{} }
export function injectStyleContext(){ const s=getCtx(); if(!s) return writable({}); try {return s.getContext(KEY)||writable({});}catch{return writable({});} }
export function cx(...cls:any[]){ const r:string[]=[]; for(const c of cls){ if(!c) continue; if(typeof c==='string') r.push(c); else if(typeof c==='object'){ for(const [k,v] of Object.entries(c)) if(v) r.push(k);} } return r.join(' '); }
export function enableSvelteDebug(){ if(typeof window!=='undefined') (window as any).__CHAINCSS_SVELTE_DEBUG__=true; }
export function disableSvelteDebug(){ if(typeof window!=='undefined') (window as any).__CHAINCSS_SVELTE_DEBUG__=false; }
export function isSvelteDebugEnabled(){ return typeof window!=='undefined' && !!(window as any).__CHAINCSS_SVELTE_DEBUG__; }

