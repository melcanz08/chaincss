# ChainCSS — The Design-Aware CSS Compiler

[![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

📖 **[Full Documentation →](https://www.chaincss.dev/)**

**ChainCSS is a design-aware CSS compiler.** Tokens know their relationships. Styles understand intent. Change one color in Figma — every derived shade, hover state, and contrast ratio updates automatically.

```bash
npm install chaincss
```

---

## What Makes ChainCSS Different

Most CSS tools treat styles as isolated declarations. ChainCSS treats them as a connected system.

### 🧬 Token Dependency Graph

Tokens aren't flat variables. They're a graph. Change `primary.500` and every derived shade, hover state, border, and text contrast propagates automatically.

```ts
// Define relationships once
tokens: {
  relationships: [
    { type: 'derived', source: 'primary.500', target: 'primary.100', method: 'mix-white 80%' },
    { type: 'contrast', foreground: 'text.onPrimary', background: 'primary.500', target: 4.5 },
  ]
}
```

Designer changes `primary.500` in Figma → 20+ tokens recompute → HMR in 80ms. **No manual palette updates.**

### ♿ Accessibility-Aware Compilation

ChainCSS doesn't just detect contrast failures — it fixes them. Preserves hue, adjusts lightness via binary search, rewrites the token. WCAG 2.2 compliance as a build step.

```bash
npx chaincss audit --fix --write
```

### 🔗 Relationship Macros

Don't write complex selectors. Express intent.

| Instead of | Write |
|---|---|
| `.group:has(> :hover) > &:not(:hover)` | `.peerDim()` |
| `&:has(> :nth-child(3))` | `.hasCount({ count: 3 })` |
| `&:focus-within label, &:has(input:not(:placeholder-shown)) label` | `.entangleFocus()` |
| `.group:has(.peer:hover) &:not(.peer:hover)` | `.peerHover(cb)` |

32+ macros that generate CSS relationships, not just properties.

### 🎯 Mixed Mode — Static + Dynamic in One Declaration

Static properties compile to CSS at build time. Dynamic functions run at runtime via CSS custom properties. One API. Zero compromises.

```ts
export const btn = chain.dynamic()
  .background({ color: '#6366f1' })                          // → static CSS
  .shadow({ box: () => isActive ? '0 8px 25px rgba(...)' : '0 2px 8px rgba(...)' })  // → runtime
  .$el('btn')
```

### 🔍 Live Compiler Inspector

Inspect every stage of the 5-stage pipeline: Normalization → Validation → Analysis → Lowering → Optimization. Press `Ctrl+Shift+I` on any ChainCSS site.

---

## Quick Start

### With Vite (30 seconds)

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app && npm install chaincss
```

```ts
// vite.config.ts
import chaincss from 'chaincss/vite'

export default defineConfig({
  plugins: [chaincss(), react()],
})
```

```ts
// src/styles/button.chain.ts
import { chain } from 'chaincss'

export const btn = chain()
  .background({ color: '#6366f1' })
  .typography({ color: '#ffffff', fontWeight: '600' })
  .box({ padding: '12px 24px', borderRadius: 8 })
  .hover().background({ color: '#4f46e5' }).end()
  .$el('button')
```

---

## Structured Shorthand Methods

Group related CSS properties into single, typed calls with full autocomplete.

| Method | Covers | Example |
|:---|:---|:---|
| `.flex()` | `display:flex`, `flex-direction`, `align-items`, `justify-content`, `gap`, `grow`, `shrink` | `.flex({ direction: 'column', align: 'center', gap: 16 })` |
| `.grid()` | `display:grid`, `grid-template-columns/rows`, `gap`, `area`, `auto-flow` | `.grid({ columns: '1fr 1fr', gap: 24 })` |
| `.box()` | `margin`, `padding`, `border`, `border-radius`, `width`, `height`, `overflow` | `.box({ padding: '24px', margin: '0 auto', maxWidth: 1200 })` |
| `.typography()` | `font-family/size/weight`, `line-height`, `letter-spacing`, `text-align`, `color` | `.typography({ fontSize: 16, fontWeight: '600', color: '#333' })` |
| `.background()` | `background-color/image/position/size/repeat` | `.background({ color: '#fff', size: 'cover' })` |
| `.position()` | `position`, `top/right/bottom/left`, `z-index` | `.position({ type: 'absolute', top: 0, zIndex: 10 })` |
| `.shadow()` | `box-shadow`, `text-shadow` (decomposed: x/y/blur/spread/color) | `.shadow({ y: 4, blur: 12, color: 'rgba(0,0,0,0.1)' })` |
| `.raw()` | Any CSS property not covered above | `.raw({ cursor: 'pointer', resize: 'vertical' })` |

**Short aliases for power users:**

```ts
chain()
  .flex({ d: 'col', ai: 'center', g: 16 })              // direction, align, gap
  .box({ p: '24px', m: '0 auto', w: '100%' })           // padding, margin, width
  .typography({ fs: 16, fw: '600', c: '#333' })          // fontSize, fontWeight, color
  .$el('card')
```

---

## 32+ Macros — CSS Relationships, Not Just Properties

| Category | Macros |
|---|---|
| **Layout** | `center()`, `gridList()`, `autoGrid()`, `bentoNative()`, `pricingRow()`, `hero()`, `sidebar()` |
| **Interaction** | `pressable()`, `hoverLift()`, `hoverGlow()`, `focusRing()`, `clickScale()` |
| **Entanglement** | `peerDim()`, `peerHover()`, `groupHasHover()`, `hasCount()`, `entangleFocus()` |
| **Visual** | `glass()`, `frosted()`, `glow()`, `innerGlow()`, `textGradient()`, `meshGradient()` |
| **Animation** | `skeleton()`, `shimmer()`, `float()`, `spin()`, `pulse()`, `bounce()`, `marquee()` |
| **Utility** | `hide()`, `show()`, `truncate()`, `srOnly()`, `pill()`, `badge()`, `kbd()` |

---

## Design Tokens + Entanglement

```bash
npx chaincss create app my-app --template entangled
npm run tokens:watch  # Figma → GitHub → tokens.json → propagate → HMR 80ms
```

```ts
// chaincss.config.ts
export default defineConfig({
  tokens: {
    tokens: { colors: { primary: { 500: '#6366f1' } } },
    relationships: [
      { type: 'derived', source: 'primary.500', target: 'primary.100', method: 'mix-white 80%' },
      { type: 'contrast', foreground: 'text.onPrimary', background: 'primary.500', target: 4.5 }
    ]
  }
})
```

---

## Comparison

| | ChainCSS | Tailwind | Styled Components | Vanilla Extract | Panda CSS |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Design token graph** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Contrast auto-fix** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Mixed mode** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Relationship macros** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Compiler inspector** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Zero runtime** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Atomic CSS** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Figma sync** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## CLI Commands

```bash
npx chaincss init              # Scaffold config
npx chaincss dev               # Dev server + HMR + inspector
npx chaincss build             # Production build
npx chaincss check             # WCAG 2.2 audit
npx chaincss check --fix       # Auto-fix accessibility
npx chaincss audit --fix --write  # Contrast auto-fix + write back
npx chaincss tokens:watch      # Watch + propagate token changes
npx chaincss figma sync        # Pull from Figma Variables API or GitHub
```

---

## Performance

| Rules | Time | Output |
|:---|:---|:---|
| 50 | 2.4ms | 11.5KB |
| 500 | 23ms | 133KB |
| 2,000 | 127ms | 530KB |

Compiler never ships to browser. Cold start ~61ms.

---

## Framework Support

React · Vue · Svelte · SolidJS — ChainCSS outputs plain CSS. Works anywhere.

---

## License

MIT

**Author:** Rommel Caneos · [Contact](mailto:rec0608m@gmail.com) · [Website](https://www.chaincss.dev)