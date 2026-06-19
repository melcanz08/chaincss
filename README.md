# ChainCSS v2.4
[![npm version](https://badge.fury.io/js/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![npm downloads](https://img.shields.io/npm/dm/chaincss.svg)](https://www.npmjs.com/package/chaincss) [![license](https://img.shields.io/npm/l/chaincss.svg)](LICENSE) [![tests](https://img.shields.io/badge/tests-657%20passing-brightgreen)]()

**Zero-runtime CSS-in-JS with auto-detection.** Static styles compile to plain CSS. Dynamic values resolve at runtime. No manual mode switching.

```bash
npm install chaincss
```

Quick Start
### tsx

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

Auto-Detection: Static vs Dynamic
ChainCSS automatically detects what can be compiled at build time and what needs runtime resolution. You never specify which is which.

```tsx
const styles = chain()
  .bg('#6366f1')                          // static -> goes to CSS file
  .color(() => isActive ? 'green' : 'red') // dynamic -> resolved at runtime
  .padding(16)                              // static -> goes to CSS file
  .border(() => isActive ? '2px solid green' : '1px solid gray') // dynamic
  .$el('btn');
```
Rule: Strings and numbers are static. Functions are dynamic.

API
### chain()
Creates a new style chain. Returns a proxy that collects styles.

```ts
import { chain } from 'chaincss';

const styles = chain()
  .property(value)   // any CSS property (camelCase)
  .$el('name');      // finalize, returns { selectors: ['.chain-name'], ...properties }
```

Properties
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
Numeric values automatically get px added (except unitless properties like opacity, zIndex, fontWeight).

Shorthands
Common properties have short aliases:

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

Macros
One method replaces multiple CSS declarations:

| Macro | What it does |
| :--- | :--- |
| center() | display: flex; align-items: center; justify-content: center |
| flexCenter(dir?) | Flex centering, optional 'row' or 'col' direction |
| gridCenter() | display: grid; place-items: center |
| pill() | border-radius: 9999px; padding: 8px 20px; display: inline-flex; align-items: center |
| circle(size) | Perfect circle with flex centering |
| square(size) | Square with flex centering |
| glass(blur?) | Backdrop blur glassmorphism effect |
| glow({color, size}) | Box-shadow glow effect |
| hide() | opacity: 0; visibility: hidden; pointer-events: none |
| show() | opacity: 1; visibility: visible; pointer-events: auto |
| truncate() | overflow: hidden; text-overflow: ellipsis; white-space: nowrap |
| textGradient(colors) | Gradient text with webkit background clip |
| meshGradient(colors) | Multi-color mesh gradient background |
| absolute(coords?) | position: absolute with optional top/right/bottom/left |
| fixed(coords?) | position: fixed with optional coordinates |
| sticky(coords?) | position: sticky with optional coordinates |
| relative() | position: relative |
| size(value) | Sets both width and height |
| stack({spacing, dir?}) | Flex column with configurable spacing and direction |
| gridTable(minWidth) | Responsive auto-fit grid table |
| aspect(ratio) | Set aspect-ratio (supports 'square', 'video', 'golden') |
| safeArea(edge?) | iOS safe area padding |
| clickScale(amount?) | Scale down on :active pseudo-class |
| pressable() | Combines cursor: pointer + unselectable + clickScale |
| focusRing(color?) | Focus-visible outline ring |
| skeleton({active, color?}) | Loading skeleton animation |
| shimmer() | Shimmer loading animation |
| fluidText({min, max, vw?}) | Responsive fluid typography using clamp() |
| lineClamp(lines?) | Multi-line text truncation |
| frostedNav(blur?) | Fixed navbar with glass effect + safe area |
| parallax(scale?) | Parallax scrolling container |
| noise(opacity?) | SVG noise texture background |
| scrollable(axis?) | Scrollable container ('x', 'y', 'both') |
| unselectable() | Disable text selection |
| outlineDebug() | Red outline debugging for layout |

States & Selectors

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

Transforms

```ts
chain()
  .scale(1.2)
  .rotate('45deg')
  .x(10)          // translateX with automatic px
  .y(20)          // translateY with automatic px
  .skew('5deg')
```

Keyframes & Fonts

```ts
chain()
  .keyframes('fadeIn', {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 }
  })
  .fontFace({ fontFamily: 'MyFont', src: 'url(/myfont.woff2)' })
```

Mixins

```ts
const mixin = { color: 'red', fontSize: '16px' };
chain().use(mixin).bg('blue').$el('test');
```

Compiling to CSS

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

`compileToCSS(styleObject, options?)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| scopeSelector | string | '' | CSS selector for the rule |
| minify | boolean | false | Minify output |
| sourceMap | boolean | false | Add source comments |
| sourceFile | string | '' | Source file path for comments |

`partitionForBuild(styleObject, options?)`
Splits styles into static CSS and dynamic values for build-time extraction:

```ts
const { css, dynamicValues, hasDynamic } = partitionForBuild(styles, { scopeSelector: '.btn' });
// css: '.btn { background-color: red; }'
// dynamicValues: { color: <function> }
// hasDynamic: true
```

Vite Plugin

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

Setup
Create a CSS generation script and add it to your package.json:

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

Debug Mode

```ts
const debugChain = chain({ debug: true })
  .bg('red')
  .color(() => themeColor)
  .padding(16);

console.log(debugChain.explain().visualization);
```
Output:
```text
ChainCSS Style Explanation
--------------------------
bg       -> red      (static)
color    -> <fn>     (dynamic)
padding  -> 16       (static)
--------------------------
Static: 2 | Dynamic: 1
```

Class Names
`chain().$el('button')` produces the selector `.chain-button`. To use it in JSX:

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

Framework Integration
ChainCSS is framework-agnostic. `$el()` returns a plain object:

```tsx
// React
<div style={styles}>...</div>

// Vue
<div :style="styles">...</div>

// Svelte
<div style={styles}>...</div>

// Plain HTML (with CSS file)
<div class="chain-button">...</div>
```

API Reference
Main Exports

| Export | Description |
| :--- | :--- |
| chain(options?) | Create a style chain |
| compileToCSS(obj, opts?) | Compile style object to CSS string |
| partitionForBuild(obj, opts?) | Split static/dynamic, return { css, dynamicValues } |
| classifyValue(value) | Returns 'static' or 'dynamic' |
| partitionStyles(obj) | Split object into { static, dynamic } |
| compileToCSS | Generate CSS from style object |

Value Classification

| Value type | Classification | Behavior |
| :--- | :--- | :--- |
| '#6366f1' (string) | static | Compiled to CSS |
| 16 (number) | static | Compiled to CSS (px added if needed) |
| () => themeColor (function) | dynamic | Stays in JS, resolved at runtime |
| 'theme.primary' (token ref) | dynamic | Resolved at runtime |

Migration from v2.3

| Old API | New API |
| :--- | :--- |
| createChain() | chain() |
| smartChain() | chain() |
| buildChain() | chain() — static values auto-detected |
| runtimeChain() | chain() — dynamic values auto-detected |
| btt.compile() | compileToCSS() |
| btt.run() | compileToCSS() |
| enableDebug() | chain({ debug: true }) |

License
MIT

Author
Rommel Caneos