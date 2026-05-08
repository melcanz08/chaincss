<h1 align="center">ChainCSS</h1>

<p align="center">
  <strong>The first CSS-in-JS library with true auto-detection mixed mode.</strong><br>
  Zero runtime by default. Dynamic when you need it. No compromises.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/chaincss">
    <img src="https://img.shields.io/npm/v/chaincss" alt="npm">
  </a>
  <a href="https://github.com/melcanz08/chaincss/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/melcanz08/chaincss" alt="license">
  </a>
  <a href="https://chaincss.dev">
    <img src="https://img.shields.io/badge/docs-chaincss.dev-blue" alt="docs">
  </a>
  <a href="https://github.com/melcanz08/chaincss/actions">
    <img src="https://img.shields.io/badge/tests-258%20passed-brightgreen" alt="tests">
  </a>
</p>


# What is ChainCSS?

ChainCSS lets you write styles as **native JavaScript method chains** — no CSS syntax, no template literals, no object literals.

It automatically detects which styles are static (compiled to zero-runtime CSS) and which are dynamic (stay in JS), then splits them automatically.

```ts
import { chain } from "chaincss";

const card = chain()
  .display("flex")
  .flexDirection("column")
  .gap(16)
  .padding(24)
  .background("white")
  .borderRadius(12)
  .hover()
    .boxShadow("0 4px 12px rgba(0,0,0,0.15)")
    .transform("translateY(-2px)")
  .end()
  .$el("card");
```

**No CSS syntax. No template literals. No object literals. Just JavaScript.**


# Installation

```bash
npm install chaincss
```

## Quick Start

| Environment | Setup |
|---|---|
| **Vite** | Add `chaincss()` plugin to `vite.config.ts` |
| **Node.js** | `import { chain } from "chaincss"` |
| **Browser CDN** | `import { chain } from "https://cdn.jsdelivr.net/npm/chaincss/dist/browser.js"` |
| **Browser + import map** | Map `"chaincss"` to `./node_modules/chaincss/dist/browser.js` |


## Vite Configuration

```ts
// vite.config.ts
import { defineConfig } from "vite";
import chaincss from "chaincss/plugin/vite";

export default defineConfig({
  plugins: [chaincss({ atomic: true })],
});
```


# Core API

## The Chain

Every style starts with `chain()` and ends with `$el()`.

```ts
import { chain } from "chaincss";

const styles = chain()
  .display("flex")
  .padding(20)
  .color("red")
  .$el("my-component");
```

## Smart Chain (Auto-Detection)

```ts
import { smartChain } from "chaincss";

const styles = smartChain()
  .display("flex")
  .padding(20)
  .color(props.textColor)
  .fontSize(theme.sizes.lg)
  .$el("hybrid-card");
```

## Runtime Injection

```ts
import { chain, injectChainStyles } from "chaincss";

const heading = chain()
  .fs(48)
  .fw(800)
  .textGradient(["#6366f1", "#06b6d4"])
  .$el("h1");

injectChainStyles({ heading });
```


# Feature Reference

## Shorthands (80+)

```ts
chain()
  .bg("#fff")
  .m(16)
  .p(20)
  .br(8)
  .fs(16)
  .fw(700)
  .c("#333")
  .w(200)
  .h(100)
  .d("flex")
  .z(10)
  .op(0.5)
  .ov("hidden")
  .pos("relative");
```


## Macros (57)

### Layout & Display

```ts
chain().flex();
chain().grid();
chain().center();
chain().flexCenter();
chain().gridCenter();
chain().stack(16);
chain().cols(3);
chain().rows(2);
chain().bento(4);
chain().gridTable("200px");
```

### Spacing

```ts
chain().mx(10);
chain().my(20);
chain().px(16);
chain().py(24);
chain().size(50);
chain().gap(16);
chain().gapX(8);
chain().gapY(12);
chain().inset(0);
chain().insetX(16);
chain().insetY(8);
```

### Borders

```ts
chain().borderX("1px solid red");
chain().borderY("1px solid blue");
```

### Positioning

```ts
chain().absolute({ top: 0, left: 0 });
chain().fixed({ top: 0, right: 0 });
chain().sticky({ top: 0 });
chain().relative();
```

### Visibility & Behavior

```ts
chain().hide();
chain().show();
chain().unselectable();
chain().scrollable("y");
chain().safeArea("top");
```

### Shapes & Typography

```ts
chain().circle(50);
chain().square(40);
chain().pill();
chain().truncate();
chain().aspect("16/9");
chain().aspect("square");
chain().fluidText({ min: 16, max: 24 });
chain().lineClamp(3);
```

### Aesthetic Effects

