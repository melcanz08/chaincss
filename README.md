# ChainCSS v2.9.0 [![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

**Write styles with a fluent TypeScript API. ChainCSS compiles them into static CSS at build time, leaving zero styling runtime in production. When you need runtime values, only those values stay in JavaScript.**

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

## Quick Start: Vite

```ts
// vite.config.ts
import chaincss from 'chaincss/plugin/vite'

export default defineConfig({
  plugins: [chaincss(), react()]
})
```

Create a style file anywhere in `src/`:

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

Import and use — it's a plain string:

```tsx
import { btn } from '../styles/button.chain'

function Button() {
  return <button className={btn}>Click me</button>
}
```

The plugin handles file discovery, compilation, CSS generation, and HMR automatically.

---

## CLI

```bash
npx chaincss init     # Create config
npx chaincss build    # Build once
npx chaincss watch    # Watch for changes
```

---

## API at a Glance

### Properties & Shorthands

Every CSS property is a chainable method. Shorthands keep things concise:

```ts
chain()
  .bg('#6366f1')       // background-color
  .fs(16)               // font-size (px added automatically)
  .fw(600)              // font-weight
  .rounded(8)           // border-radius
  .p('12px 24px')       // padding
  .flex()               // display: flex
```

### Macros

One method, multiple declarations:

| Macro | Result |
|:---|:---|
| `center()` | `display: flex; align-items: center; justify-content: center` |
| `pill()` | Fully rounded pill with inline-flex centering |
| `glass()` | Frosted glass backdrop blur |
| `truncate()` | Single-line ellipsis truncation |
| `skeleton()` | Loading skeleton animation |
| `clickScale()` | Scale down on press |

[See all macros →](#api-reference)

### States & Nesting

```ts
chain()
  .hover().bg('red').end()
  .focus().outline('2px solid blue').end()
  .nest('.child', (c) => c.color('blue'))
  .media('(min-width: 768px)', (c) => c.flexDirection('row'))
```

---

## Performance

Benchmarked on Node.js v22, Linux, 4 CPUs, 4GB RAM with realistic CSS fixtures:

| Scenario | Rules | Time | Output |
|:---|:---|:---|:---|
| Small | 5 | 0.5ms | 383B |
| Medium | 50 | 2.4ms | 11.5KB |
| Large | 500 | 23ms | 133KB |
| X-Large | 2,000 | 127ms | 530KB |

Cold start: ~61ms. Compiler never ships to the browser.

---

## What Happens Under the Hood

ChainCSS runs your styles through a build-time compiler that:

- **Fixes common mistakes** — `flexbox` → `flex`, `hand` → `pointer`, typos in property names
- **Produces smaller CSS** — shortens hex colors, removes redundant values
- **Checks accessibility** — flags low contrast, missing focus indicators, small touch targets
- **Suggests patterns** — detects repeated styles and recommends extracting them as recipes
- **Extracts atomic classes** — optionally converts repeated declarations into utility classes

All of this happens at build time. Your users see none of it.

---

## Framework Support

```tsx
// React
import { btn } from './button.chain'
<button className={btn}>Click</button>

// Vue, Svelte, Solid — same pattern
```

Dynamic styles in any framework:

```tsx
import { useChainStyles } from 'chaincss/runtime'
const classes = useChainStyles(styles, [dependencies])
```

React, Vue, Svelte, and SolidJS are optional peer dependencies.

---

## Debug Mode

```ts
const debugChain = chain({ debug: true })
  .bg('red')
  .padding(16);

console.log(debugChain.explain().visualization);
```

```
┌──────────────────────────────────────────────────────────┐
│              ChainCSS Style Explanation                  │
├──────────────────────────────────────────────────────────┤
│ 📦 bg         → red        (static)                     │
│ 📦 padding    → 16         (static)                     │
├──────────────────────────────────────────────────────────┤
│ Static: 2 | Dynamic: 0                                  │
└──────────────────────────────────────────────────────────┘
```

---

## API Reference

| Export | Description |
|:---|:---|
| `chain(options?)` | Create a style chain |
| `chain.dynamic(options?)` | Create a mixed-mode chain (static + dynamic) |
| `compileToCSS(obj, opts?)` | Compile style object to CSS string |
| `partitionForBuild(obj)` | Split static CSS from dynamic values |
| `useChainStyles(styles, deps)` | React hook for dynamic styles |
| `ChainCSSCompiler` | Full build compiler with pipeline control |

[Full documentation →](https://github.com/melcanz08/chaincss)

---

## License

MIT

**Author:** Rommel Caneos