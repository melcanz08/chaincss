# ChainCSS v2.8.13 [![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

**The CSS-in-JS library that compiles to zero.** Write styles as a chainable API. Ship static CSS with zero runtime cost. Dynamic values? Only the parts that need to be dynamic stay in JS.

## Why ChainCSS?

| | ChainCSS | Styled Components | Vanilla Extract | Tailwind |
|:---|:---:|:---:|:---:|:---:|
| **Runtime cost** | 0KB (static) | ~14KB | 0KB | 0KB |
| **Dynamic styles** | ✅ Mixed mode | ✅ | ❌ | ❌ |
| **Build output** | Plain CSS | JS-in-CSS | Plain CSS | Utility CSS |
| **TypeScript** | ✅ First-class | ✅ | ✅ | Partial |
| **Atomic CSS** | ✅ Opt-in | ❌ | ❌ | ✅ Built-in |
| **Bundle size** | 163KB (compiler only) | 14KB (browser) | 0KB | 0KB + CSS |

```bash
npm install chaincss
```

---

## Quick Start

```tsx
import { chain } from 'chaincss';

const btn = chain()
  .bg('#6366f1')
  .color('#ffffff')
  .padding('12px 24px')
  .rounded(8)
  .fontSize(16)
  .fontWeight(600)
  .hover()
    .bg('#4f46e5')
    .transform('translateY(-2px)')
  .end()
  .$el('button');

// btn is a string: 'chain-button'
// CSS is extracted at build time. Zero runtime.
```

---

## Mixed Mode: Static + Dynamic

Use `chain.dynamic()` for styles that mix static CSS with runtime values. Static properties compile to CSS at build time. Dynamic functions resolve at runtime.

```tsx
import { chain } from 'chaincss'

export const btn = chain.dynamic()
  .bg('#6366f1')                                    // static → CSS
  .color('#ffffff')                                  // static → CSS
  .padding('12px 24px')                              // static → CSS
  .opacity(() => isActive ? 1 : 0.5)                 // dynamic → runtime
  .shadow(() => isActive 
    ? '0 8px 25px rgba(16,185,129,0.6)' 
    : '0 2px 8px rgba(0,0,0,0.3)')                  // dynamic → runtime
  .$el('btn')
```

**Component usage:**

```tsx
import { btn, btnClass } from '../styles/button.chain'
import { useChainStyles } from 'chaincss/runtime'

function Button({ isActive }) {
  const classes = useChainStyles({ btn }, [isActive])
  return <button className={`${btnClass} ${classes.btn}`}>Click</button>
}
```

| Export | Type | What it is |
| :--- | :--- | :--- |
| `btn` | `StyleObject` | Original style object with dynamic functions |
| `btnClass` | `string` | Static class name (`'chain-btn'`) |

> **Rule:** `chain()` for static-only styles. `chain.dynamic()` when you have functions that need runtime resolution. Strings and numbers are always static. Functions are always dynamic.

---

## Performance

Benchmarked on Node.js v22, Linux, 4 CPUs, 4GB RAM:

| Scenario | Rules | Declarations | Time | CSS Output | Savings |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Small** | 5 | 20 | 0.25ms | 574B | — |
| **Medium** | 50 | 400 | 2.0ms | 9.2KB | 7.6% |
| **Large** | 500 | 5,000 | 21.6ms | 112KB | 10.4% |
| **X-Large**| 2,000 | 20,000 | 52ms | 450KB | 10.0% |

> **Note:** Cold start: ~21ms | Warm start: ~10ms | Compiler only — never ships to browser. Full benchmark suite available in the repository.

---

## Compiler Pipeline (Advanced)

Every style runs through a 3-stage compiler pipeline at build time. No configuration needed.

| Stage | Pass | What It Does |
| :--- | :--- | :--- |
| **Normalize** | Intent Normalizer | Fixes patterns (e.g., `flexbox` → `flex`, `abs` → `absolute`), adds defaults |
| | Unit Normalizer | Adds `px` to bare numbers, normalizes values |
| **Optimize** | CSS Compressor | Shortens hex colors (`#ff6633` → `#f63`), minifies values |
| **Lower** | Intent Resolver | Resolves `intent()` calls to CSS declarations |
| | Token Resolver | Resolves design tokens to CSS values |
| | CSS Emitter | Prints final CSS output |

### Opt-in Passes

Additional passes are available for projects that want build-time linting or advanced optimization:

| Import | Passes | Description |
| :--- | :--- | :--- |
| `chaincss/compiler` | accessibility-validator, conflict-validator, accessibility-optimizer | WCAG 2.2 checks, z-index validation |
| `chaincss/compiler` | pattern-detector, responsive-analyzer, layout-analyzer | Pattern clustering, responsive audit |
| `chaincss/compiler` | specificity-sorter, dead-code-eliminator, media-query-packer, source-optimizer | Advanced CSS optimization |
| `chaincss/compiler` | atomic-extractor | Atomic CSS class extraction |

```ts
// Example: add linting to your pipeline
import { accessibilityValidator } from 'chaincss/compiler';
import { createDefaultPipeline } from 'chaincss';

const pipeline = createDefaultPipeline();
pipeline.addValidation(accessibilityValidator);
```

### Disable the Pipeline

```ts
const compiler = new ChainCSSCompiler({ experimental: { enablePipeline: false } });
```

---

## API

### `chain()`
Creates a new style chain. Returns a proxy that collects styles.

```ts
import { chain } from 'chaincss';

const styles = chain()
  .property(value)   // any CSS property (camelCase)
  .$el('name');      // finalize, returns { selectors: ['.chain-name'], ...properties }
```

