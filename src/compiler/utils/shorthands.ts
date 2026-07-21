// src/compiler/utils/shorthands.ts

import { helpers } from './helpers.js';
const _px = (helpers as any).px as (v: any) => string;

// EMPTY - raw() and box() cover this now
export const shorthandMap: Record<string, string> = {};

type MacroHandler = (value: any, catcher: Record<string, any>, useTokens: boolean) => void;

export const _emittedKeyframesForCustom = new Set<string>();
const emittedKeyframes = new Set<string>();

export function emitKeyframeOnce(catcher: Record<string, any>, name: string, steps: Record<string, any>): void {
  if (emittedKeyframes.has(name)) return;
  emittedKeyframes.add(name);
  if (!catcher.atRules) catcher.atRules = [];
  catcher.atRules.push({ type: 'keyframes', name, steps: JSON.parse(JSON.stringify(steps)) });
}
export function clearKeyframeCache(): void { emittedKeyframes.clear(); }

export function getSubStyles(callback: (c: any) => void, _useTokens: boolean): Record<string, any> {
  const acc: Record<string, any> = {};
  const proxy = new Proxy(acc, {
    get(_t, prop) {
      if (prop === '$el' || prop === 'build') return () => acc;
      return (value: any) => {
        if (typeof value === 'object' && value!== null &&!Array.isArray(value)) Object.assign(acc, value);
        else acc[prop as string] = value;
        return proxy;
      };
    },
    set(_t, prop, value) { acc[prop as string] = value; return true; }
  });
  callback(proxy);
  return acc;
}
function deepCloneStyles<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)); }
function handlePosition(type: string, v: any, c: any): void {
  c.position = type;
  if (v && typeof v === 'object') {
    if (v.top!== undefined) c.top = _px(v.top);
    if (v.right!== undefined) c.right = _px(v.right);
    if (v.bottom!== undefined) c.bottom = _px(v.bottom);
    if (v.left!== undefined) c.left = _px(v.left);
    if (v.inset!== undefined) { const val=_px(v.inset); c.top=val; c.right=val; c.bottom=val; c.left=val; }
    if (v.x!== undefined) { const val=_px(v.x); c.left=val; c.right=val; }
    if (v.y!== undefined) { const val=_px(v.y); c.top=val; c.bottom=val; }
  } else if (v!== undefined && typeof v!== 'boolean') {
    const val=_px(v); c.top=val; c.right=val; c.bottom=val; c.left=val;
  }
}
function handleTheme(cb: any, c: any, mode: string, useTokens: boolean): void {
  if (!c.atRules) c.atRules = [];
  c.atRules.push({ type: 'media', query: `(prefers-color-scheme: ${mode})`, styles: getSubStyles(cb, useTokens) });
}
function nested(c: any,...rules: any[]) {
  if (!Array.isArray(c.nestedRules)) c.nestedRules = [];
  c.nestedRules.push(...deepCloneStyles(rules));
}

