# ChainCSS  

[![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

**The CSS compiler that understands your styles.** Write styles with a fluent TypeScript API. ChainCSS compiles them into static CSS at build time with zero runtime overhead. Dynamic values stay in JS. Built-in accessibility auditing, live compiler inspector, and step-through replay show exactly how every style was generated.

```bash
npm install chaincss
```

---

## Why ChainCSS?

You write this:

```ts
const btn = chain()
  .bg('#6366f1')
  .color('#ffffff')
  .padding('12px 24px')
  .rounded(8)
  .hover().bg('#4f46e5').end()
  .$el('button');
```

Your users get this:

```css
.chain-button {
  background-color: #6366f1;
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 8px;
}
.chain-button:hover {
  background-color: #4f46e5;
}
```

Nothing ships to the browser. No runtime. No overhead.

| | ChainCSS | Styled Components | Vanilla Extract | Tailwind |
|:---|:---:|:---:|:---:|:---:|
| **Runtime cost** | 0KB | ~14KB | 0KB | 0KB |
| **Dynamic styles** | ✅ Mixed mode | ✅ | ❌ | ❌ |
| **TypeScript** | ✅ First-class | ✅ | ✅ | Partial |
| **Atomic CSS** | ✅ Opt-in | ❌ | ❌ | ✅ |
| **Accessibility audit** | ✅ Built-in | ❌ | ❌ | ❌ |
| **Compiler inspector** | ✅ Live | ❌ | ❌ | ❌ |

---

## Mixed Mode: The Killer Feature

Static properties compile to CSS at build time. Dynamic functions stay in JS — and only those functions.

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
  return <button className={`${btnClass} ${classes.btn}`}>Click</button>
}
```

---

## Getting Started

### Option 1: Vite Plugin (Recommended for frameworks)

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app && npm install chaincss
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import chaincss from 'chaincss/plugin/vite'

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
// btn = 'chain-button' — it's just a string!
<button className={btn}>Click me</button>
```

**What Vite gives you:** CSS compilation, HMR, inspector, framework bundling — all automatic.

### Option 2: CLI Dev Server (Zero Config)

```bash
npx chaincss dev
```

That's it. ChainCSS will:
- 🔨 Compile `.chain.ts` → CSS
- 🌐 Start dev server at `http://localhost:3000`
- 🔥 Live reload on CSS changes
- ⚛️ Auto-detect your framework and bundle JS
- 📁 Serve `index.html` from root (or `public/`)

```bash
# Custom port
npx chaincss dev --port 8080

# Project structure
my-site/
├── index.html
├── src/
│   └── styles/
│       └── button.chain.ts
└── package.json
```

### Option 3: Build Only (CI/CD, static sites)

```bash
npx chaincss build          # Build CSS once
npx chaincss build --watch  # Watch mode
```

---

## CLI Commands

```bash
npx chaincss init          # Create chaincss.config.js
npx chaincss dev           # Dev server + live reload + auto-bundling
npx chaincss build         # Build CSS once
npx chaincss watch         # Watch and rebuild CSS
npx chaincss check         # Audit accessibility
npx chaincss check --fix   # Auto-fix issues
npx chaincss cache clear   # Clear compiler cache
npx chaincss timeline list # View compilation history
```

---

## Framework Support

ChainCSS works with ANY framework — it outputs plain CSS strings. All four major frameworks are fully verified with mixed mode (static + dynamic) working end-to-end.

**How dynamic styles work across frameworks:**

The core logic is the same everywhere: `chain.dynamic()` functions are evaluated at runtime, and the results are applied as CSS custom properties via inline styles. This zero-leak approach avoids DOM injection and works with any reactivity system.

| Framework | Reactivity Model | How Dynamics Update |
|-----------|-----------------|-------------------|
| React | `useMemo` with deps array | Hook re-runs when dependencies change |
| Vue | `setup()` reactive render | Render function re-runs on ref change |
| Svelte | Manual `render()` call | `render()` re-runs on state change |
| Solid | Manual `render()` call | `render()` re-runs on state change |

The underlying dynamic evaluation is identical — it's wired to each framework's native reactivity system.

Here's how to use it with each:

### ⚛️ React

**Status: ✅ Full Support**

```tsx
// Static styles
import { btn } from './button.chain'
<button className={btn}>Click</button>

// Dynamic styles (mixed mode)
import { useChainStyles } from 'chaincss/runtime'

function Button({ isActive }) {
  const classes = useChainStyles({ btnDynamic }, [isActive])
  return <button className={`${btnDynamic} ${classes.btnDynamic}`}>Click</button>
}
```

**Runtime exports:** `useChainStyles`, `useDynamicChainStyles`, `useThemeChainStyles`, `cx`, `createStyledComponent`, `withChainStyles`, `ChainCSSGlobal`, `useComputedStyles`

### 💚 Vue

**Status: ✅ Full Support**

```vue
<template>
  <!-- Static styles -->
  <button :class="btn">Click</button>

  <!-- Dynamic styles -->
  <button :class="[btnDynamic, classes.btnDynamic]">Dynamic</button>
</template>

<script setup>
import { ref } from 'vue'
import { btn, btnDynamic } from './button.chain'
import { useAtomicClasses } from 'chaincss/runtime'

const isActive = ref(false)
const { classes } = useAtomicClasses({ btnDynamic }, { debug: false })
</script>
```

**Runtime exports:** `useAtomicClasses`, `useComputedStyles`, `createStyledComponent`, `createStyledComponents`, `provideStyleContext`, `injectStyleContext`

### 🧡 Svelte

**Status: ✅ Full Support — Verified with TaskFlow app**

```svelte
<script>
  import { btn, btnDynamic } from './button.chain'
  let count = 0
  $: isActive = count > 0
</script>

<!-- Static styles -->
<button class={btn}>Click</button>

<!-- Dynamic via style prop -->
<button class={btnDynamic} style="opacity: {isActive ? 1 : 0.5}">
  Clicks: {count}
</button>
```

**Runtime exports (lazy-loaded):** `cxSvelte`, `chainStyles`, `useAtomicClassesSvelte`, `useComputedStylesSvelte`, `provideStyleContextSvelte`, `injectStyleContextSvelte`

### 🔷 SolidJS

**Status: ✅ Full Support — Verified with TaskFlow app**

```tsx
import { createSignal } from 'solid-js'
import { btn, btnDynamic } from './button.chain'

function Button() {
  const [count, setCount] = createSignal(0)
  const isActive = () => count() > 0

  return (
    <>
      <button class={btn}>Static</button>
      <button class={btnDynamic}
        style={{ opacity: isActive() ? 1 : 0.5 }}
        onClick={() => setCount(c => c + 1)}>
        Clicks: {count()}
      </button>
    </>
  )
}
```

**Runtime exports (lazy-loaded):** `useChainStylesSolid`, `useComputedStylesSolid`, `createStyledComponentSolid`, `cxSolid`, `createStyleContext`

---

## Compiler Intelligence

ChainCSS doesn't just generate CSS — it understands it. Every style runs through a 5-stage CI pipeline that validates, analyzes, and optimizes at build time.

### Accessibility Audit

```bash
npx chaincss check
```

Built-in WCAG 2.2 checks for contrast, font-size minimums, touch target sizing, focus indicators, and motion preferences.

### Live Inspector

Press `Ctrl+Shift+I` on any ChainCSS-powered site to open the compiler inspector. Hover over any element to see its full compiler history — every pass, every transformation, before/after diffs, and a step-through replay of how the CSS was generated.

**Available in ALL modes:** Vite plugin, CLI dev server, and production builds (`debug: true`).

---

## API at a Glance

### Properties & Shorthands

```ts
chain()
  .bg('#6366f1')       // background
  .fs(16)               // font-size: 16px
  .fw(600)              // font-weight: 600
  .rounded(8)           // border-radius: 8px
  .p('12px 24px')       // padding
  .flex()               // display: flex
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
  .media('(min-width: 768px)', (c) => c.flexDirection('row'))
```

---

## Performance

| Scenario | Rules | Time | Output |
|:---|:---|:---|:---|
| Small | 5 | 0.5ms | 383B |
| Medium | 50 | 2.4ms | 11.5KB |
| Large | 500 | 23ms | 133KB |
| X-Large | 2,000 | 127ms | 530KB |

Cold start: ~61ms. Compiler never ships to the browser.

---

## Integrating the Inspector

### Vite (automatic)
The Vite plugin injects the inspector in dev mode. Just press `Ctrl+Shift+I`.

### CLI (manual)
Add the Inspector component to your app (copy from [chaincss.dev/inspector](https://chaincss.dev)):

```tsx
import Inspector from './Inspector'

export default function App() {
  return (
    <>
      <Inspector />
      {/* Your app */}
    </>
  )
}
```

---

## License

MIT

**Author:** Rommel Caneos [Contact Me](mailto:rec0608m@gmail.com)