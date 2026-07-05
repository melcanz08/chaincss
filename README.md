# ChainCSS v2.10 [![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

**The CSS compiler that understands your styles.** Write styles with a fluent TypeScript API. ChainCSS compiles them into static CSS at build time. Nothing ships to the browser. No runtime. No overhead. When you need dynamic values, only those values stay in JavaScript.

```bash
npm install chaincss
```

---

## Quick Start

```bash
npm install chaincss
```

```ts
// vite.config.ts
import chaincss from 'chaincss/plugin/vite'

export default defineConfig({
  plugins: [chaincss(), react()]
})
```

Create `src/styles/button.chain.ts`:

```ts
import { chain } from 'chaincss'

export const btn = chain()
  .bg('#6366f1')
  .color('#ffffff')
  .padding('12px 24px')
  .rounded(8)
  .hover().bg('#4f46e5').end()
  .$el('button')
```

Use it in your component — it's a plain string:

```tsx
import { btn } from './styles/button.chain'

function Button() {
  return <button className={btn}>Click me</button>
}
```

Run `npm run dev` and you're done. The Vite plugin handles file discovery, compilation, CSS generation, and HMR automatically.

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

> *Static styles generate zero runtime code. Mixed Mode includes only the dynamic expressions required at runtime.*

| | ChainCSS | Styled Components | Vanilla Extract | Tailwind |
|:---|:---:|:---:|:---:|:---:|
| **Runtime cost** | 0KB* | ~14KB | 0KB | 0KB |
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

## Compiler Intelligence

ChainCSS runs your styles through a 5-stage CI pipeline that validates, analyzes, and optimizes at build time.

### Accessibility Audit

```bash
npx chaincss check
```

Accessibility auditing is integrated into the build pipeline rather than requiring a separate tool. ChainCSS checks WCAG 2.2 contrast ratios, font-size minimums, touch target sizing, focus indicators, and motion preferences.

### Live Inspector

Press `Ctrl+Shift+I` on [chaincss.dev](https://chaincss.dev) to try the live inspector. Hover over any element to see its full compiler history — every pass, every transformation, before/after diffs, and a step-through replay of how the CSS was generated. The inspector is available on any site built with ChainCSS. Hover over any element to see its full compiler history — every pass, every transformation, before/after diffs, and a step-through replay of how the CSS was generated.

### Design Tokens with Validation

```ts
import { createThemeContract, createTheme } from 'chaincss'

const contract = createThemeContract({
  colors: { primary: '', background: '' },
  spacing: { sm: '', md: '', lg: '' }
})

const lightTheme = createTheme(contract, {
  colors: { primary: '#6366f1', background: '#ffffff' },
  spacing: { sm: '8px', md: '16px', lg: '24px' }
})
```

Theme contracts validate that every theme matches the expected shape at build time.

---

## When to Use ChainCSS

**ChainCSS is a good fit if:**
- You want compile-time CSS with zero runtime overhead
- You prefer writing styles in TypeScript with full type safety
- You want built-in accessibility auditing and compiler diagnostics
- You need optional runtime dynamic styles without switching libraries
- You value understanding what your styles compile to

**ChainCSS might not be the best fit if:**
- You prefer utility-first workflows (consider Tailwind)
- You already have a large Tailwind or Styled Components codebase
- You need fully runtime-generated styles for every component

---

## CLI

```bash
npx chaincss init       # Create config
npx chaincss build      # Build once
npx chaincss watch      # Watch for changes
npx chaincss check      # Audit accessibility
npx chaincss check --fix  # Auto-fix issues
```

---

## API at a Glance

### Properties & Shorthands

Every CSS property is a chainable method. Shorthands keep things concise:

```ts
chain()
  .bg('#6366f1')       // background (gradients work too)
  .bgc('#6366f1')      // background-color (solid colors)
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

[See all macros →](https://chaincss.dev/docs)

### States & Pseudo-classes

```ts
chain()
  .hover().bg('red').end()
  .focus().outline('2px solid blue').end()
  .active().transform('scale(0.98)').end()
  .checked().bg('#6366f1').end()
  .placeholder().color('#a1a1aa').end()
  .nest('.child', (c) => c.color('blue'))
  .media('(min-width: 768px)', (c) => c.flexDirection('row'))
```

---

## Performance

Benchmarks were run on Node.js 22 using the benchmark suite in `/benchmarks`. Results may vary by hardware and project size.

| Scenario | Rules | Time | Output |
|:---|:---|:---|:---|
| Small | 5 | 0.5ms | 383B |
| Medium | 50 | 2.4ms | 11.5KB |
| Large | 500 | 23ms | 133KB |
| X-Large | 2,000 | 127ms | 530KB |

Cold start: ~61ms. Compiler never ships to the browser.

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

## Documentation

- [Getting Started →](https://chaincss.dev/docs/getting-started)
- [API Reference →](https://chaincss.dev/docs/api)
- [Compiler Pipeline →](https://chaincss.dev/docs/pipeline)
- [CLI →](https://chaincss.dev/docs/cli)
- [Inspector →](https://chaincss.dev/audit)
- [GitHub →](https://github.com/melcanz08/chaincss)

---

## License

MIT

**Author:** Rommel Caneos