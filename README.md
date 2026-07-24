# ChainCSS — CSS Compiler Platform

[![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

📖 **[Full Documentation →](https://www.chaincss.dev/)**

**ChainCSS is a CSS compiler platform — not a utility library.**
It compiles styles through a 5-stage pipeline with its own intermediate representation (IR).
Tokens form a dependency graph. Styles express intent. Accessibility is a build step.
Static properties compile to atomic CSS at build time. Dynamic values resolve via CSS
custom properties at runtime. Zero-leak, framework-agnostic, SSR-ready.

**Think LLVM for CSS.**

```bash
npm install chaincss
```

---

## A Compiler Platform, Not a Library

ChainCSS is built like a real compiler — not a CSS generator.

| Component | What it does | Why it matters |
|:---|:---|:---|
| **IR (Intermediate Representation)** | Styles are parsed into an AST before codegen | Enables optimization passes, static analysis, dead code elimination |
| **5-Stage Pipeline** | Normalization → Validation → Analysis → Lowering → Optimization | Each stage is pluggable, inspectable, and cacheable |
| **Content-Addressable Cache** | Identical inputs produce cache hits across builds | Sub-ms recompiles in watch mode |
| **Token Dependency Graph** | Tokens know their relationships (derived, contrast, entanglement) | Change one color → all dependent values recompute |
| **Live Inspector** | Exposes every pipeline stage at runtime | Debug styles like you'd debug compiled code |
| **Framework-Agnostic Runtime** | React, Vue, Svelte, Solid via CSS custom property bridge | Write styles once, run anywhere |

**Seven integrated subsystems, one consistent architecture:**

```
Author → Collector → IR → Pipeline → Optimizer → Emitter → Runtime
```

---

## What Makes ChainCSS Different

### 🧬 Token Dependency Graph

Tokens aren't flat variables. They're a graph. Change `primary.500` and every derived
shade, hover state, border, and text contrast propagates automatically.

```ts
tokens: {
  relationships: [
    { type: 'derived', source: 'primary.500', target: 'primary.100', method: 'mix-white 80%' },
    { type: 'contrast', foreground: 'text.onPrimary', background: 'primary.500', target: 4.5 },
  ]
}
```

### ♿ Accessibility-Aware Compilation

Doesn't just detect contrast failures — fixes them. Preserves hue, adjusts lightness
via binary search, rewrites the token. WCAG 2.2 compliance as a build step.

```bash
npx chaincss audit --fix --write
```

### 🎯 Mixed Mode — Static + Dynamic in One API

Static properties compile to `.css` at build time. Dynamic functions receive context
and return values applied as CSS custom properties. One API. Zero compromises.

```ts
// button.chain.ts
export const btn = chain.dynamic()
  .box({ padding: '12px 24px', borderRadius: 8 })                          // → static CSS
  .background({ color: (ctx) => ctx.isActive ? '#6366f1' : '#a5b4fc' })    // → runtime CSS var
  .shadow({ box: (ctx) => ctx.isActive
    ? '0 8px 25px rgba(99,102,241,0.4)'
    : '0 2px 8px rgba(0,0,0,0.1)'
  })
  .$el('btn')
```

```css
/* Generated CSS */
.chain-btn {
  padding: 12px 24px;
  border-radius: 8px;
  background-color: var(--chain-btn-background-color);
  box-shadow: var(--chain-btn-box-shadow);
}
```

```tsx
// React — zero-leak, SSR-safe
import { useChainStyles } from 'chaincss/runtime'
import { btn } from './button.chain'

function Button({ isActive }: { isActive: boolean }) {
  const { classes, styleVars } = useChainStyles({ btn }, { isActive })
  return <button className={classes.btn} style={styleVars}>Click</button>
}
```

### 🔗 Relationship Macros

Don't write complex selectors. Express intent.

| Instead of | Write |
|---|---|
| `.group:has(> :hover) > &:not(:hover)` | `.peerDim()` |
| `&:has(> :nth-child(3))` | `.hasCount({ count: 3 })` |
| `&:focus-within label, &:has(input:not(:placeholder-shown)) label` | `.entangleFocus()` |

32+ macros that generate CSS relationships, not just properties.

---

## Quick Start

### Vite (30 seconds)

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app && npm install chaincss
```

```ts
// vite.config.ts
import chaincss from 'chaincss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [chaincss({ atomic: true }), react()],
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

### Next.js (Turbopack + Webpack)

```js
// postcss.config.cjs
module.exports = {
  plugins: {
    'chaincss/postcss': {
      content: ['./app/**/*.chain.{ts,js,tsx,jsx}'],
    },
  },
}
```

```css
/* app/globals.css */
@chaincss;
```

---

## Structured Shorthand Methods

Group related CSS properties into single, typed calls with full autocomplete.

| Method | Covers | Example |
|:---|:---|:---|
| `.flex()` | `display:flex`, `flex-direction`, `align-items`, `justify-content`, `gap` | `.flex({ direction: 'column', align: 'center', gap: 16 })` |
| `.grid()` | `display:grid`, `grid-template-columns/rows`, `gap`, `area` | `.grid({ columns: '1fr 1fr', gap: 24 })` |
| `.box()` | `margin`, `padding`, `border`, `border-radius`, `width`, `height` | `.box({ padding: '24px', margin: '0 auto', maxWidth: 1200 })` |
| `.typography()` | `font-family/size/weight`, `line-height`, `letter-spacing`, `text-align`, `color` | `.typography({ fontSize: 16, fontWeight: '600', color: '#333' })` |
| `.background()` | `background-color/image/position/size/repeat` | `.background({ color: '#fff', size: 'cover' })` |
| `.position()` | `position`, `top/right/bottom/left`, `z-index` | `.position({ type: 'absolute', top: 0, zIndex: 10 })` |
| `.shadow()` | `box-shadow`, `text-shadow` (x/y/blur/spread/color) | `.shadow({ y: 4, blur: 12, color: 'rgba(0,0,0,0.1)' })` |
| `.raw()` | Any CSS property not covered above | `.raw({ cursor: 'pointer', resize: 'vertical' })` |

Short aliases available for all methods.

---

## Framework Support

| Framework | Static Styles | Dynamic Styles | Method |
|-----------|:---:|:---:|--------|
| **React** | ✅ | ✅ | `useChainStyles({ styles }, { deps })` |
| **Vue** | ✅ | ✅ | Template ref + `style.setProperty()` |
| **Svelte** | ✅ | ✅ | `$effect` + `style.setProperty()` + CSS import |
| **SolidJS** | ✅ | ✅ | Ref callback + `style.setProperty()` |
| **Next.js** | ✅ | ✅ | PostCSS plugin + `useChainStyles` for client |
| **Vanilla HTML** | ✅ | ✅ | Import `.css` + `style.setProperty()` |

See **[Framework Integration Notes →](./FRAMEWORK_NOTES.md)** for detailed patterns.

---

## 32+ Macros

| Category | Macros |
|---|---|
| **Layout** | `center()`, `gridList()`, `autoGrid()`, `bentoNative()`, `pricingRow()`, `hero()`, `sidebar()` |
| **Interaction** | `pressable()`, `hoverLift()`, `hoverGlow()`, `focusRing()`, `clickScale()` |
| **Entanglement** | `peerDim()`, `peerHover()`, `groupHasHover()`, `hasCount()`, `entangleFocus()` |
| **Visual** | `glass()`, `frosted()`, `glow()`, `innerGlow()`, `textGradient()`, `meshGradient()` |
| **Animation** | `skeleton()`, `shimmer()`, `float()`, `spin()`, `pulse()`, `bounce()`, `marquee()` |
| **Utility** | `hide()`, `show()`, `truncate()`, `srOnly()`, `pill()`, `badge()`, `kbd()` |

---

## Build Tool Integration

| Tool | Plugin | Notes |
|------|--------|-------|
| **Vite** | `chaincss/vite` | React, Vue, Svelte, Solid |
| **Next.js** | `chaincss/postcss` | Turbopack + Webpack via `postcss.config.cjs` |
| **Webpack** | `chaincss/webpack` or PostCSS | Any framework |
| **PostCSS** | `chaincss/postcss` | Any bundler with PostCSS support |
| **CLI** | `npx chaincss dev/build` | Standalone dev server + build |

---

## Comparison

| | ChainCSS | Tailwind | Styled Components | Vanilla Extract | Panda CSS |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Compiler architecture** | ✅ IR + pipeline | ❌ | ❌ | ❌ | ❌ |
| **Mixed mode** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Zero-runtime (static)** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Token dependency graph** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Contrast auto-fix** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Relationship macros** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Live compiler inspector** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Figma sync** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **SSR-safe dynamics** | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## Performance

| Rules | Time | Output |
|:---|:---|:---|
| 50 | 2.4ms | 11.5KB |
| 500 | 23ms | 133KB |
| 2,000 | 127ms | 530KB |

Compiler never ships to browser. Cold start ~61ms.

---

## License

MIT

**Author:** Rommel Caneos · [Contact](mailto:rec0608m@gmail.com) · [Website](https://www.chaincss.dev)