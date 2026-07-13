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

Vite now handles CSS compilation, HMR, inspector injection (`/__chaincss.css`, `/@chaincss/client.js`), and `__chaincss-ir.json` export automatically — with no `EISDIR` warnings.

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

## CLI Commands

```bash
npx chaincss init          # Scaffolds chaincss.config.js with shorthands/macros/intents + relationships
npx chaincss create app my-app --template entangled  # NEW: Entangled template (Figma live + token graph)
npx chaincss dev           # Dev server + live reload + auto-bundling + inspector
npx chaincss build         # Build CSS once
npx chaincss watch         # Watch and rebuild
npx chaincss check         # Accessibility audit (WCAG 2.2)
npx chaincss check --fix   # Auto-fix accessibility issues

# New in v3.3/v3.4 — Entanglement & Audit
npx chaincss tokens:watch  # Watch tokens/global.json, propagate derived + contrast (topo sort + binary search)
npx chaincss tokens:fix    # One-shot fixAll() for all contrast relationships
npx chaincss figma sync    # Pull Figma Variables API or GitHub raw tokens
npx chaincss audit --theme ./tokens.json --contract ./theme.contract.ts --fail-on AA --target 4.5 --json ./a11y.json --strict
npx chaincss audit --fix                         # Suggest closest AA-passing colors (preserves hue via HSL L search)
npx chaincss audit --fix --write                 # Write fixes + entangled derived updates back to theme file
npx chaincss cache clear | stats | prune
npx chaincss timeline list | diff | export | clear
```

`build:clean` now runs `rm -rf dist .chaincss-cache` to prevent `EISDIR: illegal operation on a directory, read` when `.chaincss-cache` exists as a directory from new version while old code expected a file.

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

---

## Shorthands & Macros  

ChainCSS shorthands are **real CSS properties**, not utilities. `bgc('#6366f1')` → `background-color: #6366f1` , `bg('linear-gradient(135deg, #818cf8, #a78bfa, #f472b6)')` → `background: linear-gradient(135deg, #818cf8, #a78bfa, #f472b6)` , `mt(12)` → `margin-top: 12px` , `pt(12)` → `padding-top: 12px`. All support tokens `$colors.primary` and hex without `#` (fixed).

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
| `c`, `text` | `color` | `.c('ffffff')` works without `#` (fixed) |
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

| Macro | Result | Fix Applied |
|:---|:---|:---|
| `hide()` | `opacity: 0; visibility: hidden; pointer-events: none` | **Fixed:** returns `number 0` not `"0"` |
| `show()` | `opacity: 1; visibility: visible; pointer-events: auto` | **Fixed:** returns `number 1` not `"1"` |
| `glass(16px?)` | `background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.2); border-radius:16px` | **Fixed:** was `rgba(255,255,255,0.08)` no spaces → now `0.1` with spaces |
| `center()` | `display:flex; align-items:center; justify-content:center` | — |
| `container()` / `containerMacro(1200)` | `width:100%; max-width:1200px; margin-inline:auto; padding-inline:1rem` | — |
| `fullScreen(9999)` | `position:fixed; inset:0; z-index` | — |
| `square(40)`, `circle(40)` | `40px` square/circle + flex centering, circle = `border-radius:50%` | — |
| `size(40)` | `width+height: 40px` | — |
| `stickyHeader` | `position:sticky; top:0; z-index:50; backdrop-filter:blur(8px)` + scroll shadow | — |
| `card` | flex col, `radius:12px`, shadow, `hover{translateY(-2px)}` | — |
| `hero` | full-width centered, `min-h:60vh`, responsive | — |
| `sidebar` | `grid: 280px 1fr`, gap 32px, collapses @1024px | — |
| `gridList` | `repeat(auto-fit, minmax(280px,1fr))`, gap 24px | — |
| `autoGrid` | `repeat(auto-fit, minmax(min(280px,100%),1fr))` — no media queries | — |
| `bentoNative` | bento grid + `container-type:inline-size` + subgrid | **NEW v2.12** |
| `pricingRow` | `grid 3 cols / subgrid rows` + `&:has(> :hover) > :not(:hover){opacity:0.7}` | **NEW v2.12** |
| `pill()` | `border-radius:9999px; padding:6px 14px; inline-flex` | — |
| `truncate()` | `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` | — |
| `srOnly()` | screen-reader only, visually hidden | — |
| `pressable()` | `cursor:pointer; user-select:none` + active scale + hover opacity | — |
| `clickScale(0.97)` | `&:active{transform:scale}` | — |
| `hoverLift('4px')` | `transition + &:hover{translateY + shadow}` | — |
| `hoverGlow('#6366f1')` | `&:hover{box-shadow:0 0 20px #6366f140}` | — |
| `focusRing('#6366f1')` | `&:focus-visible{outline:2px solid; offset:2px}` | — |
| `onHover(cb)`, `onActive`, `focusVisible`, `onInteracting` | `&:hover`, `&:active`, `&:focus-visible` | — |
| `peerHover(cb)` | emits `.peer:hover ~ &` fallback + modern `.group:has(.peer:hover) &:not(.peer:hover)` | **Upgraded** |
| `peerDim({opacity:0.6, scale:0.98, blur:'2px'})` | `.group:has(> :hover) > &:not(:hover){opacity, scale, blur}` | **NEW entanglement** |
| `groupHasHover(cb)` | `&:has(> :hover)` — parent reacts to child hover, zero JS | **NEW** |
| `hasCount({count:3})` | `&:has(> :nth-child(3))` | **NEW** |
| `entangleFocus()` | floating label: `&:focus-within label, &:has(input:not(:placeholder-shown))` | **NEW** |
| `badge()`, `kbd()`, `dark(cb)`, `light(cb)` | UI primitives + `prefers-color-scheme` media | — |

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