```ts
chain().glass();
chain().glass(5);
chain().glow("#ff0000");
chain().glow({ color: "#6366f1", size: 20 });
chain().textGradient(["#667eea", "#764ba2"]);
chain().meshGradient(["#f0f", "#0ff", "#ff0", "#0f0"]);
chain().noise(0.05);
chain().shimmer();
```

### State & Interactions

```ts
chain().clickScale(0.95);
chain().pressable();
chain().focusRing("#3b82f6");
chain().skeleton(true);

chain()
  .dark(c => c.bg("#1a202c").c("white"))
  .light(c => c.bg("white").c("#1a202c"));
```

### Utility

```ts
chain().fullScreen();
chain().containerMacro(1200);
chain().outlineDebug();
chain().parallax(2);
chain().frostedNav(15);
```

## Conditional Styles

```ts
chain()
  .padding(12)
  .when(isActive, c => c.background("#10b981").color("white"))
  .when(isDisabled, c => c.opacity(0.5).cursor("not-allowed"))
  .$el("stateful-btn");
```

## Nested Selectors

```ts
chain()
  .display("flex")
  .nest("& > *", c => c.flex(1))
  .nest("&:first-child", c => c.fontWeight(700))
  .nest(".child", c => c.color("red"))
  .$el("flex-container");
```

### Mixins with use()

```ts
const shared = { display: "flex", alignItems: "center", gap: 8 };
chain().use(shared).padding(20).$el("reused");
```

## Responsive Design

```ts
chain()
  .display("flex")
  .flexDirection("column")
  .responsive("md", c => c.flexDirection("row"))
  .media("(min-width: 1024px)", c => c.maxWidth(1200))
  .$el("responsive");
```

**Built-in breakpoints (20):** `sm`, `md`, `lg`, `xl`, `2xl`, `mobile`, `tablet`, `desktop`, `portrait`, `landscape`, `dark`, `light`, `reducedMotion`, `highContrast`, `print`, `hover`, `no-hover`, `fine`, `coarse`

## Transform Methods

```ts
chain()
  .scale(1.1)
  .rotate("45deg")
  .x(10)
  .y(20)
  .skew("5deg")
  .$el("transformed");
```

### Math Helpers (15)

```ts
chain()
.width(helpers.calc("100% - 20px"))
.fontSize(helpers.clamp(16, 4, 24))
.margin(helpers.add(10, 20))
.$el("calculated");

// helpers.add(), .sub(), .mul(), .div(), .sum(), .difference()
// helpers.mpx(), .rem(), .em(), .percent(), .vw(), .vh()
// helpers.min(), .max(), .clamp(), .round(), .rgba(), .hsla()
// helpers.fluidType(min, max, minWidth, maxWidth)
```

## Design Tokens

```ts
import { createTokens } from "chaincss";

const tokens = createTokens({
  colors: {
    primary: "#6366f1",
    secondary: "#10b981",
  },
  spacing: {
    sm: "8px",
    md: "16px",
    lg: "24px",
  },
});
```

### Theme Contracts

```ts
import { createThemeContract, createTheme, validateTheme } from "chaincss";

const contract = createThemeContract({
colors: { primary: "", background: "" },
spacing: { sm: "", md: "" },
});

const light = createTheme(contract, {
colors: { primary: "#3b82f6", background: "#fff" },
spacing: { sm: "8px", md: "16px" },
});

const theme = new Theme(light);
theme.toCSSVariables("my-theme"); // -> :root { --my-theme-colors-primary: #3b82f6; ... }
```

## Recipe System (Variants)

```ts
import { recipe } from "chaincss";

const button = recipe({
base: { selectors: ["btn"], display: "inline-flex", borderRadius: "8px", fontWeight: 600 },
variants: {
size: {
sm: { padding: "8px 16px", fontSize: "14px" },
lg: { padding: "16px 32px", fontSize: "18px" },
},
color: {
primary: { background: "#3b82f6", color: "white" },
danger: { background: "#ef4444", color: "white" },
},
},
defaultVariants: { size: "md", color: "primary" },
compoundVariants: [
{ variants: { size: "lg", color: "primary" }, style: { fontWeight: 800 } },
],
});

const styles = button({ size: "lg", color: "danger" });
```

### Animations (42 presets)

```ts
chain().fadeIn().$el("el"); chain().slideInUp().$el("el");  chain().slideInUp().$el("el");
chain().zoomIn().$el("el"); chain().bounce().$el("el"); chain().bounce().$el("el");
chain().pulse().$el("el");  chain().spin().$el("el"); chain().spin().$el("el");
chain().shake().$el("el");  chain().wiggle().$el("el"); chain().wiggle().$el("el");
chain().float().$el("el");  chain().flash().$el("el");  chain().flash().$el("el");
chain().textReveal().$el("el");

// Custom animation
chain().animate("myName", { "0%": { opacity: 0 }, "100%": { opacity: 1 } }, { duration: "0.5s" }).$el("el");
```

