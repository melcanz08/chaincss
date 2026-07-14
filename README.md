# ChainCSS

[![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

📖 **[Full Documentation →](https://www.chaincss.dev/)**

**ChainCSS compiles `.chain.ts` files into static CSS** through a 5-stage pipeline. Write styles with a fluent TypeScript API — get zero-runtime CSS, built-in accessibility auditing, a live compiler inspector, design tokens, atomic CSS extraction, and deterministic replay of every transformation.

```bash
npm install chaincss
```

---

## Quick Start

### With Vite (Recommended)

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app && npm install chaincss
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import chaincss from 'chaincss/vite'

export default defineConfig({
  plugins: [chaincss(), react()]
})
```

Vite now handles CSS compilation, HMR, inspector injection (`/__chaincss.css`, `/@chaincss/client.js`), and `__chaincss-ir.json` export automatically.

### With CLI (Zero Config)

```bash
npx chaincss dev
```

```bash
npx chaincss dev --port 8080   # Custom port
npx chaincss build              # Build once (CI/CD)
npx chaincss build --watch      # Watch mode
```

```ts
// src/styles/button.chain.ts
import { chain } from 'chaincss'

export const btn = chain()
  .bg('#6366f1')
  .color('#ffffff')
  .padding('12px 24px')
  .rounded(8)
  .hover().bg('#4f46e5').end()
  .$el('button')
```

---

## The New Shorthand Methods (v2.12)

ChainCSS now ships with **structured shorthand methods** that group related CSS properties into single, typed calls. Each shorthand accepts an options object with full autocomplete and inline documentation.

### Core Shorthands

| Method | Covers | Example |
|:---|:---|:---|
| `.flex()` | `display:flex`, `flex-direction`, `align-items`, `justify-content`, `gap`, `grow`, `shrink`, `basis`, `wrap` | `.flex({ direction: 'column', align: 'center', gap: 16 })` |
| `.grid()` | `display:grid`, `grid-template-columns/rows`, `gap`, `area`, `auto-flow/columns/rows` | `.grid({ columns: '1fr 1fr', gap: 24 })` |
| `.box()` | `margin`, `padding`, `border`, `border-radius`, `width`, `height`, `overflow` | `.box({ padding: '24px', margin: '0 auto', maxWidth: 1200 })` |
| `.typography()` | `font-family/size/weight/style`, `line-height`, `letter-spacing`, `text-align/transform/decoration`, `color`, `opacity` | `.typography({ fontSize: 16, fontWeight: '600', color: '#333' })` |
| `.background()` | `background-color/image/position/size/repeat/attachment/origin/clip` | `.background({ color: '#fff', size: 'cover' })` |
| `.position()` | `position`, `top/right/bottom/left`, `inset`, `z-index` | `.position({ type: 'absolute', top: 0, left: 0, zIndex: 10 })` |
| `.animation()` | `animation-name/duration/timing/delay/iteration/direction/fill-mode` | `.animation({ name: 'fadeIn', duration: '300ms', timing: 'ease' })` |
| `.transform()` | `translate/translateX/Y/Z`, `scale/scaleX/Y`, `rotate`, `skew`, `origin` | `.transform({ scale: 1.1, custom: 'translateY(-2px)' })` |
| `.shadow()` | `box-shadow`, `text-shadow` (with decomposed x/y/blur/spread/color/inset) | `.shadow({ x: 0, y: 4, blur: 12, color: 'rgba(0,0,0,0.1)' })` |
| `.filter()` | `blur`, `brightness`, `contrast`, `grayscale`, `hue-rotate`, `invert`, `saturate`, `sepia`, `drop-shadow`, `backdrop-filter` | `.filter({ blur: 5, brightness: 1.1 })` |
| `.outline()` | `outline-width/style/color/offset` | `.outline({ width: '2px', style: 'solid', color: '#6366f1' })` |
| `.scroll()` | `scroll-behavior`, `scroll-snap-type/align/stop`, `scroll-margin/padding`, `scrollbar-width/color`, `overflow-x/y` | `.scroll({ behavior: 'smooth', snapType: 'x mandatory' })` |
| `.list()` | `list-style-type/position/image` | `.list({ style: 'none' })` |
| `.transition()` | `transition-property/duration/timing/delay/behavior` | `.transition({ property: 'all', duration: '200ms', timing: 'ease' })` |
| `.raw()` | Any CSS property not covered by a shorthand (accepts key-value or object form) | `.raw('cursor', 'pointer')` or `.raw({ cursor: 'pointer', resize: 'vertical' })` |

### Short Aliases (Power User Mode)

Every shorthand supports compact aliases for rapid prototyping:

```ts
chain()
  .flex({ d: 'col', ai: 'center', g: 16 })              // direction, align, gap
  .grid({ c: '1fr 1fr', g: 24 })                         // columns, gap
  .box({ p: '24px', m: '0 auto', w: '100%', mw: 1200 }) // padding, margin, width, maxWidth
  .typography({ fs: 16, fw: '600', c: '#333' })          // fontSize, fontWeight, color
  .background({ c: '#fff', s: 'cover' })                  // color, size
  .animation({ n: 'fadeIn', d: '300ms', t: 'ease' })     // name, duration, timing
  .shadow({ y: 4, blur: 12, c: 'rgba(0,0,0,0.1)' })     // y-offset, blur, color
  .$el('card')
```

### Backward Compatible

All existing flat methods (`.display()`, `.padding()`, `.fontSize()`, etc.) still work. The new shorthands are **additive** — mix and match freely:

```ts
chain()
  .display('flex')                     // Old way — still works
  .flex({ direction: 'column' })       // New shorthand
  .padding('24px')                     // Old way — still works
  .box({ maxWidth: 1200 })             // New shorthand
  .$el('hybrid')
```

### Dynamic Mode with Shorthands

All shorthand properties support `chain.dynamic()` with functions:

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

---

## The Killer Feature: Mixed Mode

Static properties compile to CSS at build time. Dynamic functions stay in JS — evaluated at runtime via CSS custom properties.

```ts
export const btn = chain.dynamic()
  .bg('#6366f1')                                    // → static CSS
  .opacity(() => isActive ? 1 : 0.5)                 // → runtime only
  .shadow(() => isActive ? '0 8px 25px rgba(16,185,129,0.6)' : '0 2px 8px rgba(0,0,0,0.3)')
  .$el('btn')
```

**Security note:** Dynamic values are applied via CSS custom properties using the browser's CSSOM (`element.style.setProperty()`). This is inherently safe against CSS injection — characters like `;`, `}`, and `{` have no special meaning in custom property values. See the [Security docs](https://www.chaincss.dev/docs/security) for details.

---

## Shorthands & Macros

ChainCSS shorthands are **real CSS properties**, not utilities. `bgc('#6366f1')` → `background-color: #6366f1` , `bg('linear-gradient(135deg, #818cf8, #a78bfa, #f472b6)')` → `background: linear-gradient(135deg, #818cf8, #a78bfa, #f472b6)` , `mt(12)` → `margin-top: 12px` , `pt(12)` → `padding-top: 12px`. All support tokens `$colors.primary` and hex without `#`.

### Shorthands

| Shorthand | CSS Property | Example |
|:---|:---|:---|
| `m` | `margin` | `.m(16)` → `16px` |
| `mt`, `mr`, `mb`, `ml` | `marginTop/Right/Bottom/Left` | `.mt(8)` |
| `mx`, `my` | `margin-inline: left+right` / `top+bottom` | `.mx('auto')` |
| `mi`, `mis`, `mie` | `marginInline`, `InlineStart`, `InlineEnd` | `.mi(16)` |
| `mbk`, `mbs`, `mbe` | `marginBlock`, `BlockStart`, `BlockEnd` |  |
| `p`, `pt`, `pr`, `pb`, `pl` | `padding*` | `.p('12px 24px')` |
| `px`, `py` | `padding left+right` / `top+bottom` | `.px(20)` |
| `pi`, `pis`, `pie`, `pbk`, `pbs`, `pbe` | `paddingInline/Block` logical |  |
| `mxi`, `myb`, `pxi`, `pyb` | logical axis shorthands |  |
| `w`, `h` | `width`, `height` | `.w(320)` |
| `is`, `bs` | `inlineSize`, `blockSize` | `.is('100%')` |
| `minW`, `maxW`, `minH`, `maxH` | `min/max-width/height` | `.maxW(1200)` |
| `minI`, `maxI`, `minB`, `maxB` | `min/max-inline/block-size` |  |
| `c`, `text` | `color` | `.c('ffffff')` works without `#` |
| `fs` | `fontSize` | `.fs(16)` |
| `fw` | `fontWeight` | `.fw(600)` |
| `ff`, `fontF` | `fontFamily` |  |
| `lh`, `ls` | `lineHeight`, `letterSpacing` |  |
| `ta`, `align` | `textAlign` |  |
| `tt`, `td`, `tw`, `ws`, `wb`, `wsb`, `va` | `textTransform`, `decoration`, `wrap`, `whiteSpace`, `wordBreak`, `wordSpacing`, `verticalAlign` |  |
| `d` | `display` | `.d('flex')` |
| `pos` | `position` |  |
| `z` | `zIndex` | `.z(50)` |
| `op` | `opacity` |  |
| `ov`, `ovx`, `ovy` | `overflow`, `X`, `Y` |  |
| `flexDir` | `flexDirection` |  |
| `flexWrap`, `grow`, `shrink`, `basis`, `order` | flex props |  |
| `jc`, `justify` | `justifyContent` |  |
| `ai`, `items` | `alignItems` |  |
| `ac`, `content` | `alignContent` |  |
| `ji`, `self` | `justifyItems`, `alignSelf` |  |
| `place`, `placeC`, `placeS` | `placeItems/Content/Self` |  |
| `gap`, `gapX`, `gapY` | `gap`, `columnGap`, `rowGap` |  |
| `gridCols`, `gridRows`, `gridRow`, `gridCol` | `gridTemplateColumns/Rows`, `gridRow/Column` |  |
| `rounded`, `br`, `radius` | `borderRadius` | `.rounded(8)` |
| `roundedTL`, `TR`, `BR`, `BL` | `borderTopLeftRadius` etc |  |
| `border`, `borderW`, `C`, `S`, `T`, `R`, `B`, `L` | border props |  |
| `shadow` | `boxShadow` |  |
| `bg`, `bgc`, `bgImg`, `bgPos`, `bgSize` | `background*` | `.bg('#6366f1')` |
| `objFit`, `objPos` | `objectFit/Position` |  |
| `transform`, `transformOrigin`, `transition` |  |  |
| `cursor`, `pointer` | `cursor` |  |
| `us` | `userSelect` |  |
| `pe` | `pointerEvents` |  |
| `ap`, `accent`, `caret` | `appearance`, `accentColor`, `caretColor` |  |
| `isolation`, `mixBlend`, `bgBlend` | blend modes |  |
| `will`, `contain`, `contentVis`, `backface` | performance |  |
| `scrollBehave`, `overscroll` | scroll |  |
| `list`, `listPos`, `col`, `colGap`, `hyphens`, `writing` | list & typography |  |

### Macros (30+ from `shorthands.ts` + `layout-macros.ts`)

| Macro | Result |
|:---|:---|
| `hide()` | `opacity: 0; visibility: hidden; pointer-events: none` |
| `show()` | `opacity: 1; visibility: visible; pointer-events: auto` |
| `glass(16px?)` | `background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.2); border-radius:16px` |
| `center()` | `display:flex; align-items:center; justify-content:center` |
| `container()` / `containerMacro(1200)` | `width:100%; max-width:1200px; margin-inline:auto; padding-inline:1rem` |
| `fullScreen(9999)` | `position:fixed; inset:0; z-index` |
| `square(40)`, `circle(40)` | `40px` square/circle + flex centering, circle = `border-radius:50%` |
| `size(40)` | `width+height: 40px` |
| `stickyHeader` | `position:sticky; top:0; z-index:50; backdrop-filter:blur(8px)` + scroll shadow |
| `card` | flex col, `radius:12px`, shadow, `hover{translateY(-2px)}` |
| `hero` | full-width centered, `min-h:60vh`, responsive |
| `sidebar` | `grid: 280px 1fr`, gap 32px, collapses @1024px |
| `gridList` | `repeat(auto-fit, minmax(280px,1fr))`, gap 24px |
| `autoGrid` | `repeat(auto-fit, minmax(min(280px,100%),1fr))` — no media queries |
| `bentoNative` | bento grid + `container-type:inline-size` + subgrid |
| `pricingRow` | `grid 3 cols / subgrid rows` + `&:has(> :hover) > :not(:hover){opacity:0.7}` |
| `pill()` | `border-radius:9999px; padding:6px 14px; inline-flex` |
| `truncate()` | `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` |
| `srOnly()` | screen-reader only, visually hidden |
| `pressable()` | `cursor:pointer; user-select:none` + active scale + hover opacity |
| `clickScale(0.97)` | `&:active{transform:scale}` |
| `hoverLift('4px')` | `transition + &:hover{translateY + shadow}` |
| `hoverGlow('#6366f1')` | `&:hover{box-shadow:0 0 20px #6366f140}` |
| `focusRing('#6366f1')` | `&:focus-visible{outline:2px solid; offset:2px}` |
| `onHover(cb)`, `onActive`, `focusVisible`, `onInteracting` | `&:hover`, `&:active`, `&:focus-visible` |
| `peerHover(cb)` | emits `.peer:hover ~ &` fallback + modern `.group:has(.peer:hover) &:not(.peer:hover)` |
| `peerDim({opacity:0.6, scale:0.98, blur:'2px'})` | `.group:has(> :hover) > &:not(:hover){opacity, scale, blur}` |
| `groupHasHover(cb)` | `&:has(> :hover)` — parent reacts to child hover, zero JS |
| `hasCount({count:3})` | `&:has(> :nth-child(3))` |
| `entangleFocus()` | floating label: `&:focus-within label, &:has(input:not(:placeholder-shown))` |
| `badge()`, `kbd()`, `dark(cb)`, `light(cb)` | UI primitives + `prefers-color-scheme` media |

---

## API at a Glance

```ts
chain()
  .bg('#6366f1')       // background
  .bg('6366f1')        // also works — hex without # now supported
  .fs(16)              // font-size: 16px
  .fw(600)
  .rounded(8)
  .p('12px 24px')
  .flex()
  .hide()              // → opacity: 0 (number)
  .show()              // → opacity: 1 (number)
  .glass()             // → rgba(255, 255, 255, 0.1)
  .hover().bg('red').end()
  .media('(min-width: 768px)', c => c.flexDirection('row'))
```

---

## Design Tokens & Design Orchestrator

Reference tokens with `$token.path` syntax. Resolved at build time.

```js
// chaincss.config.js
export default {
  shorthands: {}, // custom shorthands auto-registered + added to typo suggestions
  macros: {},     // custom macros auto-registered
  intents: {},    // custom intents auto-registered to intent-resolver + layout-macros
  allowOverride: true,
  tokens: {
    tokens: {
      colors: { primary: '#6C63FF', surface: '#1A1A2E' },
      spacing: { sm: '8px', md: '16px' }
    }
  }
}
```

```ts
chain()
  .bg('$colors.surface')
  .padding('$spacing.sm $spacing.md')
  .border('1px solid $colors.border')
```

---

## CLI Commands

```bash
npx chaincss init          # Scaffolds chaincss.config.js with shorthands/macros/intents + relationships
npx chaincss create app my-app --template entangled  # Entangled template (Figma live + token graph)
npx chaincss dev           # Dev server + live reload + auto-bundling + inspector
npx chaincss build         # Build CSS once
npx chaincss watch         # Watch and rebuild
npx chaincss check         # Accessibility audit (WCAG 2.2)
npx chaincss check --fix   # Auto-fix accessibility issues

# Entanglement & Audit
npx chaincss tokens:watch  # Watch tokens/global.json, propagate derived + contrast (topo sort + binary search)
npx chaincss tokens:fix    # One-shot fixAll() for all contrast relationships
npx chaincss figma sync    # Pull Figma Variables API or GitHub raw tokens
npx chaincss audit --theme ./tokens.json --contract ./theme.contract.ts --fail-on AA --target 4.5 --json ./a11y.json --strict
npx chaincss audit --fix                         # Suggest closest AA-passing colors (preserves hue via HSL L search)
npx chaincss audit --fix --write                 # Write fixes + entangled derived updates back to theme file
npx chaincss cache clear | stats | prune
npx chaincss timeline list | diff | export | clear
```

---

## `autoContrast()`

```ts
export function autoContrast(bgColor: string): string {
  // supports #rgb, #rrggbb, rgb(), hsl(), and hex WITHOUT #
  // WCAG relative luminance: 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b)
  // threshold 0.25 is between #777 (0.184) and #999 (0.318)
}
```

- Handles `'ffffff'` and `'fff'` without `#`
- Handles `'#777777'` → `#ffffff` (below 50% luminance) and `'#999999'` → `#000000` (above)
- Supports `rgb()`, `hsl()`, `var()` fallback to `#000000`
- `parseColor()` supports `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()`, named colors, `oklch` via orchestrator, and caching
- `importFigmaTokens()` — import Tokens Studio / Style Dictionary JSON
- `contrastRatio()`, `checkContrast()`, `auditContrast()`, `validateTokenRelationships()`

Theme Contracts validate at build time:

```ts
import { createThemeContract, createTheme } from 'chaincss'
const contract = createThemeContract({ colors: { primary: '', background: '' } })
export const lightTheme = createTheme(contract, { colors: { primary: '#6366f1', background: '#fff' } })
```

---

## Framework Support

All four frameworks verified with mixed mode end-to-end.

| Framework | Runtime Hook |
|-----------|:---|
| ⚛ React | `useChainStyles(styles, deps)` |
| 💚 Vue | `evalDynamicVars()` in `setup()` |
| 🧡 Svelte | Manual `render()` call |
| 🔷 SolidJS | `useChainStylesSolid` |

---

## 5-Stage Compiler Pipeline

| Stage | What Happens |
|-------|-------------|
| **1. Normalization** | Intent detection (mutable `SEMANTIC_INTENTS`), unit normalization, layout macros, custom shorthands from config auto-registered to `intent-data` + `intent-detector` |
| **2. Validation** | WCAG 2.2 checks, conflict detection, z-index validation |
| **3. Analysis** | Responsive patterns, layout recognition, dead code detection (Levenshtein with early-exit, O(1) `KNOWN_PROPERTIES` Set) |
| **4. Lowering** | Token resolution, constraint solving, `intent-resolver` with custom intents, CSS emission |
| **5. Optimization** | Compression, specificity sorting, media query packing, atomic extraction, prefixer |

---

## Live Compiler Inspector

The Vite plugin provides a live inspector at `/__chaincss-ir.json` with full compiler history, pipeline reports, and diagnostics. Press `Ctrl+Shift+I` on any ChainCSS-powered site to inspect compiler history.

---

## Accessibility Audit

```bash
npx chaincss check
npx chaincss audit --fix --write
```

WCAG 2.2 checks: contrast ratios (using cached `parseColor` + `relativeLuminance`), font-size minimums (12px+), touch target sizing (44x44px+), focus indicators, motion preferences.

---

## What Makes ChainCSS Different

| | ChainCSS | Styled Components | Vanilla Extract | Tailwind | Panda CSS |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Type** | Compiler | Library | Compiler | Compiler | Compiler |
| **Runtime cost** | 0KB | ~14KB | 0KB | 0KB | 0KB |
| **Dynamic styles** | ✅ Mixed mode | ✅ | ❌ | ❌ | ❌ |
| **Design tokens** | ✅ Built-in + Figma import | ❌ | ❌ | Config only | Config only |
| **Token Entanglement** | ✅ **Live graph** | ❌ | ❌ | ❌ | ❌ |
| **Derived tokens** | ✅ `mix-white 80%`, `shade 20%` auto | ❌ | ❌ | Manual | Manual |
| **Contrast auto-fix** | ✅ Preserves hue, HSL binary search | ❌ | ❌ | ❌ | ❌ |
| **Atomic CSS** | ✅ Opt-in | ❌ | ❌ | ✅ | ✅ |
| **Accessibility audit** | ✅ Built-in + auto-fix | ❌ | ❌ | ❌ | ❌ |
| **Compiler inspector** | ✅ Live | ❌ | ❌ | ❌ | ❌ |
| **Custom registries** | ✅ shorthands/macros/intents | ❌ | ❌ | ❌ | ❌ |
| **Structured shorthands** | ✅ `.flex()`, `.grid()`, `.box()`, etc. | ❌ | ❌ | ❌ | ❌ |

---

## Performance

| Scenario | Rules | Time | Output |
|:---|:---|:---|:---|
| Small | 5 | 0.5ms | 383B |
| Medium | 50 | 2.4ms | 11.5KB |
| Large | 500 | 23ms | 133KB |
| X-Large | 2,000 | 127ms | 530KB |

Cold start ~61ms. Compiler never ships to browser.

---

## What's New in v2.12

- **Structured shorthand methods** — `.flex()`, `.grid()`, `.box()`, `.typography()`, `.background()`, `.position()`, `.animation()`, `.transform()`, `.shadow()`, `.filter()`, `.outline()`, `.scroll()`, `.list()`, `.transition()` — each with full TypeScript types, short aliases, and dynamic mode support
- **`.raw()` escape hatch** — accepts key-value `.raw('prop', 'value')` or object `.raw({ prop: 'value', ... })` for any CSS property not covered by a shorthand
- **`Dynamic<T>` utility type** — all shorthand properties accept functions for `chain.dynamic()` mode with zero type errors
- **`ChainProxy` type export** — explicitly type media/supports/nest callbacks with `import { type ChainProxy } from 'chaincss'`
- **Vite plugin fixes** — watcher loop prevention (generated `.css`/`.class.js` files excluded, compiling deduplication), kebab-case keys quoted in dynamic exports
- **Build order fix** — `.d.ts` files now preserved alongside `.js` output
- **`hide()`/`show()`/`glass()`** — corrected return types and exact `rgba` strings
- **`autoContrast`** — supports hex without `#`, 3/6/8-char hex, `rgb()`, `hsl()`, threshold `0.25`
- **Entanglement Engine (v1.0)** — `TokenEntanglementEngine` with `contrast`/`derived`/`harmony` relationships, topological sort, HSL lightness binary search, Figma sync, `tokens:watch`/`tokens:fix`

---

## License

MIT

**Author:** Rommel Caneos [Contact Me](mailto:rec0608m@gmail.com)