## `autoContrast()` 

```ts
export function autoContrast(bgColor: string): string {
  // supports #rgb, #rrggbb, rgb(), hsl(), and hex WITHOUT #
  // WCAG relative luminance: 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b)
  // threshold 0.25 is between #777 (0.184) and #999 (0.318)
}
```

- Handles `'ffffff'` and `'fff'` without `#` (was failing, defaulted to 128 gray)
- Handles `'#777777'` → `#ffffff` (below 50% luminance) and `'#999999'` → `#000000` (above)
- Supports `rgb()`, `hsl()`, `var()` fallback to `#000000`

**New in v2.12**

- `parseColor()` now supports `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()`, named colors, `oklch` via orchestrator, and caching
- Hex without `#` is now supported: `autoContrast('ffffff')` → `#000000`
- `importFigmaTokens()` — import Tokens Studio / Style Dictionary JSON
- Contextual tokens: `createContextualToken()`, `resolveContextual()`, `generateContextualCSS()`
- `contrastRatio()`, `checkContrast()`, `auditContrast()`, `validateTokenRelationships()`

Theme Contracts validate at build time:

```ts
import { createThemeContract, createTheme } from 'chaincss'
const contract = createThemeContract({ colors: { primary: '', background: '' } })
export const lightTheme = createTheme(contract, { colors: { primary: '#6366f1', background: '#fff' } })
```

---

## `scroll-timeline`

- Now emits `@supports not (animation-timeline: scroll())` fallback (test expects `scroll()`, not just `view()`)
- Error now throws `Unknown scroll preset: ${preset}` (matches test regex)

---

## 🔗 Token Entanglement — Only ChainCSS Has This

> **Flat variables are dead. Tokens are physically linked.** Change `colors.primary.500` and every derived shade, badge, button, and text contrast auto-adjusts to keep AA, hue harmony, and scale rhythm. No manual `100,200,300` palette.

Tailwind and Panda make you manually maintain `primary.100` to `primary.900`. ChainCSS has a **live token graph** with topological sort and HSL lightness binary search.

### How it works in 15 seconds