### Suggestions Engine

```ts
import { getSuggestion, getSuggestions } from "chaincss";

getSuggestion("bakcground"); // -> "background"
getSuggestion("felx"); // -> "flex"
getSuggestions("bordr"); // -> ["border", "borderW", "borderC"]
```

### Style Timeline

```ts
import { enableTimeline, getStyleHistory, getStyleDiff } from "chaincss";

enableTimeline(true);
// ... compile styles ...
const history = getStyleHistory();
const diff = getStyleDiff(snapshotId1, snapshotId2);
// -> { added: {...}, removed: {...}, modified: {...} }
```


# CLI

```bash
chaincss init
chaincss build
chaincss watch
chaincss cache clear
chaincss cache stats
chaincss timeline list
```


# Configuration

```ts
// chaincss.config.js
export default {
  inputs: ["src/**/*.chain.{js,ts}", "src/**/*.tsx"],

  output: {
    cssFile: "global.css",
    minify: true,
  },

  atomic: {
    enabled: true,
    mode: "hybrid",
    threshold: 2,
    naming: "hash",
  },

  breakpoints: {
    sm: "(min-width: 640px)",
    md: "(min-width: 768px)",
  },

  tokens: {
    enabled: true,
    prefix: "$",
  },
};
```


# Framework Integration

## React

```tsx
import { chain } from "chaincss";

function Card() {
  const styles = chain()
    .bg("white")
    .p(24)
    .rounded(12)
    .$el("card");

  return (
    <div className={styles.selectors[0]}>
      Content
    </div>
  );
}
```

## Vue

```ts
import { chain } from "chaincss";

const styles = chain().display("grid").cols(3).gap(16).$el("grid");
// <div :class="styles.selectors[0]">
```

## Svelte

```ts
import { chain } from "chaincss";

const styles = chain().flex().center().$el("centered");
// <div class={styles.selectors[0]}>
```

### Vanilla JS

```html
<script type="module"> 
  import { chain, injectChainStyles } from "https://cdn.jsdelivr.net/npm/chaincss/dist/browser.js"; 
  const h1 = chain()
    .fs(48)
    .fw(800)
    .textGradient(["#6366f1","#06b6d4"])
    .$el("h1");

  injectChainStyles({ h1 }); 

  document.body.innerHTML = '<h1 class="' + h1.selectors[0] + '">Hello!</h1>'; 
</script>
```


## Complete Feature List

| Category | Count | Details |
|----------|-------|---------|
| Macros | 57 | Layout, spacing, borders, positioning, visibility, shapes, effects, state, utility |
| Shorthand Properties | 80 | 1-to-1 CSS property mappings |
| Animation Presets | 42 | Fades, slides, zooms, bounces, shakes, spins, flips, special effects |
| Breakpoints | 20 | Mobile-first, desktop-first, device-specific, feature queries |
| Chain API Methods | 30+ | hover, nest, when, use, responsive, media, supports, containerQuery, layer |
| Math Helpers | 15 | calc, add, sub, mul, div, clamp, min, max, unit conversions, fluidType |
| CSS Properties | 300+ | Every standard CSS property via type definitions |
| CLI Commands | 5 | init, build, watch, cache, timeline |
| Framework Integrations | 4 | React, Vue, Svelte, Solid |
| Plugins | 2 | Vite, Webpack |
| Bundles | 5 | Main, Runtime, Browser, Compiler, CLI |
| React Hooks | 6 | useSmartStyles, createSmartComponent, useChainStyles, useDynamicChainStyles, useThemeChainStyles, withSmartStyles |
| Design Systems | 3 | Tokens, Theme Contracts, Recipes |
| Dev Tools | 3 | Suggestions Engine, Timeline, Component Generator |
| Tests | 258 | 18 test files, 0 failures |


# Performance

- Zero runtime for static styles
- Atomic CSS extraction
- Smart static/dynamic splitting
- LRU persistent caching
- Shared property deduplication


# Contributing

```bash
git clone https://github.com/melcanz08/chaincss.git

cd chaincss

npm install

npm test
```


# License

MIT © Rommel Caneos

<p align="center">
  <strong>ChainCSS</strong> — Write styles like JavaScript. Ship zero runtime.<br>
  <a href="https://chaincss.dev">chaincss.dev</a>
</p>