### Properties
All 500+ CSS properties are available as camelCase methods. Numeric values automatically get `px` added (except unitless properties like `opacity`, `zIndex`, `fontWeight`).

#### Shorthands

| Shorthand | CSS Property |
| :--- | :--- |
| `bg()` | `background-color` |
| `fs()` | `font-size` |
| `fw()` | `font-weight` |
| `rounded()` | `border-radius` |
| `p()` / `m()` | `padding` / `margin` |
| `flex()` / `grid()` | `display: flex / grid` |
| `w()` / `h()` | `width` / `height` |
| `pos()` | `position` |
| `z()` | `z-index` |
| `op()` | `opacity` |
| `gap()` | `gap` |
| `transform()` | `transform` |
| `transition()` | `transition` |

#### Macros
One method replaces multiple CSS declarations:

| Macro | What It Does |
| :--- | :--- |
| `center()` | `display: flex; align-items: center; justify-content: center` |
| `pill()` | Fully rounded pill shape with inline-flex centering |
| `circle(size)` | Perfect circle with flex centering |
| `glass(blur?)` | Backdrop blur glassmorphism effect |
| `hide()` / `show()` | Visibility toggles |
| `truncate()` | Single-line text truncation with ellipsis |
| `absolute(coords?)` | `position: absolute` with optional coordinates |
| `size(value)` | Sets both width and height |
| `stack({spacing, dir?})`| Flex column with configurable spacing |
| `clickScale(amount?)` | Scale down on `:active` |
| `pressable()` | `cursor: pointer` + unselectable + `clickScale` |
| `focusRing(color?)` | `:focus-visible` outline rings |
| `skeleton({active, color?})` | Loading skeleton animation |
| `fluidText({min, max})` | Responsive fluid typography via `clamp()` |

### States & Selectors

```ts
chain()
  .hover().bg('red').end()
  .focus().outline('2px solid blue').end()
  .nest('.child', (c) => c.color('blue'))
  .children((c) => c.padding(8))
  .media('(min-width: 768px)', (c) => c.flexDirection('row'))
  .supports('display: grid', (c) => c.gap(16))
  .when(condition, (c) => c.display('none'))
```

---

## Compiling to CSS

```ts
import { chain, compileToCSS } from 'chaincss';

const styles = chain()
  .bg('red')
  .padding(16)
  .hover().bg('darkred').end()
  .build(['button']);

const css = compileToCSS(styles, { scopeSelector: '.btn' });
```

### `compileToCSS(styleObject, options?)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scopeSelector` | `string` | `''` | CSS selector for the rule |
| `minify` | `boolean` | `false` | Minify output |
| `sourceMap` | `boolean` | `false` | Add source comments |

### `partitionForBuild(styleObject, options?)`
Splits styles into static CSS and dynamic values:

```ts
const { css, dynamicValues, hasDynamic } = partitionForBuild(styles, { scopeSelector: '.btn' });
```

---

## Debug Mode

```ts
const debugChain = chain({ debug: true })
  .bg('red')
  .color(() => themeColor)
  .padding(16);

console.log(debugChain.explain().visualization);
```

**Output:**
```text
┌──────────────────────────────────────────────────────────────┐
│              ChainCSS Style Explanation                      │
├──────────────────────────────────────────────────────────────┤
│ 📦 bg         → red                                         │
│ 🏃 color      → <function>                                  │
│ 📦 padding    → 16                                          │
├──────────────────────────────────────────────────────────────┤
│ Performance: FAST                                            │
│ Static: 2 | Dynamic: 1                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Vite Plugin

Add the plugin to your `vite.config.ts` — that's it.

```ts
// vite.config.ts
import chaincss from 'chaincss/plugin/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [chaincss(), react()]
})
```

### How it works

1. Create a `.chain.ts` file anywhere in `src/`:
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

2. Import and use — the class name is a plain string, zero runtime overhead:
```tsx
import { btn } from '../styles/button.chain'

// btn === 'chain-btn' (a string)
function Button() {
  return <button className={btn}>Click me</button>
}
```

The plugin handles everything automatically: file discovery, compilation, CSS generation, and HMR.

### Plugin Options

```ts
chaincss({
  verbose: true,          // Show per-file details
  silent: true,           // Suppress all output except errors
  disablePipeline: false, // Skip pipeline for faster builds
  atomic: true,           // Enable atomic CSS extraction
  breakpoints: { sm: '(max-width: 640px)' },
  tokens: { colors: { primary: '#6366f1' } },
  minify: true,
})
```

---

## CLI

```bash
npx chaincss build    # Build once
npx chaincss watch    # Watch for changes
npx chaincss init     # Initialize config
```

Configuration (`chaincss.config.js`):
```js
export default {
  inputs: ['src/**/*.chain.ts'],
  output: { outputDir: 'dist', minify: true },
  atomic: { enabled: true }
}
```

---

## Framework Integration

```tsx
// React
import { btn } from './styles/button.chain'
<button className={btn}>Click</button>

// With dynamic styles
import { useChainStyles } from 'chaincss/runtime'
const classes = useChainStyles(styles, [dependencies])
```
*React, Vue, Svelte, and SolidJS are optional peer dependencies.*

---

## API Reference

| Export | Description |
| :--- | :--- |
| `chain(options?)` | Create a style chain |
| `compileToCSS(obj, opts?)` | Compile style object to CSS string |
| `partitionForBuild(obj, opts?)` | Split static/dynamic assets |
| `classifyValue(value)` | Returns `'static'` or `'dynamic'` |
| `ChainCSSCompiler` | Full build compiler with pipeline control |
| `shorthandMap` | All available shorthands |
| `macros` | All available macros |

---

## License

MIT

**Author:** Rommel Caneos