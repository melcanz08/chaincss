# ChainCSS v2.5 [![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE) [![tests](https://img.shields.io/badge/tests-640%20passing-brightgreen)]()

**Zero-runtime CSS-in-JS with a build-time design assistant.** Static styles compile to plain CSS. Dynamic values resolve at runtime. An 18-pass pipeline audits accessibility, responsiveness, layout patterns, and more — all at build time, all with zero runtime cost.

```bash
npm install chaincss
```

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

// { selectors: ['.chain-button'], backgroundColor: '#6366f1', ... }
// CSS output: .chain-button { background-color: #6366f1; ... }
// CSS output: .chain-button:hover { background-color: #4f46e5; ... }
```

---

## 18-Pass Build Pipeline (NEW in v2.5)

Every style automatically runs through 18 optimization passes at build time. No configuration needed — it just works.

| Pass | Name | What It Does |
| :--- | :--- | :--- |
| 1 | Intent Recovery | Fixes typos (flexbox → flex, abs → absolute), adds defaults |
| 2 | Unit Resolution | Adds px to numbers, normalizes values |
| 3 | ♿ Accessibility | WCAG 2.2 audit: contrast ratios, font size, touch targets, focus indicators, prefers-reduced-motion |
| 4 | 📱 Responsive Inference | Detects mobile overflow, grid collapse, large typography, 100vh issues, excessive padding |
| 5 | 🧠 Layout Intelligence | Recognizes 35+ layout patterns, suggests macros (center(), card(), gridList()) |
| 6 | Validation | Flags z-index on static elements, flex properties without display: flex |
| 7 | Specificity Sort | Orders rules by cascade weight for predictable output |
| 8 | Dead Elimination | Removes unused selectors |
| 9 | 🔁 Pattern Learner | Clusters repeated styles across files, suggests recipe extraction with bundle savings estimates |
| 10 | 📊 Source Optimizer | Finds duplicate styles, specificity wars, animation conflicts, redundant media queries |
| 11 | Atomic Extraction | Extracts shared properties into atomic utility classes |
| 12 | Media Query Packing | Groups same-query rules for consolidation |
| 13 | CSS if() Transpile | Detects conditional patterns, emits native CSS if() with fallback |
| 14 | 🎨 Semantic Tokens | Resolves surface, text, elevation, state, spacing intents with light/dark/high-contrast themes |
| 15 | 🧩 Intent API | High-level component intents: chain.intent('card') → full accessible component |
| 16 | 🔗 Constraint Solver | Resolves chain.constrain('width', '< parent') → max-width: 100% |
| 17 | CSS Compression | Shortens hex colors, removes leading zeros, minifies |
| 18 | Diagnostics Export | Collects and organizes all warnings, suggestions, and auto-fixes |

### Disable the pipeline:

```ts
const compiler = new ChainCSSCompiler({ experimental: { enablePipeline: false } });
```

---

## Auto-Detection: Static vs Dynamic

ChainCSS automatically detects what can be compiled at build time and what needs runtime resolution. You never specify which is which.

```tsx
const styles = chain()
  .bg('#6366f1')                          // static → goes to CSS file
  .color(() => isActive ? 'green' : 'red') // dynamic → resolved at runtime
  .padding(16)                              // static → goes to CSS file
  .border(() => isActive ? '2px solid green' : '1px solid gray') // dynamic
  .$el('btn');
```

> **Rule:** Strings and numbers are static. Functions are dynamic.

---

## API

### chain()
Creates a new style chain. Returns a proxy that collects styles.

```ts
import { chain } from 'chaincss';

const styles = chain()
  .property(value)   // any CSS property (camelCase)
  .$el('name');      // finalize, returns { selectors: ['.chain-name'], ...properties }
```

### Properties
All 500+ CSS properties are available as camelCase methods:

```ts
chain()
  .backgroundColor('#fff')
  .fontSize(16)
  .borderRadius(8)
  .display('flex')
  .alignItems('center')
  .justifyContent('space-between')
