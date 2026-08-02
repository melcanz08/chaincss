# ChainCSS

[![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE)

📖 **[Full Documentation →](https://www.chaincss.dev/)**

A zero-runtime, type-safe style compiler platform for modern web applications.

ChainCSS transforms fluent TypeScript style definitions into optimized CSS through a real compiler pipeline. Instead of generating styles at runtime, it analyzes, validates, optimizes, and emits deterministic outputs during the build, resulting in fast applications, framework-independent styling, and predictable performance.

```bash
npm install chaincss
```

---

## Quick Example

### Vite

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
// button.chain.ts
import { chain } from 'chaincss';

export const button = chain()
  .box({ p: '12px 24px', br: 8 })
  .background({ color: '#6366f1' })
  .typography({ color: '#ffffff', fontWeight: '600' })
  .hover()
    .background({ color: '#4f46e5' })
  .end()
  .$el('btn');
```

### Use in your component

```tsx
import { button } from './button.chain';

export function App() {
  return <button className={button}>Click Me</button>;
}
```

---

## Why ChainCSS?

Unlike traditional CSS-in-JS libraries, ChainCSS is built around a compiler architecture.

Your styles become an Intermediate Representation (IR), pass through multiple optimization stages, and are emitted into deterministic outputs such as CSS, Atomic CSS, Tailwind configuration, Design Tokens, or Figma tokens.

This keeps the runtime extremely small while enabling sophisticated compile-time analysis and optimization.

---

## Compiler Architecture

ChainCSS is built as a compiler platform—not simply a styling library.

| Component | Purpose | Benefit |
|-----------|---------|---------|
| Collector | Collects fluent style definitions | Unified authoring model |
| Intermediate Representation (IR) | Canonical representation of every style | Enables compiler transformations |
| Dependency Graph | Tracks relationships between rules, components, animations and tokens | Incremental compilation & graph analysis |
| Symbol Table | Stores semantic compiler information | Efficient analysis and lookups |
| Pass Scheduler | Orders compiler passes based on dependencies | Extensible and deterministic compilation |
| Compiler Pipeline | Normalize -> Validate -> Analyze -> Optimize -> Lower | Independent, testable compiler passes |
| Persistent Cache | Stores compiler state between builds | Faster rebuilds, survives process restarts |
| Incremental Compiler | Recompiles only affected nodes via graph analysis | Efficient watch mode |
| Emitter Registry | Generates multiple outputs from the same IR | CSS, Atomic CSS, Tailwind, Tokens, Figma, Graph JSON |
| Plugin System | Extends any compiler phase | Custom analysis, validation, optimization and emitters |

---

## Features

### Structured Styling API

Group related CSS properties into 16 expressive typed methods instead of large flat objects.

```ts
chain()
  .flex({ direction: 'column', align: 'center', gap: 16 })
  .box({ p: 24, br: 12, w: '100%' })
  .background({ color: '#6366f1' })
  .typography({ color: 'white', fw: 600 })
  .transition({ tr: 'all 0.2s ease' })
  .hover()
    .background({ color: '#4f46e5' })
    .transform({ custom: 'scale(1.02)' })
  .end()
  .$el('btn')
```

### Intelligent Unit Inference

Numeric values automatically receive CSS units where appropriate. Knows which properties are unitless (`lineHeight`, `opacity`, `zIndex`, `fontWeight`, etc.).

```ts
chain().box({ width: 300, borderRadius: 8 })
```

↓

```css
width: 300px; border-radius: 8px;
```

### Transform Composition

Individual transform properties are composed into a single `transform` declaration in the correct order.

```ts
chain().box({ x: 10, y: 20, rotate: 45 })
```

↓

```css
transform: translateX(10px) translateY(20px) rotate(45deg);
```

### Mixed Static + Dynamic Rendering

ChainCSS is the only library that allows **per-property mixing of static and dynamic styles** in a single definition. Static values compile to zero-runtime CSS. Dynamic values become CSS custom properties. Both use the same fluent API—no separate recipes, no different syntax, no compromises.

```ts
export const btn = chain.dynamic()
  .box({ padding: '12px 24px', borderRadius: 8 })                          // -> static CSS
  .background({ color: (ctx) => ctx.isActive ? '#6366f1' : '#a5b4fc' })    // -> runtime var
  .shadow({ box: (ctx) => ctx.isActive
    ? '0 8px 25px rgba(99,102,241,0.4)'
    : '0 2px 8px rgba(0,0,0,0.1)'
  })
  .$el('btn')
```

**10 properties are static. 2 are dynamic.** The CSS file contains 12 declarations—10 real values and 2 `var()` placeholders. The JS file contains only the 2 functions that actually need runtime evaluation.

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
import { useChainStyles } from 'chaincss/runtime'
import { btn } from './button.chain'

function Button({ isActive }: { isActive: boolean }) {
  const { classes, styleVars } = useChainStyles({ btn }, { isActive })
  return <button className={classes.btn} style={styleVars}>Click</button>
}
```

### Framework Adapters

`useChainStyles` returns `{ classes, styleVars }` in every framework. Each adapter uses the framework's native reactivity system.

| Framework | Hook | State Change |
|-----------|------|-------------|
| React | `useChainStyles(styles, deps)` | Re-renders via `useMemo` deps |
| Vue | `useChainStyles(styles, refs)` | Auto-unwraps `ref()` values, watches changes |
| Svelte | `useChainStyles(styles, stores)` | Subscribes to store changes |
| Solid | `useChainStyles(styles, signals)` | Auto-tracks signal access via `createMemo` |

### Token Dependency Graph

Tokens are relationships—not just variables. Changing one token automatically updates derived colors, harmony palettes, and contrast colors. All computed in the OKLCH color space for perceptual accuracy.

```ts
tokens: {
  relationships: [
    { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
    { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.600', method: 'shade 20%' },
    { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto' },
    { type: 'harmony', source: 'colors.primary.500', targets: ['colors.accent.500', 'colors.accent.300'], rule: 'complementary' }
  ]
}
```

### Semantic Intent System

Named design patterns that expand to complete CSS with theme-aware token resolution. 12 built-in intents across 4 categories.

```ts
chain().raw({ intent: 'card' }).$el('product-card')
// Expands to: display:flex; flex-direction:column; overflow:hidden;
//   border-radius: var(--borderRadius-lg); border: 1px solid var(--colors-gray-200);
//   hover: box-shadow + translateY(-2px); a11y: contrast + focus-visible
```

| Category | Intents |
|----------|---------|
| Layout | `center-content`, `stack`, `sidebar-layout`, `grid-list` |
| Component | `card`, `button-primary`, `button-secondary`, `input-field`, `modal`, `tooltip` |
| Semantic | `hero-section`, `sticky-header` |
| Interaction | `hover-lift`, `focus-ring` |

### Accessibility Compilation

Six WCAG checks run during compilation—not in CI, not in the browser. Milliseconds, not seconds.

| Check | Severity | Criterion | Auto-Fix |
|-------|----------|-----------|----------|
| Contrast ratio | Error | 1.4.3 AA (4.5:1) | Binary search in OKLCH |
| Font size minimum | Warning | 1.4.4 AA (12px) | `max(12px, value)` |
| Touch target size | Warning | 2.5.8 AA (44x44px) | min-width/height or ::after |
| Focus visible | Error | 2.4.7 AA | Auto-inject :focus-visible |
| Reduced motion | Warning | 2.3.3 AAA | Wrap in @media query |
| Hover without focus | Warning | 1.4.13 AA | Mirror to :focus-visible |

```bash
chaincss check --strict    # CI gate — fails on errors
chaincss audit --fix --write  # Auto-fix and write to token files
```

### Compile-Time Optimization

Nine optimization passes run on every stylesheet:

| Pass | What It Does |
|------|-------------|
| AST Optimizer | Simplifies `calc()` expressions, constant folding, identity removal |
| Duplicate Declaration Detector | Removes overridden declarations, preserves intentional fallbacks |
| Dead Code Eliminator | Removes unreferenced rules via graph analysis |
| CSS Compressor | Shortens hex colors, removes zero units, compresses box-model shorthands |
| Accessibility Optimizer | Auto-fixes font sizes, touch targets, focus rings |
| Atomic Extractor | Extracts repeated declarations (3+ usages) to utility classes |
| Media Query Packer | Merges identical queries via AST comparison, sorts by breakpoint |
| Source Optimizer | Deduplicates identical rules across files |
| Specificity Sorter | Orders rules by CSS specificity |

### Relationship Macros (100+)

Express CSS relationships rather than selectors. Zero runtime. All outputs are pure CSS.

| Instead of | Write | Category |
|---|---|---|
| `.group:has(> :hover) > &:not(:hover)` | `.peerDim()` | Interaction |
| `&:has(> :nth-child(3))` | `.hasCount({ count: 3 })` | Layout |
| `&:focus-within label, &:has(input:not(:placeholder-shown)) label` | `.entangleFocus()` | Accessibility |
| Full scroll-driven animation setup | `.entangle('scroll', { opacity: '0->1', y: '20px->0' })` | Animation |
| 8+ properties for glass morphism | `.glass()` | Effects |
| Complex grid with subgrid + container queries | `.bento()` | Layout |

### Multi-Target Emission

A single `.chain.ts` file compiles to multiple output formats simultaneously from the same IR.

```bash
chaincss build --target css,atomic-css,tailwind,design-tokens,figma,graph-json
```

| Target | Output | Use Case |
|--------|--------|----------|
| `css` | `styles.css` | Standard CSS |
| `atomic-css` | `atomic.css` | Utility-first atomic classes |
| `tailwind` | `tailwind.config.generated.js` | Tailwind theme extension |
| `design-tokens` | `design-tokens.json` | Platform-agnostic token export |
| `figma` | `figma-tokens.json` | Round-trip to Figma Tokens Studio |
| `graph-json` | `chaincss-graph.json` | Dependency graph visualization |

### Component Variants (Recipes)

Type-safe component variants with compound conditions. All variants compile at build time.

```ts
export const buttonVariants = recipe({
  base: chain().box({ p: '8px 16px', br: 8 }).$el('btn'),
  variants: {
    color: {
      primary: chain().background('#6366f1').typography({ color: 'white' }).$el(),
      secondary: chain().background('#48bb78').$el(),
      danger: chain().background('#f56565').$el(),
    },
    size: {
      sm: chain().box({ p: '4px 8px' }).typography({ fs: 12 }).$el(),
      md: chain().box({ p: '8px 16px' }).typography({ fs: 14 }).$el(),
      lg: chain().box({ p: '12px 24px' }).typography({ fs: 16 }).$el(),
    }
  },
  defaultVariants: { color: 'primary', size: 'md' },
})

buttonVariants({ color: 'secondary', size: 'lg' })  // -> merged StyleDefinition
```

### Figma Integration

Bidirectional sync: designers change colors in Figma -> Tokens Studio pushes to GitHub -> GitHub Action runs entanglement -> derived tokens update -> contrast auto-fixes.

```bash
chaincss figma init --repo org/design-tokens --fileId abc123
chaincss entanglement --input tokens.json --watch --fix --figma
```

### Dev Server with HMR

Zero-config development server with hot module replacement, build error overlay, and persistent compiler state.

```bash
chaincss dev --port 3000
```

- **Instant HMR**: CSS changes stream via SSE, no page reload
- **Build error overlay**: Compilation errors injected into the page
- **Persistent state**: Survives restarts for cold-start incremental builds
- **Compiler stats**: Real-time metrics at `/__chaincss_stats`

---

## CLI Commands

```bash
# Project scaffolding
chaincss init
chaincss create app my-app --template react --pm pnpm

# Development
chaincss dev --port 3000
chaincss watch --verbose

# Production
chaincss build --minify --atomic --persistent
chaincss build --target css,tailwind,design-tokens,figma,graph-json

# Quality
chaincss check --strict
chaincss audit --fail-on AA --fix --write

# Token management
chaincss entanglement --input tokens.json --watch --fix
chaincss figma init --repo org/design-tokens

# Cache & debugging
chaincss cache stats
chaincss cache validate
chaincss timeline list
chaincss timeline diff --snapshot1 0 --snapshot2 5
```

---

## Supported Frameworks

| Framework | Static | Dynamic | Adapter |
|-----------|:------:|:-------:|---------|
| React | Yes | Yes | `useChainStyles` + `useMemo` |
| Vue | Yes | Yes | `useChainStyles` + `ref`/`watch` |
| Svelte | Yes | Yes | `useChainStyles` + stores |
| Solid | Yes | Yes | `useChainStyles` + signals |
| Next.js | Yes | Yes | Server + Client components |
| Vanilla HTML | Yes | Yes | `styleInjector` |

---

## Build Integrations

- **Vite** — Plugin with HMR, virtual CSS, persistent state
- **Next.js** — Server Component + Client Component support
- **Webpack** — Plugin with incremental compilation
- **PostCSS** — Drop-in plugin for existing pipelines
- **CLI** — Full-featured standalone build tool

---

## Performance

| Rules | Compile Time | Output Size |
|-------|--------------|-------------|
| 5 | 0.54 ms | 0.4 KB |
| 50 | 4.80 ms | 11.3 KB |
| 500 | 93.06 ms | 133.0 KB |
| 2,000 | 1,709.92 ms | 533.2 KB |

> Measurements taken on a Lenovo G560 (Node.js v22.23.1, 4 CPUs, 4GB RAM).

---

## Philosophy

ChainCSS approaches styling the same way modern language compilers approach source code.

Instead of treating CSS as strings, it treats styles as structured data that can be analyzed, validated, optimized, transformed, cached, and emitted into multiple targets.

The objective is to provide the ergonomics of a fluent styling API while leveraging compiler techniques typically found in tools such as TypeScript, Babel, SWC, and LLVM.

---

## License

MIT

**Author:** Rommel Caneos

[Contact](mailto:rec0608m@gmail.com) | [Website](https://www.chaincss.dev)

[GitHub](https://github.com/melcanz08/chaincss) 