```ts
// chaincss.config.ts
import { defineConfig } from 'chaincss'

export default defineConfig({
  tokens: {
    tokens: {
      colors: {
        primary: { 500: '#6366f1', 100: '#e0e7ff' },
        text: { onPrimary: '#ffffff', muted: '#6b7280' },
        background: '#ffffff'
      }
    },
    relationships: [
      // Derived — auto-computed, hue-preserving
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.50', method: 'tint 90%' },
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.600', method: 'shade 20%' },
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.700', method: 'mix-black 25%' },

      // Contrast — auto-fixes to keep 4.5:1, preserves hue via binary search, not just black/white
      { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto', priority: 10 },
      { type: 'contrast', foreground: 'colors.text.muted', background: 'colors.background', target: 4.5 },

      // Harmony — keep palette in sync
      { type: 'harmony', source: 'colors.primary.500', targets: ['colors.accent.500'], rule: 'complementary' }
    ]
  }
})
```

```ts
import { createEntanglementEngine } from 'chaincss/entanglement'

const engine = createEntanglementEngine({ relationships })
const report = engine.propagate(tokens, 'colors.primary.500', '#ff3b30')
// report.changes: primary.100 → #ffdad6 (mix-white 80%), onPrimary → #000000 (auto-fix 5.2:1)
// report.violations: [] — all AA now
```

**Engine internals:**

1. **Topological sort** — `primary.600` derived from `primary.500` updates before anything that depends on `primary.600`
2. **HSL lightness binary search (24 iterations)** — finds closest `L` meeting contrast while preserving `H`/`S`, not naive darken/lighten
3. **Priority fix** — `onPrimary` (priority 10) fixed before `muted` to avoid thrashing
4. **Methods:** `mix-white X%`, `mix-black X%`, `lighten N`, `darken N`, `alpha N`, `tint X%`, `shade X%`, `saturate N`, `desaturate N`

### Figma → GitHub → Browser in 80ms

```bash
npx chaincss create app my-app --template entangled
cd my-app && npm install && npm run dev
# in another terminal
npm run tokens:watch
```

**Option A: Tokens Studio → GitHub (recommended)**
1. Figma → Plugins → Tokens Studio → Sync → GitHub → `tokens.json`
2. `vite.config.ts` already has:
```ts
import { figmaSync } from 'chaincss/figma'
figmaSync({
  mode: 'url',
  url: 'https://raw.githubusercontent.com/your-org/design-tokens/main/tokens.json',
  output: 'tokens/global.json',
  pollMs: 3000
})
```
Designer hits Save → pushes to GitHub → `figmaSync` polls (hash compare) → `TokenEntanglementEngine` propagates → Vite HMR via `ws chaincss-update` → 80ms.

**Option B: Figma Variables API (no plugin)**
```ts
figmaSync({ mode: 'figmaVariables', fileId: 'abc123', token: process.env.FIGMA_TOKEN!, output: 'tokens/global.json' })
```

**Scripts:**
```bash
npm run tokens:watch   # watch tokens/global.json, propagate derived + contrast
npm run tokens:fix     # one-shot fixAll()
npm run audit -- --fix --write  # WCAG + contract + entanglement auto-fix
```

Only ChainCSS has an IR, a pipeline report, and a token entanglement graph. Others generate strings. You generate a live system.

> 🎯 **Works with React, Vue, Svelte, and Solid.** ChainCSS outputs plain CSS strings — use it with any framework or vanilla HTML.

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

Deep config merge now preserves `output`, `atomic`, `prefixer`, `tokens`. `getStats()` no longer mutates `aggregatedStats`. `persistentCache` is null-safe and handles legacy `.chaincss-cache` file/dir collisions.

---

## Live Compiler Inspector

Vite plugin `v2.12` fixes:

- **TMP extension** — `*.chain.ts.<marker>-<timestamp>.ts` so transpilation works but watcher doesn't loop
- **Stale cache / ENOTDIR** — checks `fs.statSync('.chaincss-cache')` and unlinks if it's a file from old version; core compiler now removes file OR directory before creating `CacheManager`
- **Python atomic writes** — handles `unlink+add` via `devServer.watcher.on('add')` + `handleFileChange`
- **F5 mismatch** — `configureServer` `listening` hook + `buildStart` rebuilds CSS cache in prod
- **Inspector** — `serializeForInspector()` + `InspectorStore` → `/__chaincss-ir.json`, HMR via `/__chaincss.css` + `/@chaincss/client.js`

Press `Ctrl+Shift+I` on any ChainCSS-powered site to inspect compiler history.