```
*Numeric values automatically get px added (except unitless properties like opacity, zIndex, fontWeight).*

### Shorthands

| Shorthand | CSS Property |
| :--- | :--- |
| bg() | background-color |
| fs() | font-size |
| fw() | font-weight |
| rounded() | border-radius |
| p() | padding |
| m() | margin |
| px() / py() | padding-left/right / padding-top/bottom |
| mx() / my() | margin-left/right / margin-top/bottom |
| flex() | display: flex |
| grid() | display: grid |
| inlineFlex() | display: inline-flex |
| block() | display: block |
| w() / h() | width / height |
| maxW() / minH() | max-width / min-height |
| lh() | line-height |
| ls() | letter-spacing |
| ov() | overflow |
| pos() | position |
| z() | z-index |
| op() | opacity |
| gap() | gap |
| gridCols() | grid-template-columns |
| align() | text-align |
| cursor() | cursor |
| shadow() | box-shadow |
| transform() | transform |
| transition() | transition |

### Macros
One method replaces multiple CSS declarations:

| Macro | What It Does |
| :--- | :--- |
| center() | display: flex; align-items: center; justify-content: center |
| flexCenter(dir?) | Flex centering with optional 'row' or 'col' direction |
| gridCenter() | display: grid; place-items: center |
| pill() | Fully rounded pill shape with inline-flex centering |
| circle(size) | Perfect circle with flex centering |
| square(size) | Square with flex centering |
| glass(blur?) | Backdrop blur glassmorphism effect |
| glow({color, size}) | Box-shadow glow effect |
| hide() | opacity: 0; visibility: hidden; pointer-events: none |
| show() | opacity: 1; visibility: visible; pointer-events: auto |
| truncate() | Single-line text truncation with ellipsis |
| textGradient(colors) | Gradient text with background-clip: text |
| meshGradient(colors) | Multi-color mesh gradient background |
| absolute(coords?) | position: absolute with optional coordinates |
| fixed(coords?) | position: fixed with optional coordinates |
| sticky(coords?) | position: sticky with optional coordinates |
| relative() | position: relative |
| size(value) | Sets both width and height |
| stack({spacing, dir?}) | Flex column with configurable spacing and direction |
| gridTable(minWidth) | Responsive auto-fit grid table |
| aspect(ratio) | Set aspect-ratio ('square', 'video', 'golden') |
| safeArea(edge?) | iOS safe area padding |
| clickScale(amount?) | Scale down on :active |
| pressable() | cursor: pointer + unselectable + clickScale |
| focusRing(color?) | :focus-visible outline ring |
| skeleton({active, color?}) | Loading skeleton animation |
| shimmer() | Shimmer loading animation |
| fluidText({min, max, vw?}) | Responsive fluid typography via clamp() |
| lineClamp(lines?) | Multi-line text truncation with ellipsis |
| frostedNav(blur?) | Fixed navbar with glass effect + safe area |
| parallax(scale?) | Parallax scrolling container |
| noise(opacity?) | SVG noise texture background |
| scrollable(axis?) | Scrollable container ('x', 'y', 'both') |
| unselectable() | Disable text selection |
| outlineDebug() | Red outline debugging for layout |

### Intent Macros (NEW in v2.5)
High-level component intents that resolve to full, accessible CSS:

| Intent | What It Generates |
| :--- | :--- |
| stickyHeader() | Sticky header with backdrop blur and scroll shadow |
| card() | Card container with shadow, radius, and hover lift |
| hero() | Full-width centered hero section |
| container() | Responsive centered container with max-width |
| gridList() | Responsive auto-fit grid list |
| sidebar() | Two-column sidebar + main content layout |
| pill() | Pill-shaped element (fully rounded) |
| glass() | Frosted glass morphism effect |
| truncate() | Single-line text truncation with ellipsis |
| srOnly() | Screen-reader only (visually hidden but accessible) |

### Semantic Tokens (NEW in v2.5)

```ts
chain()
  .surface('interactive')   // → background, color, border-radius, cursor, transition
  .text('primary')           // → color, font-weight
  .elevation('floating')     // → box-shadow, z-index
  .state('hover')            // → :hover pseudo-class with brightness
  .spacing('comfortable')    // → padding, gap
```
*Supports light, dark, and high-contrast themes.*

### Constraint Solver (NEW in v2.5)
Declare relationships, not values:

```ts
chain()
  .constrain('width', '< parent')        // → max-width: 100%
  .constrain('height', '= width * 0.5')  // → aspect-ratio: 1/2
  .constrain('columns', '>= 3 when > 768px') // → @container query
```

### States & Selectors

```ts
chain()
  .hover()
    .bg('red')
  .end()
  .nest('.child', (c) => c.color('blue'))
  .children((c) => c.padding(8))       // shortcut for nest('& > *', ...)
  .media('(min-width: 768px)', (c) => c.flexDirection('row'))
  .supports('display: grid', (c) => c.gap(16))
  .container('(min-width: 400px)', (c) => c.color('red'))
  .layer('base', (c) => c.bg('white'))
  .when(condition, (c) => c.display('none'))
```

### Transforms

```ts
chain()
  .scale(1.2)
  .rotate('45deg')
  .x(10)          // translateX with automatic px
  .y(20)          // translateY with automatic px
  .skew('5deg')
