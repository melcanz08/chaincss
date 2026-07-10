# ChainCSS 

[![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

📖 **[Full Documentation →](https://www.chaincss.dev/)**

**ChainCSS compiles `.chain.ts` files into static CSS** through a 5-stage pipeline. Write styles with a fluent TypeScript API — get zero-runtime CSS, built-in accessibility auditing, a live compiler inspector, design tokens, atomic CSS extraction, and step-through replay showing exactly how every style was generated.

```bash
npm install chaincss
```

---

> 🎯 **Works with React, Vue, Svelte, and Solid.** ChainCSS outputs plain CSS strings — use it with any framework or vanilla HTML.

## What Makes ChainCSS Different

ChainCSS is a **compiler** that understands your styles. Every `.chain.ts` file goes through normalization, validation, analysis, lowering, and optimization passes before emitting CSS.

| | ChainCSS | Styled Components | Vanilla Extract | Tailwind |
|:---|:---:|:---:|:---:|:---:|
| **Type** | Compiler | Library | Compiler | Compiler |
| **Runtime cost** | 0KB | ~14KB | 0KB | 0KB |
| **Dynamic styles** | ✅ Mixed mode | ✅ | ❌ | ❌ |
| **Design tokens** | ✅ Built-in | ❌ | ❌ | Config only |
| **Atomic CSS** | ✅ Opt-in | ❌ | ❌ | ✅ |
| **Accessibility audit** | ✅ Built-in | ❌ | ❌ | ❌ |
| **Compiler inspector** | ✅ Live | ❌ | ❌ | ❌ |

---

## Quick Start

### With Vite (Recommended for frameworks)

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

```tsx
import { btn } from './styles/button.chain'
// btn = 'chain-button' — a plain string
<button className={btn}>Click me</button>
```

Vite handles CSS compilation, HMR, inspector injection, and framework bundling automatically.

### With CLI (Zero Config)

```bash
npx chaincss dev
```

Starts a dev server with CSS compilation, live reload, and framework auto-detection. Works with any project structure — just needs `.chain.ts` files in `src/`.

```bash
npx chaincss dev --port 8080   # Custom port
npx chaincss build              # Build once (CI/CD)
npx chaincss build --watch      # Watch mode
```

---

## The Killer Feature: Mixed Mode

Static properties compile to CSS at build time. Dynamic functions stay in JS — evaluated at runtime via CSS custom properties. Zero memory leaks, no DOM injection, React concurrent-mode safe.

```ts
import { chain } from 'chaincss'

export const btn = chain.dynamic()
  .bg('#6366f1')                                    // → static CSS
  .color('#ffffff')                                  // → static CSS
  .padding('12px 24px')                              // → static CSS
  .opacity(() => isActive ? 1 : 0.5)                 // → runtime only
  .shadow(() => isActive 
    ? '0 8px 25px rgba(16,185,129,0.6)' 
    : '0 2px 8px rgba(0,0,0,0.3)')                  // → runtime only
  .$el('btn')
```

```tsx
import { useChainStyles } from 'chaincss/runtime'

function Button({ isActive }) {
  const classes = useChainStyles({ btn }, [isActive])
  return <button className={`${btn} ${classes.btn}`}>Click</button>
}
```

**How it works:** `chain.dynamic()` functions are preserved through the compiler. `.class.js` exports them as executable code. `useChainStyles()` evaluates them at runtime and applies values as CSS custom properties.

---

## Design Tokens

Reference tokens with `$token.path` syntax. Resolved at build time by the compiler pipeline. Supports compound values, mixed strings, and pseudo-class tokens.

```js
// chaincss.config.js (in your project root)
export default {
  tokens: {
    tokens: {
      colors: { primary: '#6C63FF', surface: '#1A1A2E', text: '#E2E8F0' },
      spacing: { sm: '8px', md: '16px', lg: '24px' },
      effects: { radius: '8px', shadow: '0 4px 12px rgba(0,0,0,0.3)' }
    }
  }
}
```

```ts
chain()
  .bg('$colors.surface')           // → background: #1A1A2E
  .padding('$spacing.sm $spacing.md')  // → padding: 8px 16px
  .rounded('$effects.radius')      // → border-radius: 8px
  .border('1px solid $colors.border')  // → border: 1px solid #2A2A4A
```

**Theme Contracts** validate themes at build time:

```ts
import { createThemeContract, createTheme } from 'chaincss'

const contract = createThemeContract({
  colors: { primary: '', background: '' },
  spacing: { sm: '', md: '', lg: '' }
})

export const lightTheme = createTheme(contract, {
  colors: { primary: '#6366f1', background: '#ffffff' },
  spacing: { sm: '8px', md: '16px', lg: '24px' }
})
```

---

## 5-Stage Compiler Pipeline

Every style runs through five stages at build time:

| Stage | What Happens |
|-------|-------------|
| **1. Normalization** | Intent detection, unit normalization, layout macros |
| **2. Validation** | WCAG 2.2 checks, conflict detection, z-index validation |
| **3. Analysis** | Responsive patterns, layout recognition, dead code detection |
| **4. Lowering** | Token resolution, constraint solving, CSS emission |
| **5. Optimization** | Compression, specificity sorting, media query packing, atomic extraction |

Presets: `default` (dev), `production` (build), `ci` (full audit), `lint` (validate only), `atomic` (utility classes).

---

## CLI Commands

```bash
npx chaincss init          # Create chaincss.config.js
npx chaincss dev           # Dev server + live reload + auto-bundling
npx chaincss build         # Build CSS once
npx chaincss watch         # Watch and rebuild CSS
npx chaincss check         # Accessibility audit (WCAG 2.2)
npx chaincss check --fix   # Auto-fix accessibility issues
npx chaincss cache clear   # Clear compiler cache
npx chaincss timeline list # View compilation history
```

---

## Framework Support

ChainCSS outputs plain CSS strings — works with any framework. All four major frameworks verified with mixed mode end-to-end.

| Framework | How Dynamics Update | Runtime Hook |
|-----------|-------------------|--------------|
| ⚛️ React | `useMemo` with deps | `useChainStyles(styles, deps)` |
| 💚 Vue | `setup()` reactive render | `evalDynamicVars()` in render |
| 🧡 Svelte | Manual `render()` call | `evalDynamicVars()` in render |
| 🔷 SolidJS | Manual `render()` call | `evalDynamicVars()` in render |

The core logic is identical — dynamic functions are evaluated and applied as CSS custom properties. Each framework wires it to its own reactivity system.

### ⚛️ React

```tsx
import { useChainStyles, cx } from 'chaincss/runtime'
import { btn, btnDynamic } from './button.chain'

function Button({ isActive }) {
  const classes = useChainStyles({ btnDynamic }, [isActive])
  return <button className={cx(btnDynamic, classes.btnDynamic)}>Click</button>
}
```

**Exports:** `useChainStyles`, `useDynamicChainStyles`, `useThemeChainStyles`, `cx`, `createStyledComponent`, `withChainStyles`, `ChainCSSGlobal`, `useComputedStyles`

### 💚 Vue

```js
import { createApp, ref, h } from 'vue'
import { btn, btnDynamic } from './button.chain'

const App = {
  setup() {
    const isActive = ref(false)
    return () => h('button', { class: isActive.value ? btn : btnDynamic }, 'Click')
  }
}
createApp(App).mount('#app')
```

**Exports:** `useAtomicClassesVue`, `useComputedStylesVue`, `provideStyleContext`, `injectStyleContext`

### 🧡 Svelte

```svelte
<script>
  import { btn, btnDynamic } from './button.chain'
  let count = 0; $: isActive = count > 0
</script>
<button class={btnDynamic} style="opacity: {isActive ? 1 : 0.5}">Clicks: {count}</button>
```

**Exports:** `cxSvelte`, `chainStyles`, `useAtomicClassesSvelte`, `useComputedStylesSvelte`

### 🔷 SolidJS

```tsx
import { createSignal } from 'solid-js'
import { btn, btnDynamic } from './button.chain'

function Button() {
  const [count, setCount] = createSignal(0)
  return <button class={btnDynamic} style={{ opacity: count() > 0 ? 1 : 0.5 }}>Clicks: {count()}</button>
}
```

**Exports:** `useChainStylesSolid`, `useComputedStylesSolid`, `cxSolid`, `createStyleContext`

---

## Live Compiler Inspector

Press `Ctrl+Shift+I` on any ChainCSS-powered site. Hover over any element to see its full compiler history — every pass, every transformation, before/after diffs, and step-through replay.

Available in Vite (auto-injected), CLI (manual component), and production (`debug: true`).

---

## Accessibility Audit

```bash
npx chaincss check
```

Built-in WCAG 2.2 checks: contrast ratios, font-size minimums (12px+), touch target sizing (44x44px+), focus indicators, motion preferences. Auto-fix available.

```bash
npx chaincss check --fix
```

---

## API at a Glance

### Properties & Shorthands

```ts
chain()
  .bg('#6366f1')       // background
  .fs(16)              // font-size: 16px
  .fw(600)             // font-weight: 600
  .rounded(8)          // border-radius: 8px
  .p('12px 24px')      // padding
  .flex()              // display: flex
```

### Macros

| Macro | Result |
|:---|:---|
| `center()` | `display: flex; align-items: center; justify-content: center` |
| `pill()` | Fully rounded pill with inline-flex centering |
| `glass()` | Frosted glass backdrop blur |
| `truncate()` | Single-line ellipsis truncation |
| `skeleton()` | Loading skeleton animation |
| `clickScale()` | Scale down on press |

### States & Pseudo-classes

```ts
chain()
  .hover().bg('red').end()
  .focus().outline('2px solid blue').end()
  .active().transform('scale(0.98)').end()
  .nest('.child', (c) => c.color('blue'))
  .media('(min-width: 768px)', (c) => c.flexDirection('row'))
```

### Math Engine

```ts
import { math } from 'chaincss'
chain()
  .fs(math.add('16px', '0.5rem'))                    // → 24px
  .width(math.fluidType({ minSize: 320, maxSize: 1200 }))  // → clamp(...)
```

### Recipe System (Variants)

```ts
const button = recipe({
  base: chain().padding('8px 16px').rounded(8),
  variants: {
    color: { primary: chain().bg('#6C63FF'), secondary: chain().bg('transparent') },
    size: { sm: chain().fs(12), lg: chain().fs(18) }
  },
})
button({ color: 'secondary', size: 'lg' })
```

---

## Performance

Benchmarked on Node.js v22, Linux, 4 CPUs, 4GB RAM. Measured as `compileStyle()` wall time including all 5 pipeline stages on cold cache.

| Scenario | Rules | Time | Output |
|:---|:---|:---|:---|
| Small (5 rules) | 5 | 0.5ms | 383B |
| Medium (50 rules) | 50 | 2.4ms | 11.5KB |
| Large (500 rules) | 500 | 23ms | 133KB |
| X-Large (2,000 rules) | 2,000 | 127ms | 530KB |

Cold start: ~61ms. Compiler never ships to the browser.

---

## Troubleshooting / FAQ

**Q: `npx chaincss dev` says "No .chain.ts files found"?**  
Create a `.chain.ts` file in `src/` or run `npx chaincss init` to scaffold one.

**Q: Vite plugin conflicts with another CSS plugin?**  
ChainCSS handles its own CSS output. Remove other CSS processors (PostCSS, Tailwind) from your Vite config for `.chain.ts` files, or add `exclude: ['**/*.chain.ts']` to their configs.

**Q: Dynamic styles not updating in React?**  
Make sure you're passing the correct dependency array to `useChainStyles(styles, [dep1, dep2])`.

**Q: How do I use ChainCSS with Next.js?**  
Use the Webpack plugin (`chaincss/webpack`) in `next.config.js`, or the Vite plugin if using Next.js with Turbopack.

## License

MIT

**Author:** Rommel Caneos [Contact Me](mailto:rec0608m@gmail.com)