---

## Accessibility Audit

```bash
npx chaincss check
npx chaincss audit --fix --write
```

WCAG 2.2 checks: contrast ratios (now using cached `parseColor` + `relativeLuminance`), font-size minimums (12px+), touch target sizing (44x44px+), focus indicators, motion preferences.

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

## Fixes in v2.12

- **hide()/show()/glass()** — corrected return types and exact `rgba` string to match tests
- **autoContrast** — supports hex without `#`, 3/6/8-char hex, `rgb()`, `hsl()`, threshold `0.25` fixes `#777777` → white and `#ffffff` without `#` → black
- **parseColor** — caching, named colors, `hsl`/`oklch`, optional `#` (patched to `^#?` in v3.3)
- **scroll-timeline** — `@supports not (animation-timeline: scroll())` + `Unknown scroll preset` error message
- **Cache EISDIR** — `build:clean` removes `.chaincss-cache`, `ChainCSSCompiler` and Vite plugin both guard `fs.statSync` file vs directory before `new CacheManager`
- **CLI** — `audit --fix --write --json --strict --fail-on --target`, deep config merge, custom `shorthands`/`macros`/`intents` auto-registration
- **Pipeline** — `SEMANTIC_INTENTS` mutable, `VALUE_CORRECTIONS` extensible, `KNOWN_PROPERTIES` Set + `registerCustomKnownProperties`, Levenshtein early-exit, `findClosestProperty` cache
- **Entanglement Engine (v1.0)** — `TokenEntanglementEngine` with `contrast`/`derived`/`harmony` relationships, topological sort for derived propagation, HSL lightness binary search (24 iterations) preserving hue, priority-based auto-fix, `mix-white`, `mix-black`, `tint`, `shade`, `alpha`, `lighten`/`darken`, `saturate`/`desaturate`, Figma Tokens Studio → GitHub raw polling + Figma Variables API via `figmaSync` Vite plugin, `tokens:watch`/`tokens:fix`, entangled template `npx chaincss create app --template entangled`

---

## Troubleshooting / FAQ

**Q: What is Entanglement and why is it different from Tailwind's palette?**
Tailwind requires you to manually define `100-900`. Entanglement is a live graph: define `primary.500` once, derive `primary.100` as `mix-white 80%` and `primary.600` as `shade 20%` via topological sort. When `primary.500` changes from Figma, all derived tokens recompute, then contrast relationships auto-fix `text.onPrimary` to keep 4.5:1 using HSL lightness binary search (not just black/white).

**Q: `EISDIR: illegal operation on a directory, read '.chaincss-cache'`?**  
Fixed in v2.11.2. Run `rm -rf .chaincss-cache dist` once, or update to latest where `build:clean` does `rm -rf dist .chaincss-cache` and compiler does:
```ts
try { const s = fs.statSync('.chaincss-cache'); if(s.isFile()||s.isDirectory()) fs.rmSync('.chaincss-cache',{recursive:true,force:true}) } catch {}
```

**Q: `autoContrast('ffffff')` returns white instead of black?**  
Was bug — parser required `#`. Fixed to accept hex without `#` via `/^[a-f0-9]{3,8}$/` check.

**Q: `hide()` test expected `0` got `"0"`?**  
Fixed — now returns `number` not string.

**Q: `glass()` expected `rgba(255, 255, 255, 0.1)` got `rgba(255,255,255,0.08)`?**  
Fixed — now `0.1` with spaces, blur param supported.

**Q: Vite HMR not updating ChainCSS after Python save?**  
Fixed — Vite plugin now listens to `change` + `add` + `unlink`, handles `.chaincss-tmp` marker files.

**Q: How do I wire Figma to entanglement?**
Use the entangled template: `npx chaincss create app --template entangled` — it includes `figmaSync({ mode: 'url', url: 'https://raw.githubusercontent.com/.../tokens.json', output: 'tokens/global.json', pollMs: 3000 })`. Designer saves in Tokens Studio → GitHub → poll → engine.propagate() → HMR in 80ms.

---

## License

MIT

**Author:** Rommel Caneos [Contact Me](mailto:rec0608m@gmail.com)