export const macros: Record<string, MacroHandler> = {
  mx: (v,c)=>{ const val=_px(v); c.marginLeft=val; c.marginRight=val; },
  my: (v,c)=>{ const val=_px(v); c.marginTop=val; c.marginBottom=val; },
  px: (v,c)=>{ const val=_px(v); c.paddingLeft=val; c.paddingRight=val; },
  py: (v,c)=>{ const val=_px(v); c.paddingTop=val; c.paddingBottom=val; },
  mxi: (v,c)=>{ c.marginInline=_px(v); },
  myb: (v,c)=>{ c.marginBlock=_px(v); },
  pxi: (v,c)=>{ c.paddingInline=_px(v); },
  pyb: (v,c)=>{ c.paddingBlock=_px(v); },

  size: (v,c)=>{ const val=typeof v==='number'?_px(v):v; c.width=val; c.height=val; },
  square: (v,c)=>{ const val=_px(v); c.width=val; c.height=val; c.display='flex'; c.alignItems='center'; c.justifyContent='center'; },
  circle: (v,c)=>{ const val=_px(v); c.width=val; c.height=val; c.borderRadius='50%'; c.display='flex'; c.alignItems='center'; c.justifyContent='center'; },

  inset: (v,c)=>{ if(typeof v==='object'){ const o:any={}; for(const [k,val] of Object.entries(v)) o[k]=_px(val); Object.assign(c,o); } else { const val=_px(v); c.top=val; c.right=val; c.bottom=val; c.left=val; } },
  insetX: (v,c)=>{ const val=_px(v); c.left=val; c.right=val; },
  insetY: (v,c)=>{ const val=_px(v); c.top=val; c.bottom=val; },
  insetInline: (v,c)=>{ c.insetInline=_px(v); },
  insetBlock: (v,c)=>{ c.insetBlock=_px(v); },

  borderX: (v,c)=>{ c.borderLeft=v; c.borderRight=v; },
  borderY: (v,c)=>{ c.borderTop=v; c.borderBottom=v; },
  borderInline: (v,c)=>{ c.borderInline=v; },
  borderBlock: (v,c)=>{ c.borderBlock=v; },

  // REMOVED: flex, inlineFlex, grid, inlineGrid, block, inline, contents, hidden -> now in typed API

  cols: (v,c)=>{ c.gridTemplateColumns=typeof v==='number'?`repeat(${v}, minmax(0, 1fr))`:v; },
  rows: (v,c)=>{ c.gridTemplateRows=typeof v==='number'?`repeat(${v}, minmax(0, 1fr))`:v; },

  center: (v,c)=>{
    if(v==='text'||v==='txt'||v==='t'){ c.textAlign='center'; return; }
    if(v==='x'||v==='horizontal'){ c.marginLeft='auto'; c.marginRight='auto'; return; }
    if(v==='y'||v==='vertical'){ c.position='absolute'; c.top='50%'; c.transform='translateY(-50%)'; return; }
    if(v==='both' && (c as any).textAlign){ c.textAlign='center'; }
    c.display=v==='inline'?'inline-flex':'flex'; c.alignItems='center'; c.justifyContent='center';
  },
  textCenter: (_v,c)=>{ c.textAlign='center'; }, centerText: (_v,c)=>{ c.textAlign='center'; },
  centerX: (_v,c)=>{ c.marginLeft='auto'; c.marginRight='auto'; }, centerY: (_v,c)=>{ c.position='absolute'; c.top='50%'; c.transform='translateY(-50%)'; },
  flexCenter: (v,c)=>{ c.display='flex'; c.alignItems='center'; c.justifyContent='center'; if(v==='col'||v==='column') c.flexDirection='column'; },
  gridCenter: (_v,c)=>{ c.display='grid'; c.placeItems='center'; },
  zStack: (_v,c)=>{ c.display='grid'; c.placeItems='center'; nested(c, {selector:'& > *',styles:{gridArea:'1 / 1'}}); },

  stack: (v,c)=>{ c.display='flex'; if(typeof v==='object'){ c.flexDirection=v.dir==='row'?'row':'column'; c.gap=_px(v.spacing); } else if(v==='row'){ c.flexDirection='row'; c.gap='1rem'; } else { c.flexDirection='column'; c.gap=v? _px(v) : '1rem'; } },
  hstack: (v,c)=>{ c.display='flex'; c.flexDirection='row'; c.alignItems='center'; c.gap=v? _px(v) : '1rem'; },
  vstack: (v,c)=>{ c.display='flex'; c.flexDirection='column'; c.gap=v? _px(v) : '1rem'; },
  cluster: (v,c)=>{ c.display='flex'; c.flexWrap='wrap'; c.gap=v? _px(v) : '1rem'; c.justifyContent='flex-start'; c.alignItems='center'; },
  switcher: (v,c)=>{ const bp=typeof v==='number'? _px(v) : v||'30rem'; c.display='flex'; c.flexWrap='wrap'; c.gap='1rem'; nested(c, {selector:'& > *', styles:{flexGrow:1, flexBasis:`calc((${bp} - 100%) * 999)`}}); },
  cover: (v,c)=>{ const minH=typeof v==='number'? _px(v) : v||'60vh'; c.display='flex'; c.flexDirection='column'; c.minHeight=minH; nested(c, {selector:'& > :first-child:not(h1)',styles:{marginBlockStart:'1rem'}},{selector:'& > :last-child:not(h1)',styles:{marginBlockEnd:'1rem'}},{selector:'& > h1',styles:{marginBlock:'auto'}}); },
  frame: (v,c)=>{ const r=typeof v==='string'?v:'16 / 9'; c.aspectRatio=r; c.overflow='hidden'; c.display='flex'; c.justifyContent='center'; c.alignItems='center'; nested(c, {selector:'& > img, & > video', styles:{inlineSize:'100%', blockSize:'100%', objectFit:'cover'}}); },
  reel: (v,c)=>{ c.display='flex'; c.overflowX='auto'; c.overflowY='hidden'; c.gap=v? _px(v) : '1rem'; c.scrollSnapType='x mandatory'; c.WebkitOverflowScrolling='touch'; nested(c, {selector:'& > *',styles:{flex:'0 0 auto', scrollSnapAlign:'start'}}); },
  imposter: (v,c)=>{ c.position='absolute'; c.top='50%'; c.left='50%'; c.transform='translate(-50%,-50%)'; if(v===true) return; if(typeof v==='object'){ const o:any={}; for(const [k,val] of Object.entries(v)) o[k]=_px(val as any); Object.assign(c,o); } },

  autoGrid: (v,c)=>{ const min=typeof v==='number'? _px(v) : v||'16rem'; c.display='grid'; c.gridTemplateColumns=`repeat(auto-fit, minmax(min(${min},100%),1fr))`; c.gap='1rem'; },
  masonry: (v,c)=>{ const cols=typeof v==='number'?v:3; c.columns=cols; c.columnGap='1rem'; nested(c, {selector:'& > *',styles:{breakInside:'avoid', marginBottom:'1rem'}}); },
  fluidGrid: (v,c)=>{ c.display='grid'; c.gridTemplateColumns='repeat(auto-fit, minmax(280px,1fr))'; c.gap=v? _px(v) : '24px'; },
  gridTable: (v,c)=>{ const min=typeof v==='number'? _px(v) : v; c.display='grid'; c.gridTemplateColumns=`repeat(auto-fit, minmax(${min},1fr))`; },

  absolute: (v,c)=>handlePosition('absolute',v,c), fixed: (v,c)=>handlePosition('fixed',v,c),
  sticky: (v,c)=>handlePosition('sticky',v,c), relative: (v,c)=>handlePosition('relative',v,c),
  dock: (v,c)=>{ c.position='sticky'; c.top='0'; c.zIndex='10'; if(typeof v==='number') c.height=_px(v); else if(v) c.height=v; },
  dockTop: (v,c)=>{ c.position='sticky'; c.top='0'; c.left='0'; c.right='0'; c.zIndex='10'; if(v) c.height=typeof v==='number'?_px(v):v; },
  dockBottom: (v,c)=>{ c.position='fixed'; c.bottom='0'; c.left='0'; c.right='0'; c.zIndex='10'; if(v) c.height=typeof v==='number'?_px(v):v; },
  bleed: (v,c)=>{ const s=typeof v==='number'? _px(v) : v||'2rem'; c.marginInline=`calc(${s} * -1)`; },
  bleedX: (v,c)=>{ const s=typeof v==='number'? _px(v) : v||'2rem'; c.marginInline=`calc(${s} * -1)`; },
  coverFull: (_v,c)=>{ c.position='absolute'; c.inset='0'; },

  hide: (_v,c)=>{ c.opacity=0; c.visibility='hidden'; c.pointerEvents='none'; },
  show: (_v,c)=>{ c.opacity=1; c.visibility='visible'; c.pointerEvents='auto'; },
  invisible: (_v,c)=>{ c.visibility='hidden'; },
  srOnly: (_v,c)=>{ c.position='absolute'; c.width='1px'; c.height='1px'; c.padding='0'; c.margin='-1px'; c.overflow='hidden'; c.clip='rect(0,0,0,0)'; c.whiteSpace='nowrap'; c.borderWidth='0'; },
  notSrOnly: (_v,c)=>{ c.position='static'; c.width='auto'; c.height='auto'; c.padding='0'; c.margin='0'; c.overflow='visible'; c.clip='auto'; c.whiteSpace='normal'; },
  unselectable: (_v,c)=>{ c.userSelect='none'; c.WebkitUserSelect='none'; c.MozUserSelect='none'; (c as any).msUserSelect='none'; },
  selectable: (v,c)=>{ c.userSelect=v||'text'; },

  scrollable: (v,c)=>{ if(v==='x'){c.overflowX='auto';c.overflowY='hidden';}else if(v==='y'){c.overflowX='hidden';c.overflowY='auto';}else{c.overflow='auto';} c.WebkitOverflowScrolling='touch'; },
  scrollbarHide: (_v,c)=>{ c.scrollbarWidth='none'; (c as any).msOverflowStyle='none'; nested(c, {selector:'&::-webkit-scrollbar',styles:{display:'none'}}); },
  scrollbarThin: (v,c)=>{ c.scrollbarWidth='thin'; c.scrollbarColor=`${typeof v==='string'?v:'#cbd5e1'} transparent`; },
  snapX: (_v,c)=>{ c.scrollSnapType='x mandatory'; c.overflowX='auto'; nested(c, {selector:'& > *',styles:{scrollSnapAlign:'center'}}); },
  snapY: (_v,c)=>{ c.scrollSnapType='y mandatory'; c.overflowY='auto'; },

  prose: (_v,c)=>{ c.maxWidth='65ch'; c.lineHeight='1.75'; nested(c, {selector:'& p',styles:{marginBlock:'1.25em'}},{selector:'& h1,& h2,& h3',styles:{lineHeight:'1.2', fontWeight:'700'}}); },
  heading: (v,c)=>{ const s=typeof v==='number'?v:1; c.fontWeight='800'; c.lineHeight='1.1'; c.letterSpacing='-0.02em'; c.fontSize=s===1?'clamp(2.5rem,5vw,4rem)':`clamp(1.5rem,3vw,${2+s}rem)`; },
  eyebrow: (_v,c)=>{ c.fontSize='0.75rem'; c.fontWeight='600'; c.letterSpacing='0.08em'; c.textTransform='uppercase'; c.opacity='0.7'; },
  caption: (_v,c)=>{ c.fontSize='0.875rem'; c.lineHeight='1.4'; c.opacity='0.75'; },
  textBalance: (_v,c)=>{ (c as any).textWrap='balance'; },
  textPretty: (_v,c)=>{ (c as any).textWrap='pretty'; },
  hyphenate: (_v,c)=>{ c.hyphens='auto'; c.wordBreak='break-word' as any; },
  fontSmoothing: (_v,c)=>{ c.WebkitFontSmoothing='antialiased'; c.MozOsxFontSmoothing='grayscale'; },
  ligatures: (v,c)=>{ c.fontVariantLigatures=v||'common-ligatures'; c.fontFeatureSettings='"liga" 1, "calt" 1'; },
  linkUnderline: (v,c)=>{ const col=typeof v==='string'?v:'currentColor'; c.textDecoration=`underline 2px ${col}`; c.textUnderlineOffset='3px'; nested(c, {selector:'&:hover',styles:{textDecorationThickness:'3px'}}); },
  selection: (v,c)=>{ nested(c, {selector:'&::selection',styles:{backgroundColor:typeof v==='string'?v:'#3b82f6', color:'white'}}); },
  truncate: (_v,c)=>{ c.overflow='hidden'; c.textOverflow='ellipsis'; c.whiteSpace='nowrap'; },
  lineClamp: (v,c)=>{ const l=typeof v==='number'?v:3; c.display='-webkit-box'; c.WebkitLineClamp=l; (c as any).WebkitBoxOrient='vertical'; c.overflow='hidden'; },
  aspect: (v:string,c)=>{ const map:Record<string,string>={square:'1 / 1', video:'16 / 9', golden:'1.618 / 1', portrait:'3 / 4', landscape:'4 / 3', wide:'21 / 9'}; c.aspectRatio=map[v]||v; },

  ring: (v,c)=>{ const w=typeof v==='number'? _px(v) : v||'2px'; c.boxShadow=`0 0 0 ${w} var(--ring-color, #3b82f6)`; },
  ringInset: (v,c)=>{ const w=typeof v==='number'? _px(v) : v||'2px'; c.boxShadow=`inset 0 0 0 ${w} var(--ring-color, currentColor)`; },
  ringOffset: (v,c)=>{ const w=typeof v==='number'? _px(v) : v||'2px'; (c as any)['--ring-offset-width']=w; },
  divideX: (v,c)=>{ nested(c, {selector:'& > * + *',styles:{borderLeftWidth:'1px', borderColor:typeof v==='string'?v:'#e5e7eb'}}); },
  divideY: (v,c)=>{ nested(c, {selector:'& > * + *',styles:{borderTopWidth:'1px', borderColor:typeof v==='string'?v:'#e5e7eb'}}); },
  hairline: (v,c)=>{ c.borderWidth='0.5px'; if(v) c.borderColor=v as string; },
  paper: (v,c)=>{ c.backgroundColor='white'; c.borderRadius='8px'; c.boxShadow='0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)'; if(typeof v==='number') c.padding=_px(v); },
  card: (v,c)=>{ c.backgroundColor='white'; c.borderRadius='12px'; c.border='1px solid #e5e7eb'; c.boxShadow='0 1px 3px rgba(0,0,0,0.08)'; if(typeof v==='number') c.padding=_px(v); },
  elevated: (v,c)=>{ const l=typeof v==='number'?v:2; const shadows=[ '0 1px 2px rgba(0,0,0,0.06)', '0 4px 12px rgba(0,0,0,0.08)', '0 12px 24px rgba(0,0,0,0.12)', '0 24px 48px rgba(0,0,0,0.16)']; c.boxShadow=shadows[Math.min(l,shadows.length-1)]; },
  glass: (v,c)=>{ const blur=typeof v==='number'? _px(v) : v||'12px'; c.backdropFilter=`blur(${blur})`; (c as any).WebkitBackdropFilter=`blur(${blur})`; c.backgroundColor='rgba(255, 255, 255, 0.1)'; c.border='1px solid rgba(255,255,255,0.12)'; },
  frosted: (v,c)=>{ const blur=typeof v==='number'? _px(v) : v||'12px'; c.backdropFilter=`blur(${blur}) saturate(1.5)`; c.WebkitBackdropFilter=`blur(${blur}) saturate(1.5)`; },
  glow: (v,c)=>{ let color:string; let size:number; if(typeof v==='string'){color=v; size=20;} else {color=v?.color||'rgba(99,102,241,0.5)'; size=v?.size||24;} c.boxShadow=`0 0 ${size/3}px ${color}, 0 0 ${size}px ${color}`; },
  innerGlow: (v,c)=>{ const col=typeof v==='string'?v:'rgba(255,255,255,0.2)'; c.boxShadow=`inset 0 1px 2px ${col}, inset 0 -1px 1px rgba(0,0,0,0.1)`; },
  textGradient: (v,c)=>{ let colors:string[]; let angle:number; if(Array.isArray(v)){colors=v; angle=90;} else {colors=v.colors; angle=v.angle||90;} c.backgroundImage=`linear-gradient(${angle}deg, ${colors.join(', ')})`; c.WebkitBackgroundClip='text'; c.backgroundClip='text'; c.WebkitTextFillColor='transparent'; c.color='transparent'; c.display='inline-block'; },
  meshGradient: (v,c)=>{ const [c1,c2,c3,c4]=Array.isArray(v)?v:[v[0],v[1],v[2],v[3]]; c.backgroundColor=c1; c.backgroundImage=`radial-gradient(at 0% 0%, ${c2} 0px, transparent 55%), radial-gradient(at 100% 0%, ${c3} 0px, transparent 55%), radial-gradient(at 100% 100%, ${c4} 0px, transparent 55%)`; },
  noise: (v,c)=>{ const op = typeof v ==='number'? v:0.05; c.backgroundImage=`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='${op}'/%3E%3C/svg%3E")`; },
  skeleton: (v,c)=>{ let active:boolean; let base:string; let hl:string; if(typeof v==='boolean'){active=v; base='rgba(0,0,0,0.08)'; hl='rgba(0,0,0,0.04)';} else {active=v?.active??true; base=v?.color||'rgba(0,0,0,0.08)'; hl=v?.highlight||'rgba(0,0,0,0.04)';} if(!active) return; c.backgroundColor=base; c.backgroundImage=`linear-gradient(90deg, ${base} 25%, ${hl} 50%, ${base} 75%)`; c.backgroundSize='200% 100%'; c.animation='skeleton-loading 1.5s infinite linear'; emitKeyframeOnce(c,'skeleton-loading',{'0%':{backgroundPosition:'200% 0'},'100%':{backgroundPosition:'-200% 0'}}); },
  shimmer: (_v,c)=>{ c.backgroundImage='linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)'; c.backgroundSize='200% 100%'; c.animation='shimmer 2s infinite linear'; emitKeyframeOnce(c,'shimmer',{'0%':{backgroundPosition:'-200% 0'},'100%':{backgroundPosition:'200% 0'}}); },
  float: (v,c)=>{ const d=typeof v==='number'?v:6; c.animation=`float ${d}s ease-in-out infinite`; emitKeyframeOnce(c,'float',{'0%,100%':{transform:'translateY(0)'},'50%':{transform:'translateY(-8px)'}}); },
  spin: (v,c)=>{ const d=typeof v==='number'?`${v}s`:v||'1s'; c.animation=`spin ${d} linear infinite`; emitKeyframeOnce(c,'spin',{'to':{transform:'rotate(360deg)'}}); },
  pulse: (v,c)=>{ const d=typeof v==='number'?`${v}s`:v||'2s'; c.animation=`pulse ${d} ease-in-out infinite`; emitKeyframeOnce(c,'pulse',{'0%,100%':{opacity:'1'},'50%':{opacity:'0.5'}}); },
  bounce: (v,c)=>{ const d=typeof v==='number'?`${v}s`:v||'1s'; c.animation=`bounce ${d} infinite`; emitKeyframeOnce(c,'bounce',{'0%,100%':{transform:'translateY(-25%)', animationTimingFunction:'cubic-bezier(0.8,0,1,1)'},'50%':{transform:'none', animationTimingFunction:'cubic-bezier(0,0,0.2,1)'}}); },
  marquee: (v,c)=>{ const d=typeof v==='number'?v:20; c.whiteSpace='nowrap'; c.animation=`marquee ${d}s linear infinite`; c.display='inline-block'; emitKeyframeOnce(c,'marquee',{'0%':{transform:'translateX(0)'},'100%':{transform:'translateX(-50%)'}}); },

  fluidText: (v,c)=>{ const min=typeof v.min==='number'? _px(v.min) : v.min; const max=typeof v.max==='number'? _px(v.max) : v.max; c.fontSize=`clamp(${min}, ${v.vw||'4vw'}, ${max})`; },
  safeArea: (v,c)=>{ const edges=Array.isArray(v)?v:[v||'all']; const map:Record<string,string>={top:'Top',bottom:'Bottom',left:'Left',right:'Right'}; edges.forEach(e=>{ if(e==='all'){Object.keys(map).forEach(k=>{c[`padding${map[k]}`]=`env(safe-area-inset-${k})`;});} else if(map[e]){c[`padding${map[e]}`]=`env(safe-area-inset-${e})`;}}); },

  pressable: (v,c,useTokens)=>{ c.cursor='pointer'; c.userSelect='none'; (c as any).WebkitUserSelect='none'; macros.clickScale(v,c,useTokens); nested(c, {selector:'&:hover',styles:{opacity:0.85}}); },
  clickScale: (_value: any, collector: any) => {
    collector.cursor = 'pointer'; collector.transition = 'transform 0.1s ease';
    nested(collector, { selector: '&:active', styles: { transform: 'scale(0.95)' } });
  },
  hoverLift: (v,c)=>{ const y=typeof v==='number'? _px(v) : v||'4px'; c.transition='transform 0.2s ease, box-shadow 0.2s ease'; nested(c, {selector:'&:hover', styles:{transform:`translateY(-${y})`, boxShadow:'0 12px 20px -8px rgba(0,0,0,0.15)'} }); },
  hoverGlow: (v,c)=>{ const col=typeof v==='string'?v:'#6366f1'; nested(c, {selector:'&:hover',styles:{boxShadow:`0 0 20px ${col}40`}}); },
  focusRing: (_value: any, collector: any) => { nested(collector, { selector: '&:focus-visible', styles: { outline: '2px solid var(--focus, #3b82f6)', outlineOffset: '2px' } }); },
  focusVisible: (v,c,useTokens)=>{ nested(c, {selector:'&:focus-visible',styles: getSubStyles(v,useTokens)}); },
  onHover: (v,c,useTokens)=>{ nested(c, {selector:'&:hover',styles: getSubStyles(v,useTokens)}); },
  onActive: (v,c,useTokens)=>{ nested(c, {selector:'&:active',styles: getSubStyles(v,useTokens)}); },
  onInteracting: (v,c,useTokens)=>{ const res=getSubStyles(v,useTokens); ['&:hover','&:focus-visible','&:active'].forEach(s=>nested(c, {selector:s,styles:res})); },
  children: (v,c,useTokens)=>{ nested(c, {selector:'& > *',styles: getSubStyles(v,useTokens)}); },
  childHover: (v,c,useTokens)=>{ nested(c, {selector:'&:hover > *',styles: getSubStyles(v,useTokens)}); },
  peerHover: (v,c,useTokens)=>{ const res=getSubStyles(v,useTokens); nested(c, {selector:'.peer:hover ~ &',styles:res}, {selector:'.group:has(.peer:hover) &:not(.peer:hover)',styles:res}); },
  dark: (v,c,useTokens)=>handleTheme(v,c,'dark',useTokens), light: (v,c,useTokens)=>handleTheme(v,c,'light',useTokens),
  pill: (_v,c)=>{ c.borderRadius='9999px'; c.padding='6px 14px'; c.display='inline-flex'; c.alignItems='center'; c.whiteSpace='nowrap'; },
  badge: (v,c)=>{ c.borderRadius='9999px'; c.padding='2px 8px'; c.fontSize='0.75rem'; c.fontWeight='600'; c.backgroundColor=typeof v==='string'?v:'#eef2ff'; c.color='#4338ca'; },
  kbd: (_v,c)=>{ c.fontFamily='ui-monospace, SFMono-Regular, monospace'; c.fontSize='0.75em'; c.padding='2px 6px'; c.borderRadius='4px'; c.backgroundColor='#f1f5f9'; c.border='1px solid #e2e8f0'; c.borderBottomWidth='2px'; c.lineHeight='1'; },
  containerMacro: (v,c)=>{ c.width='100%'; c.maxWidth=typeof v==='number'? _px(v) : v||'1200px'; macros.mx('auto',c,false); macros.px('20px',c,false); },
  container: (v,c)=>{ c.width='100%'; c.maxWidth=typeof v==='number'? _px(v) : v||'1200px'; c.marginInline='auto'; c.paddingInline='1rem'; },
  fullScreen: (v,c)=>{ c.position='fixed'; c.top='0'; c.right='0'; c.bottom='0'; c.left='0'; c.zIndex=typeof v==='number'?v:9999; },
  bento: (v,c,useTokens)=>{ c.display='grid'; if(typeof v==='number'){c.gridTemplateColumns=`repeat(${v}, minmax(0,1fr))`; c.gap='16px';} else if(typeof v==='object'){c.gridTemplateColumns=`repeat(${v.cols||4}, minmax(0,1fr))`; c.gap=typeof v.gap==='number'? _px(v.gap) : v.gap||'16px';} const child=getSubStyles(v?.children||(()=>{}),useTokens); if(Object.keys(child).length) nested(c, {selector:'& > *',styles:child}); else nested(c, {selector:'& > *',styles:{borderRadius:'16px', padding:'20px', backgroundColor:'rgba(255,255,255,0.05)'}}); },
  frostedNav: (v,c,useTokens)=>{ macros.fixed({top:0,left:0},c,useTokens); c.width='100%'; macros.glass(v||16,c,useTokens); macros.safeArea('top',c,useTokens); c.zIndex='1000'; },
  gridList: (v,c)=>{ c.display='grid'; c.gridTemplateColumns='repeat(auto-fit, minmax(280px,1fr))'; c.gap=typeof v==='number'? _px(v) : v||'24px'; },
  hero: (_v,c)=>{ c.display='flex'; c.flexDirection='column'; c.justifyContent='center'; c.alignItems='center'; c.width='100%'; c.minHeight='60vh'; c.textAlign='center'; c.paddingBlock='4rem'; },
  willChange: (v,c)=>{ c.willChange=typeof v==='string'?v:'transform, opacity'; },
  contentVisAuto: (_v,c)=>{ c.contentVisibility='auto'; (c as any).containIntrinsicSize='auto 500px'; },
  containLayout: (_v,c)=>{ c.contain='layout paint'; },
  gpu: (_v,c)=>{ c.transform='translateZ(0)'; c.willChange='transform'; },
  touchAction: (v,c)=>{ c.touchAction=v||'manipulation'; },
  outlineDebug: (_v,c)=>{ c.outline='1px solid #f43f5e'; nested(c, {selector:'& > *',styles:{outline:'1px dashed rgba(99,102,241,0.5)'}}); },
  debugGrid: (v,c)=>{ const col=typeof v==='string'?v:'rgba(99,102,241,0.15)'; c.backgroundImage=`linear-gradient(${col} 1px, transparent 1px), linear-gradient(90deg, ${col} 1px, transparent 1px)`; c.backgroundSize='24px 24px'; },
  parallax: (v,c)=>{ c.transformStyle='preserve-3d'; c.perspective='1px'; c.height='100vh'; c.overflowX='hidden'; c.overflowY='auto'; const s=typeof v==='number'?v:2; nested(c, {selector:'& > *',styles:{transform:`translateZ(-1px) scale(${s})`}}); },
  viewTransition: (v,c)=>{ (c as any).viewTransitionName=typeof v==='string'?v:'auto'; },
  peerDim: (v,c)=>{
    const opacity = typeof v==='number'?v:(v?.opacity?? 0.6);
    const scale = v?.scale?? 1;
    const blur = v?.blur;
    if(!c.transition) c.transition='opacity.25s ease, transform.25s ease, filter.25s ease';
    nested(c, { selector: '.group:has(> :hover) > &:not(:hover)', styles: { opacity,...(scale!==1?{transform:`scale(${scale})`}:{}),...(blur?{filter:`blur(${blur})`}:{}) } });
  },
  hasCount: (v,c)=>{
    const rawCount = typeof v==='number'?v:(v?.count?? 3);
    const count = Math.max(1, Math.floor(Number(rawCount) || 3));
    let targetStyles: Record<string, any> = {};
    if (typeof v === 'object' && v!== null) {
      if (v.styles) targetStyles = {...v.styles};
      else { const { count: _,...rest } = v; targetStyles = rest; }
    }
    nested(c, { selector: `&:has(> :nth-child(${count}))`, styles: targetStyles });
  },
  entangleFocus: (_v,c)=>{ nested(c, { selector: '&:focus-within label, &:has(input:not(:placeholder-shown)) label', styles: { transform: 'translateY(-1.2rem) scale(0.85)', opacity: 1 } }); },
  groupHasHover: (v,c,useTokens)=>{ nested(c, { selector: '&:has(> :hover)', styles: getSubStyles(v,useTokens) }); }
};

