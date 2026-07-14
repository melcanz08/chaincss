# ChainCSS v2.13.0 — Comprehensive Tutorial

> **The CSS Intelligence Platform + Token Entanglement** — Write styles as TypeScript. Compiler-enforced quality. Figma → Browser in 80ms. Zero runtime.

[![npm](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![Vite](https://img.shields.io/badge/Vite-HMR-646cff)](#vite-plugin) [![Entangled](https://img.shields.io/badge/ChainCSS-Entangled-6366f1)](#-token-entanglement--only-chaincss-has-this)

📖 **[Full Docs →](https://www.chaincss.dev/)** | 🚀 **New:** Structured shorthand methods — `.flex()`, `.grid()`, `.box()`, `.typography()`, and more.

---

# Table of Contents

1. [Installation & Setup](#1-installation--setup)
2. [The Chain API](#2-the-chain-api)
3. [Structured Shorthand Methods — NEW v2.12](#3-structured-shorthand-methods--new-v212)
4. [Shorthands — 100+ Full Reference](#4-shorthands--100-full-reference)
5. [Macros — 30+ Full Reference](#5-macros--30-full-reference)
6. [Mixed Mode (Dynamic Styles)](#6-mixed-mode-dynamic-styles)
7. [Intent API](#7-intent-api)
8. [Semantic Tokens](#8-semantic-tokens)
9. [Responsive Design](#9-responsive-design)
10. [Conditional Styles](#10-conditional-styles)
11. [Nested Selectors & Mixins](#11-nested-selectors--mixins)
12. [Math Engine](#12-math-engine)
13. [Constraint-Based Styling](#13-constraint-based-styling)
14. [Design Tokens & Themes](#14-design-tokens--themes)
15. [Token Entanglement — Only ChainCSS](#15-token-entanglement--only-chaincss-has-this)
16. [Figma Live Sync](#16-figma-live-sync)
17. [Recipe System](#17-recipe-system)
18. [Animations](#18-animations)
19. [Scroll Timeline Engine](#19-scroll-timeline-engine)
20. [Self-Healing CSS](#20-self-healing-css)
21. [Compiler Intelligence](#21-compiler-intelligence)
22. [Accessibility Engine](#22-accessibility-engine)
23. [Source-Aware Optimization](#23-source-aware-optimization)
24. [CLI Commands](#24-cli-commands)
25. [Vite Plugin](#25-vite-plugin)
26. [Framework Integration](#26-framework-integration)
27. [Configuration](#27-configuration)
28. [Power Macros & Fixes](#28-power-macros--fixes)
29. [API Reference](#29-complete-api-reference)

---

# 1. Installation & Setup

## Install

```bash
npm install chaincss
# entangled template (recommended for new projects)
npx chaincss create app my-app --template entangled
cd my-app && npm install
```

## Vite Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import chaincss from 'chaincss/vite'
import { figmaSync } from 'chaincss/figma'

export default defineConfig({
  plugins: [
    chaincss({ atomic: true, minify: false, verbose: false }),
    figmaSync({
      mode: 'url',
      url: 'https://raw.githubusercontent.com/your-org/design-tokens/main/tokens.json',
      output: 'tokens/global.json',
      pollMs: 3000
    }),
    react()
  ]
})
```

**Vite plugin features:**
- **TMP extension** — avoids watcher loops on `.chain.ts` files
- **Stale cache handling** — guards against legacy `.chaincss-cache` file/directory collisions
- **Python atomic writes** — handles `unlink+add` editor patterns
- **Watcher loop prevention** — excludes generated `.css` and `.class.js` files from re-triggering compilation
- **Live inspector** — `/__chaincss-ir.json` with full compiler history
- **HMR** — `/__chaincss.css` + `/@chaincss/client.js` for instant style updates

## Quick Start

```ts
import { chain } from 'chaincss'

const styles = chain()
  .flex({ align: 'center', justify: 'space-between' })
  .box({ padding: '12px 20px', borderRadius: 12 })
  .background({ color: '#6366f1' })
  .typography({ fontSize: 16, fontWeight: '600', color: '#fff' })
  .pressable().hoverLift().peerDim({ opacity: 0.6 })
  .$el('card')
```

---

# 2. The Chain API

```ts
const card = chain()
  .flex({ direction: 'column', gap: 16 })
  .box({ padding: 24, borderRadius: 12 })
  .background({ color: 'white' })
  .shadow({ box: '0 2px 8px rgba(0,0,0,0.1)' })
  .$el('card')

// Multiple selectors, debug mode
chain().typography({ color: 'red' }).$el('h1','h2','h3')
chain().debug().explain()
chain().raw({ outline: 'none', resize: 'vertical', cursor: 'pointer' })
```

---

# 3. Structured Shorthand Methods — NEW v2.12

> The headline feature of v2.12. Grouped CSS properties in single, typed calls with full autocomplete, short aliases, and dynamic mode support.

## Why Structured Shorthands?

Instead of chaining 5-10 individual property calls, group related CSS into one method:

```ts
// Before (flat properties — still works)
chain()
  .display('flex')
  .flexDirection('column')
  .alignItems('center')
  .gap(16)
  .padding('24px')
  .margin('0 auto')
  .maxWidth(1200)
  .$el('container')

// After (structured shorthands — cleaner, typed, autocomplete)
chain()
  .flex({ direction: 'column', align: 'center', gap: 16 })
  .box({ padding: '24px', margin: '0 auto', maxWidth: 1200 })
  .$el('container')
```

## Complete Shorthand Reference

| Method | CSS Properties Covered | Example |
|:---|:---|:---|
| `.flex()` | `display:flex`, `flex-direction`, `align-items`, `justify-content`, `gap`, `grow`, `shrink`, `basis`, `wrap`, `align-content`, `align-self` | `.flex({ direction: 'column', align: 'center', gap: 16 })` |
| `.grid()` | `display:grid`, `grid-template-columns/rows`, `gap`, `grid-area`, `auto-flow/columns/rows`, `template` | `.grid({ columns: '1fr 1fr', gap: 24 })` |
| `.box()` | `margin` (all sides), `padding` (all sides), `border`, `border-radius`, `width`, `height`, `min/max-width/height`, `overflow` | `.box({ padding: '24px', margin: '0 auto', maxWidth: 1200 })` |
| `.typography()` | `font-family/size/weight/style`, `line-height`, `letter-spacing`, `text-align/transform/decoration`, `color`, `opacity`, `word-spacing`, `white-space`, `word-break` | `.typography({ fontSize: 16, fontWeight: '600', color: '#333' })` |
| `.background()` | `background-color/image/position/size/repeat/attachment/origin/clip/blend-mode` | `.background({ color: '#fff', size: 'cover' })` |
| `.position()` | `position`, `top/right/bottom/left`, `inset`, `z-index` | `.position({ type: 'absolute', top: 0, left: 0, zIndex: 10 })` |
| `.animation()` | `animation-name/duration/timing/delay/iteration-count/direction/fill-mode/play-state` | `.animation({ name: 'fadeIn', duration: '300ms', timing: 'ease' })` |
| `.transform()` | `translate/translateX/Y/Z`, `scale/scaleX/Y`, `rotate`, `skew/skewX/Y`, `origin`, `custom` | `.transform({ scale: 1.1, custom: 'translateY(-2px)' })` |
| `.shadow()` | `box-shadow` (decomposed: x/y/blur/spread/color/inset), `text-shadow` | `.shadow({ x: 0, y: 4, blur: 12, color: 'rgba(0,0,0,0.1)' })` |
| `.filter()` | `blur`, `brightness`, `contrast`, `grayscale`, `hue-rotate`, `invert`, `saturate`, `sepia`, `drop-shadow`, `backdrop-filter`, `custom` | `.filter({ blur: 5, brightness: 1.1 })` |
| `.outline()` | `outline-width/style/color/offset` | `.outline({ width: '2px', style: 'solid', color: '#6366f1' })` |
| `.scroll()` | `scroll-behavior`, `scroll-snap-type/align/stop`, `scroll-margin/padding` (all sides), `scrollbar-width/color`, `overflow-x/y` | `.scroll({ behavior: 'smooth', snapType: 'x mandatory' })` |
| `.list()` | `list-style-type/position/image` | `.list({ style: 'none' })` |
| `.transition()` | `transition-property/duration/timing/delay/behavior` | `.transition({ property: 'all', duration: '200ms', timing: 'ease' })` |
| `.raw()` | Any CSS property not covered above (key-value or object form) | `.raw('cursor', 'pointer')` or `.raw({ cursor: 'pointer', resize: 'vertical' })` |

## Short Aliases (Power User Mode)

Every shorthand supports compact single-letter or two-letter aliases:

```ts
chain()
  .flex({ d: 'col', ai: 'center', g: 16 })              // direction, align-items, gap
  .grid({ c: '1fr 1fr', g: 24 })                         // columns, gap
  .box({ p: '24px', m: '0 auto', w: '100%', mw: 1200 }) // padding, margin, width, maxWidth
  .typography({ fs: 16, fw: '600', c: '#333' })          // fontSize, fontWeight, color
  .background({ c: '#fff', s: 'cover' })                  // color, size
  .animation({ n: 'fadeIn', d: '300ms', t: 'ease' })     // name, duration, timing
  .transition({ tr: 'all 0.2s ease' })                    // transition shorthand
  .shadow({ y: 4, blur: 12, c: 'rgba(0,0,0,0.1)' })     // y-offset, blur, color
  .$el('card')
```

## Backward Compatible

All existing flat methods still work. Mix and match freely:

```ts
chain()
  .display('flex')                     // Old way — still works
  .flex({ direction: 'column' })       // New shorthand
  .padding('24px')                     // Old way — still works
  .box({ maxWidth: 1200 })             // New shorthand
  .$el('hybrid')
```

## No-Argument Macros Still Work

```ts
chain().flex()   // → display: flex (macro behavior)
chain().grid()   // → display: grid (macro behavior)
```

---

# 4. Shorthands — 100+ Full Reference

> From `src/compiler/utils/shorthands.ts` — real CSS props, not utilities. All support tokens `$colors.primary`.

### Spacing
| Shorthand | CSS | Example |
|---|---|---|
| `m` | `margin` | `.m(16)` |
| `mt,mr,mb,ml` | `marginTop/Right/Bottom/Left` | `.mt(8)` |
| `mx,my` | `marginLeft+Right` / `Top+Bottom` | `.mx('auto')` |
| `mi,mis,mie` | `marginInline, InlineStart/End` | RTL-ready |
| `mbk,mbs,mbe` | `marginBlock, BlockStart/End` |  |
| `p,pt,pr,pb,pl` | `padding*` |  |
| `px,py` | `padding X/Y axis` | `.px(20)` |
| `pi,pis,pie,pbk,pbs,pbe` | `paddingInline/Block` logical |  |
| `mxi,myb,pxi,pyb` | logical axis shorthands |  |

### Sizing & Layout
`w,h,is,bs,minW,maxW,minH,maxH,minI,maxI,minB,maxB,size,d,pos,z,op,ov,ovx,ovy`

### Typography
`c,text,fs,fw,ff,fontF,lh,ls,ta,align,tt,td,tw,ws,wb,wsb,va`

### Flex / Grid
`flexDir,flexWrap,grow,shrink,basis,order,jc,justify,ai,items,ac,content,ji,self,place,placeC,placeS,gap,gapX,gapY,gridCols,gridRows,gridRow,gridCol`

### Borders / Radius / Shadows
`rounded,br,radius,roundedTL,roundedTR,roundedBR,roundedBL,border,borderW,borderC,borderS,borderT,R,B,L,shadow,textShadow`

### Background & Effects
`bg,bgc,bgImg,bgPos,bgSize,objFit,objPos,filter,backdropFilter,transform,transformOrigin,transition,transitionAll`

### Interactivity & Misc
`cursor,pointer,us,pe,ap,accent,caret,isolation,mixBlend,bgBlend,will,contain,contentVis,backface,scrollBehave,overscroll,list,listPos,col,colGap,hyphens,writing`

All support: `.bg('$colors.primary.500')`, `.p('$spacing.md')`, `.border('1px solid $colors.border')`

---

# 5. Macros — 30+ Full Reference

### Layout Macros

| Macro | Output |
|---|---|
| `hide()` | `opacity:0; visibility:hidden; pointer-events:none` |
| `show()` | `opacity:1; visibility:visible; pointer-events:auto` |
| `glass(16?)` | `rgba(255,255,255,0.1); backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.2)` |
| `center()` | `display:flex; align-items:center; justify-content:center` |
| `container()/containerMacro(1200)` | `width:100%; max-width:1200px; margin-inline:auto; padding-inline:1rem` |
| `fullScreen(9999)` | `position:fixed; inset:0; z-index` |
| `square(40),circle(40),size(40)` | square/circle + flex centering |
| `stickyHeader` | `sticky top 0, z-50, blur(8px)` + scroll shadow |
| `card` | flex col, radius 12px, shadow, hover lift `translateY(-2px)` |
| `hero` | full-width centered `min-h:60vh` |
| `sidebar` | `grid:280px 1fr`, collapses @1024px |
| `gridList,autoGrid` | `repeat(auto-fit,minmax(280px,1fr))` |
| `bentoNative` | bento grid + `container-type:inline-size` + subgrid |
| `pricingRow` | `grid 3 cols / subgrid rows` + `&:has(> :hover) > :not(:hover){opacity:0.7}` |
| `truncate(),srOnly(),pill()` | ellipsis, a11y hidden, pill |

### Entanglement Native Macros — Zero JS

| Macro | Result |
|---|---|
| `pressable()` | `cursor:pointer; user-select:none` + `active:scale(0.97)` + `hover:opacity:0.85` |
| `clickScale(0.97),hoverLift('4px'),hoverGlow('#6366f1'),focusRing()` | interaction primitives |
| `onHover(cb),onActive,focusVisible,onInteracting` | `&:hover`, `&:active`, `&:focus-visible` |
| `peerHover(cb)` | emits `.peer:hover ~ &` fallback + modern `.group:has(.peer:hover) &:not(.peer:hover)` |
| `peerDim({opacity:0.6,scale:0.98,blur:'2px'})` | `.group:has(> :hover) > &:not(:hover){...}` |
| `groupHasHover(cb)` | `&:has(> :hover)` parent reacts to child |
| `hasCount({count:3})` | `&:has(> :nth-child(3))` |
| `entangleFocus()` | floating label: `&:focus-within label, &:has(input:not(:placeholder-shown))` |
| `children,childHover` | `& > *`, `&:hover > *` |
| `badge(),kbd(),dark(cb),light(cb)` | UI primitives + `prefers-color-scheme` |

---

# 6. Mixed Mode (Dynamic Styles)

Static properties compile to CSS at build time. Dynamic functions stay in JS — evaluated at runtime via CSS custom properties.

```ts
export const btn = chain.dynamic()
  .box({ padding: '12px 24px', borderRadius: 8 })
  .background({ color: () => isActive ? '#6366f1' : '#a5b4fc' })
  .shadow({ 
    box: () => isActive 
      ? '0 8px 25px rgba(99,102,241,0.4)' 
      : '0 2px 8px rgba(0,0,0,0.1)'
  })
  .typography({ color: '#fff', fontWeight: '600' })
  .$el('btn')
```

**Security:** Dynamic values are applied via CSS custom properties using the browser's CSSOM (`element.style.setProperty()`). This is inherently safe against CSS injection — characters like `;`, `}`, and `{` have no special meaning in custom property values. Static CSS values are sanitized against `</style>` breakout. See the [Security docs](https://www.chaincss.dev/docs/security) for details.

**TypeScript:** All shorthand properties use the `Dynamic<T>` utility type, so functions work without type errors in `chain.dynamic()` mode.

---

# 7. Intent API

```ts
chain().intent('center-content').$el('centered')
chain().intent('card').$el('card')
chain().intent('sticky-header').$el('nav')
chain().intent('hover-lift').$el('interactive')
```

Custom intents auto-registered from `chaincss.config.js`.

---

# 8. Semantic Tokens

```ts
chain().surface('interactive').text('primary').elevation('floating').$el('composed')
```

---

# 9. Responsive Design

```ts
chain()
  .flex({ direction: 'column' })
  .media('(min-width: 768px)', (c: ChainProxy) => c.flex({ direction: 'row' }))
  .$el('responsive')

chain().container('(min-width:400px)', (c: ChainProxy) => c.grid({ columns: '1fr 1fr' })).$el('cq')
```

> **TypeScript tip:** Import `ChainProxy` for typed media callbacks: `import { type ChainProxy } from 'chaincss'`

---

# 10. Conditional Styles

```ts
chain()
  .box({ padding: 12 })
  .when(isActive, (c: ChainProxy) => c.background({ color: '#10b981' }).typography({ color: 'white' }))
  .when(isDisabled, (c: ChainProxy) => c.raw('opacity', '0.5').raw('cursor', 'not-allowed'))
  .$el('stateful-btn')
```

---

# 11. Nested Selectors & Mixins

```ts
chain()
  .flex({ gap: 0 })
  .nest('& > *', (c: ChainProxy) => c.flex({ grow: 1 }))
  .nest('&:first-child', (c: ChainProxy) => c.typography({ fontWeight: '700' }))
  .$el('flex-container')
```

---

# 12. Math Engine

```ts
import { add, subtract, multiply, divide, fluidType } from 'chaincss'
add('10px','20px'); fluidType({minSize:14,maxSize:20})
```

---

# 13. Constraint-Based Styling

```ts
chain().constrain('width','< parent').constrain('height','= width * 0.5').$el('card')
```

---

# 14. Design Tokens & Themes

```ts
import { createTokens, createThemeContract, createTheme } from 'chaincss'
import { parseColor, contrastRatio, checkContrast, importFigmaTokens } from 'chaincss/tokens'

const tokens = createTokens({ colors:{ primary:'#6366f1' }, spacing:{ sm:'8px' } })
const contract = createThemeContract({ colors:{ primary:'', background:'' } })
const light = createTheme(contract, { colors:{ primary:'#6366f1', background:'#fff' } })

// Figma Tokens Studio import
const figma = { colors:{ primary:{ 500:{ value:'#6366f1' } } } }
const imported = importFigmaTokens(figma) // → { colors:{ primary:{ 500:'#6366f1' } } }
contrastRatio('#ffffff','#6366f1') // 4.5+
checkContrast('white','black') // { ratio, passes:{AA,AAA} }
```

---

# 15. Token Entanglement — Only ChainCSS Has This

> Flat variables are dead. Tokens are physically linked.

```ts
// chaincss.config.ts
import { defineConfig } from 'chaincss'
export default defineConfig({
  tokens:{
    tokens:{ colors:{ primary:{500:'#6366f1',100:'#e0e7ff'}, text:{onPrimary:'#fff',muted:'#6b7280'}, background:'#fff' } },
    relationships:[
      { type:'derived', source:'colors.primary.500', target:'colors.primary.100', method:'mix-white 80%' },
      { type:'derived', source:'colors.primary.500', target:'colors.primary.600', method:'shade 20%' },
      { type:'contrast', foreground:'colors.text.onPrimary', background:'colors.primary.500', target:4.5, autoFix:'auto', priority:10 },
      { type:'harmony', source:'colors.primary.500', targets:['colors.accent.500'], rule:'complementary' }
    ]
  }
})
```

```ts
import { createEntanglementEngine } from 'chaincss/entanglement'
const engine = createEntanglementEngine({ relationships })
const report = engine.propagate(tokens, 'colors.primary.500', '#ff3b30')
// changes: primary.100 → #ffdad6, onPrimary → #000000 (5.2:1), violations: []
```

**Engine internals:** Topological sort, HSL lightness binary search (24 iterations preserving hue), priority fix ordering.

---

# 16. Figma Live Sync

```bash
npx chaincss create app my-app --template entangled
npm run dev
npm run tokens:watch
```

Designer saves → Tokens Studio → GitHub → `figmaSync` polls → `TokenEntanglementEngine` propagates → HMR in 80ms.

---

# 17. Recipe System

```ts
import { recipe } from 'chaincss'
const button = recipe({
  base:{ selectors:['btn'], display:'inline-flex', borderRadius:'8px' },
  variants:{ size:{ sm:{padding:'8px 16px'}, lg:{padding:'16px 32px'} } }
})
```

---

# 18. Animations

```ts
chain().fadeIn().slideInUp().zoomIn().bounce().pulse().spin().$el('el')
chain().animate('myBounce', { '0%':{transform:'scale(1)'}, '50%':{transform:'scale(1.2)'} }, {duration:'0.5s'}).$el('anim')
```

---

# 19. Scroll Timeline Engine

```ts
import { createScrollAnimation } from 'chaincss'
const fadeIn = createScrollAnimation('fadeIn','.reveal')
```

- Emits `@supports not (animation-timeline: scroll())` fallback
- 7 scroll presets

---

# 20. Self-Healing CSS

```ts
import { correct, heal } from 'chaincss'
correct('display','flexbox') // → flex
heal({display:'flexbox',position:'abs'},'smart')
```

---

# 21. Compiler Intelligence

The 5-stage pipeline detects mobile overflow, infers responsive breakpoints, flags inaccessible fonts, and optimizes layout patterns automatically.

---

# 22. Accessibility Engine

| Check | WCAG | Auto Fix |
|---|---|---|
| Contrast ratio | 1.4.3 AA | **Yes — HSL binary search preserves hue** |
| Font size | 1.4.4 AA | Yes |
| Touch target | 2.5.8 AA | Yes |
| Focus indicator | 2.4.7 AA | Yes |

```bash
npx chaincss check
npx chaincss audit --fix --write
```

---

# 23. Source-Aware Optimization

Detects duplicate, dead CSS, specificity wars, animation conflicts, redundant media queries. `atomic` extraction opt-in.

---

# 24. CLI Commands

```bash
npx chaincss init          # Scaffolds config
npx chaincss create app my-app --template entangled
npx chaincss dev           # Dev server + HMR + inspector
npx chaincss build         # Build once
npx chaincss watch
npx chaincss check         # WCAG 2.2 audit
npx chaincss check --fix
npx chaincss tokens:watch  # Watch + propagate tokens
npx chaincss tokens:fix    # One-shot fixAll()
npx chaincss figma sync    # Pull from Figma/GitHub
npx chaincss audit --fix --write
npx chaincss cache clear | stats | prune
npx chaincss timeline list | diff | export | clear
```

---

# 25. Vite Plugin

**Features in v2.12:**
- TMP file strategy to avoid watcher loops
- Generated `.css` and `.class.js` files excluded from re-triggering compilation
- Deduplication of concurrent compilations via `compiling` Set + 500ms debounce
- Live inspector at `/__chaincss-ir.json`
- HMR via `/__chaincss.css` + `/@chaincss/client.js`
- Proper `.d.ts` output preserved alongside `.js` bundles

Press `Ctrl+Shift+I` to inspect compiler history.

---

# 26. Framework Integration

React, Vue, Svelte, Solid — ChainCSS outputs plain CSS strings.

```tsx
function Card({children}){
  const s = chain().flex({ direction: 'column' }).box({ padding: 24 }).$el('card');
  return <div className={s.selectors[0]}>{children}</div>
}
```

---

# 27. Configuration

```ts
// chaincss.config.ts
import { defineConfig } from 'chaincss'
export default defineConfig({
  shorthands:{}, macros:{}, intents:{}, allowOverride: true,
  inputs:['src/**/*.chain.{js,ts}','src/**/*.tsx'],
  output:{ cssFile:'dist/styles.css', minify:false },
  atomic:{ enabled:true, naming:'readable' },
  a11y:{ pairs:[{ foreground:'colors.text', background:'colors.background', label:'body' }] },
  tokens:{
    relationships:[
      { type:'derived', source:'colors.primary.500', target:'colors.primary.100', method:'mix-white 80%' },
      { type:'contrast', foreground:'colors.text.onPrimary', background:'colors.primary.500', target:4.5 }
    ]
  }
})
```

---

# 28. Power Macros & Fixes

Highlights from v2.12:

- **Structured shorthands** — `.flex()`, `.grid()`, `.box()`, `.typography()`, `.background()`, `.position()`, `.animation()`, `.transform()`, `.shadow()`, `.filter()`, `.outline()`, `.scroll()`, `.list()`, `.transition()`, `.raw()`
- **Dynamic mode fully typed** — `Dynamic<T>` utility so `chain.dynamic()` never throws type errors
- **`ChainProxy` exported** — `import { type ChainProxy } from 'chaincss'` for typed callbacks
- **Watcher loop fixed** — generated files excluded, concurrent compilation deduplicated
- **Build order fixed** — `.d.ts` files preserved alongside `.js`
- **`raw()` object form** — `.raw({ outline: 'none', resize: 'vertical' })`
- **`hide()/show()/glass()`** — corrected return types and `rgba` strings
- **`autoContrast('ffffff')`** — works without `#`

```ts
chain()
  .flex({ align: 'center', justify: 'space-between' })
  .box({ padding: '12px 20px', borderRadius: 12 })
  .background({ color: '$colors.surface' })
  .typography({ fontSize: 14, fontWeight: '600', color: '#fff' })
  .shadow({ box: '0 4px 12px rgba(0,0,0,0.1)' })
  .pressable().hoverLift().peerDim({opacity:0.6,blur:'1px'})
  .dark((c: ChainProxy) => c.background({ color: '#0a0a0a' }).typography({ color: '#e5e5e5' }))
  .$el('card')
```

---

# 29. Complete API Reference

```ts
import {
  chain, type ChainProxy, type StyleObject,
  $, smartChain,
  intentAPI, resolveIntent, getAvailableIntents,
  semanticTokens, resolveSemantic,
  math, add, subtract, multiply, divide, fluidType, convert, scale,
  constraintSolver,
  intent, correct, heal, validateValue,
  scrollTimeline, createScrollAnimation, compileScrollAnimation, getScrollPresets,
  accessibilityEngine, auditAccessibility,
  sourceOptimizer,
  orchestrator, contrastRatio, checkContrast, auditContrast, validateTokenRelationships, parseColor, importFigmaTokens, createContextualToken,
  createThemeContract, createTheme,
  recipe,
  shorthandMap, macros, handleShorthand, registerCustomShorthands, registerCustomMacros,
  createEntanglementEngine,
  figmaSync,
  ChainCSSCompiler, compileChainCSS
} from 'chaincss'
```

---

## Compiler Pipeline

```
Chain API → Parser → Style IR → Normalization (mutable intents, custom shorthands)
→ Validation (WCAG 2.2, cached parseColor) → Analysis (Levenshtein early-exit)
→ Lowering (token resolution, entanglement propagation, intent-resolver)
→ Optimization (atomic, prefixer) → CSS Generation → Output + /__chaincss-ir.json
```

---

## Feature Summary v2.12

| Feature | Count | Note |
|---|---|---|
| Structured Shorthands | 15 | `.flex()`, `.grid()`, `.box()`, `.typography()`, etc. |
| Flat Shorthands | 100+ | logical props mi/mis/mie/mbk/mbs/mbe/pi/pis/pie/pbk/pbs/pbe |
| Macros | 32+ | + peerDim, groupHasHover, hasCount, entangleFocus, bentoNative, pricingRow |
| Intents | 22+ custom | auto-registered |
| Token Relationships | 3 types | derived, contrast, harmony |
| Figma Sync Modes | 2 | url (Tokens Studio GitHub), figmaVariables API |
| Scroll Presets | 7 | @supports not (animation-timeline: scroll()) |
| CLI Commands | 11 | + audit, tokens:watch/fix, figma sync, create --template entangled |
| WCAG Checks | 6+ | contrast auto-fix preserves hue |
| Dynamic Type Safety | ✅ | `Dynamic<T>` utility type |

---

<p align="center"><strong>⛓ ChainCSS v2.12.0</strong><br><em>The CSS Intelligence Platform + Entanglement</em><br>15 structured shorthands · 100+ flat shorthands · 32+ macros · Token Graph · Figma Live · Zero runtime · WCAG auto-fix</p>