```

### Keyframes & Fonts

```ts
chain()
  .keyframes('fadeIn', {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 }
  })
  .fontFace({ fontFamily: 'MyFont', src: 'url(/myfont.woff2)' })
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
// .btn { background-color: red; padding: 16px; }
// .btn:hover { background-color: darkred; }
```

### compileToCSS(styleObject, options?)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| scopeSelector | string | '' | CSS selector for the rule |
| minify | boolean | false | Minify output |
| sourceMap | boolean | false | Add source comments |
| sourceFile | string | '' | Source file path for comments |

### partitionForBuild(styleObject, options?)
Splits styles into static CSS and dynamic values:

```ts
const { css, dynamicValues, hasDynamic } = partitionForBuild(styles, { scopeSelector: '.btn' });
// css: '.btn { background-color: red; }'
// dynamicValues: { color: <function> }// hasDynamic: true
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

```ts
// vite.config.ts
import chaincssPlugin from 'chaincss/plugin/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    chaincssPlugin({ verbose: true }),
    react(),
  ],
});
```

The plugin:
* Serves generated CSS at `/__chaincss.css`
* Auto-injects `<link>` tag into HTML
* Watches for CSS changes and hot-reloads
* Runs the 18-pass pipeline with diagnostics in verbose mode

---

## Setup

Create a CSS generation script:

```ts
// src/generate-css.ts
import { compileToCSS } from 'chaincss';
import * as styles from './styles.chain';
import fs from 'fs';

let css = '*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}\n';
css += 'body{font-family:system-ui,sans-serif}\n\n';

for (const [_, obj] of Object.entries(styles)) {
  const sel = (obj as any).selectors?.[0];
  if (sel) css += compileToCSS(obj as any, { scopeSelector: sel }) + '\n\n';
}
fs.writeFileSync('public/chaincss.css', css);
```

```json
{
  "scripts": {
    "dev": "npm run css && vite",
    "css": "npx tsx src/generate-css.ts"
  }
}
```

---

## Framework Integration
ChainCSS is framework-agnostic. `$el()` returns a plain object:

```tsx
// React
<div className={styles.selectors[0].replace('.', '')}>...</div>

// Vue
<div :class="styles.selectors[0].replace('.', '')">...</div>

// Svelte
<div class={styles.selectors[0].replace('.', '')}>...</div>

// SolidJS — use the runtime
import { useAtomicClasses } from 'chaincss/runtime';
const { classes, cx } = useAtomicClasses(styles);

// Plain HTML (with CSS file)
<div class="chain-button">...</div>
```
*Runtime support: React, Vue, Svelte, and SolidJS (all optional peer dependencies).*

### Class Names

```tsx
// Option 1: Extract manually
<button className={btn.selectors[0].replace('.', '')}>Click</button>

// Option 2: Helper function
const cls = (c: any) => c.selectors?.[0]?.replace('.', '') || '';
<button className={cls(btn)}>Click</button>

// Option 3: Wrapper file (styles.ts)
import * as S from './styles.chain';
export const btn = S.btn.selectors[0].replace('.', '');
```

---

## API Reference

### Main Exports

| Export | Description |
| :--- | :--- |
| chain(options?) | Create a style chain |
| compileToCSS(obj, opts?) | Compile style object to CSS string |
| partitionForBuild(obj, opts?) | Split static/dynamic, return `{ css, dynamicValues }` |
| classifyValue(value) | Returns `'static'` or `'dynamic'` |
| partitionStyles(obj) | Split object into `{ static, dynamic }` |
| intent | Intent engine: correct(), heal(), validate() |
| orchestrator | Design orchestrator: contrastRatio(), checkContrast(), auditContrast() |
| math | Math engine: add(), subtract(), fluidType(), convert() |
| recipe | Recipe/variant system |
| ChainCSSCompiler | Full build compiler with pipeline control |
| shorthandMap | All available shorthands |
| macros | All available macros |

### Value Classification

| Value Type | Classification | Behavior |
| :--- | :--- | :--- |
| '#6366f1' (string) | static | Compiled to CSS |
| 16 (number) | static | Compiled to CSS (px added if needed) |
| () => themeColor (function) | dynamic | Stays in JS, resolved at runtime |
| 'theme.primary' (token ref) | dynamic | Resolved at runtime |

---

## Migration from v2.3 / v2.4

| Old API | New API |
| :--- | :--- |
| createChain() | chain() |
| smartChain() | chain() |
| buildChain() | chain() — static values auto-detected |
| runtimeChain() | chain() — dynamic values auto-detected |
| btt.compile() | compileToCSS() |
| btt.run() | compileToCSS() |
| enableDebug() | chain({ debug: true }) |

### New in v2.5:
* 18-pass IR pipeline active by default
* Accessibility engine (WCAG 2.2)
* Responsive inference
* Layout intelligence (35+ patterns)
* Pattern learner with recipe suggestions
* Source optimizer (duplicates, specificity, animations)
* Semantic tokens with theme support
* Intent API (intent('card'), intent('button-primary'))
* Constraint solver (constrain('width', '< parent'))
* SolidJS runtime
* Scroll-driven animations engine
* explain() visualization for debug mode

---

## License
MIT

**Author:** Rommel Caneos