const BUILTIN_MACROS = Object.freeze({...macros});
let customMacros: Record<string, MacroHandler> = {};

export function registerCustomShorthands(_custom: Record<string, string>, _allowOverride = false) {
  console.warn('[ChainCSS v3.0] shorthandMap removed, use box() or raw()');
}
export function registerCustomMacros(custom: Record<string, MacroHandler>, allowOverride = false) {
  for (const [k, fn] of Object.entries(custom || {})) {
    if (typeof fn!== 'function') continue;
    if (!allowOverride && (k in BUILTIN_MACROS || k in customMacros)) { console.warn(`[ChainCSS] macro '${k}' is reserved.`); continue; }
    customMacros[k] = fn; (macros as any)[k] = fn;
  }
}
export function resetToBuiltins() {
  for (const k of Object.keys(macros)) if(!(k in BUILTIN_MACROS)) delete (macros as any)[k];
  customMacros = {};
  Object.assign(macros, BUILTIN_MACROS);
  clearKeyframeCache();
}
export function getBuiltinShorthands() { return {}; }
export function getBuiltinMacros() { return {...BUILTIN_MACROS}; }

const ChainConfig = { silent: false, devMode: true };
export function safeExecute(macroName: string, fn: MacroHandler, v: any, c: any, t: boolean) {
  try { fn(v,c,t); } catch(e){ if(!ChainConfig.silent) console.error(`[ChainCSS] Macro '${macroName}' failed:`, e); }
}
export function handleShorthand(prop: string, value: any, catcher: any, useTokens = true): boolean {
  const macro = customMacros[prop] || (BUILTIN_MACROS as any)[prop];
  if (typeof macro === 'function') { safeExecute(prop, macro, value, catcher, useTokens); return true; }
  // shorthandMap is gone - fallback to raw prop
  return false;
}
export function isShorthand(prop: string): boolean { return prop in macros; }
export function expandShorthand(_prop: string): string | null { return null; }
export function getAvailableShorthands(): string[] { return [...Object.keys(macros)]; }