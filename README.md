<h1 align="center">ChainCSS</h1>

<p align="center">
  <strong>The CSS-in-JS platform with compiler intelligence.</strong><br>
  Zero runtime by default. Semantic styling. WCAG-aware. Intent-driven.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/chaincss">
    <img src="https://img.shields.io/npm/v/chaincss" alt="npm">
  </a>

  <a href="https://github.com/melcanz08/chaincss/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/melcanz08/chaincss" alt="license">
  </a>

  <a href="https://github.com/melcanz08/chaincss/actions">
    <img src="https://img.shields.io/badge/tests-708%20passed-brightgreen" alt="tests">
  </a>

  <a href="https://github.com/melcanz08/chaincss">
    <img src="https://img.shields.io/badge/modules-17-blue" alt="modules">
  </a>
</p>



# What is ChainCSS?

ChainCSS lets you write styles as **native JavaScript method chains** — no CSS syntax, no template literals, no object literals.

It automatically detects which styles are static (compiled to zero-runtime CSS) and which are dynamic (stay in JS), then splits them automatically.

ChainCSS is also a **CSS intelligence platform** — not just a styling library.

It writes, checks, and optimizes your styles at build time with zero runtime cost.

```ts
import { chain } from "chaincss";

// A single intent expands to a full,
// accessible, responsive card:
const card = chain()
  .intent("card")
  .$el("card");

// Or write explicit styles:
const hero = chain()
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
  .$el("hero");
```

**No CSS syntax. No template literals. Compiler-enforced quality.**


# Constraint-Based Styling

Declare relationships, not values. The constraint solver compiles them to native CSS at build time.

**No runtime JS. No manual `calc()`. The compiler picks the best CSS feature.**

---

## 1. Aspect Ratios from Math

Describe the relationship between width and height:

```ts
chain()
  .constrain("height", "= width * 0.5") // 2:1 ratio
  .constrain("width", "< parent")       // Don't overflow container
  .$el("video");
```

### Compiles to

```css
.video {
  aspect-ratio: 1 / 2;
  max-width: 100%;
}
```

The solver detects `width * 0.5` and emits `aspect-ratio` instead of:

```css
height: calc(width * 0.5);
```

`aspect-ratio` has better performance and avoids layout shifts.

### Tailwind Equivalent

```txt
aspect-[2/1] max-w-full
```

### ChainCSS Difference

You write the math. The compiler writes the CSS.

---

## 2. Container-Aware Responsive Layouts

Use conditional constraints to generate `@container` queries automatically.

```ts
chain()
  .constrain("columns", ">= 3 when > 768px")
  .constrain("gap", "= 24px")
  .$el("grid");
```

### Compiles to

```css
.grid {
  gap: 24px;
}

@container (min-width: 768px) {
  .grid {
    columns: 3;
  }
}
```

> Requires `container-type: inline-size` on the parent.  
> ChainCSS adds it automatically when container constraints are detected.

---

## 3. Fluid Values with `clamp()`

Stop calculating `clamp()` manually.

```ts
chain()
  .constrain("fontSize", "= clamp(14px, 5vw, 24px)")
  .constrain("padding", "= clamp(16px, 4vw, 32px)")
  .$el("hero");
```

### Compiles to

```css
.hero {
  font-size: clamp(14px, 5vw, 24px);
  padding: clamp(16px, 4vw, 32px);
}
```

Works with:

- `clamp()`
- `min()`
- `max()`
- `calc()`

---

## 4. Scroll-Driven Sticky Positioning

"Stick this element until another element reaches the viewport."

```ts
chain()
  .constrain("sidebar", "sticky until footer")
  .$el("sidebar");
```

### Compiles to

```css
.sidebar {
  position: sticky;
  top: 0;

  animation: sticky-sidebar 1s linear both;
  animation-timeline: scroll();
  animation-range: contain 0% contain 100%;
}

@keyframes sticky-sidebar {
  to {
    position: relative;
  }
}
```

Zero JavaScript. Uses native `animation-timeline: scroll()` available in modern Chromium browsers.

---

## 5. Parent-Relative Constraints

Keep elements inside their parents without writing media queries.

```ts
chain()
  .constrain("width", "< parent")
  .constrain("width", "> 320px")
  .$el("modal");
```

### Compiles to

```css
.modal {
  max-width: 100%;
  min-width: 320px;
}
```

---

# How It Works

The compiler parses constraint expressions and resolves them into the most optimal native CSS feature.

| You Write | Compiler Resolves To | Strategy |
|---|---|---|
| `width < parent` | `max-width: 100%` | Direct mapping |
| `height = width * 0.5` | `aspect-ratio: 1 / 2` | Aspect-ratio optimization |
| `fontSize = clamp(14, 5vw, 24)` | `font-size: clamp(...)` | Native clamp |
| `columns >= 3 when > 768px` | `@container (min-width: 768px)` | Container query |
| `sidebar sticky until footer` | `animation-timeline: scroll()` | Scroll timeline |

---

## Supported Operators

```txt
<   >   <=   >=   =   !=
```

## Supported References

```txt
parent
viewport
self
sibling.width
```

## Supported Functions

```txt
clamp()
min()
max()
calc()
```

---

# Debugging Constraints

See how constraints were resolved during compilation.

## CLI

```bash
chaincss build --explain
```

### Output

```txt
card: height = width * 0.5 → aspect-ratio: 1/2
card: width < parent → max-width: 100%
```

---

## Programmatic Debugging

```ts
import { resolveConstraint } from "chaincss/compiler";

const result = resolveConstraint({
  property: "height",
  operator: "=",
  expression: "width * 0.5",
});

console.log(result.explanation);
// "height = width * 0.5 → aspect-ratio: 1/2"
```


# What Makes ChainCSS Different

| Capability | ChainCSS | Tailwind | StyleX | Vanilla Extract |
|---|---|---|---|---|
| Zero runtime | ✅ | ✅ | ✅ | ✅ |
| Intent-based API | ✅ | ❌ | ❌ | ❌ |
| Semantic tokens | ✅ | ❌ | ❌ | ❌ |
| WCAG accessibility checking | ✅ | ❌ | ❌ | ❌ |
| Responsive inference | ✅ | ❌ | ❌ | ❌ |
| Pattern learning | ✅ | ❌ | ❌ | ❌ |
| CSS `if()` transpiler | ✅ | ❌ | ❌ | ❌ |
| Constraint-based styling | ✅ | ❌ | ❌ | ❌ |
| Layout intelligence | ✅ | ❌ | ❌ | ❌ |
| Scroll-driven animations | ✅ | ❌ | ❌ | ❌ |
| Self-healing CSS | ✅ | ❌ | ❌ | ❌ |
| Source-aware optimization | ✅ | ❌ | ❌ | ❌ |
| Design system extraction | ✅ | ❌ | ❌ | ❌ |
| 3 modes (build/runtime/hybrid) | ✅ | ❌ | ❌ | ❌ |



# Installation

```bash
npm install chaincss
```


# Quick Start

| Environment | Setup |
|---|---|
| Vite | Add `chaincss()` plugin to `vite.config.ts` |
| Node.js | `import { chain } from "chaincss"` |
| Browser CDN | `import { chain } from "https://cdn.jsdelivr.net/npm/chaincss/dist/browser.js"` |


# Intent API (v2.3)

The highest-level API.

Write what you want — the compiler figures out how.

```ts
// Layout intents
chain().intent("center-content").$el("centered");
chain().intent("stack").$el("stack");
chain().intent("sidebar-layout").$el("dashboard");

// Component intents
chain().intent("card").$el("card");
chain().intent("button-primary").$el("cta");
chain().intent("modal").$el("dialog");

// Semantic intents
chain().intent("hero-section").$el("hero");
chain().intent("sticky-header").$el("nav");

// Interaction intents
chain().intent("hover-lift").$el("interactive");
chain().intent("focus-ring").$el("accessible");
```

Each intent triggers:
- semantic tokens
- responsive overrides
- accessibility checks
- theme adaptation

—all at build time.



# Semantic Tokens

```ts
chain()
  .surface("interactive")
  .text("primary")
  .elevation("floating")
  .spacing("comfortable")
  .state("hover")
  .state("focus")
  .$el("composed");
```

| Category | Available Intents |
|---|---|
| surface | interactive, container, overlay, sheet |
| text | primary, secondary, muted, link |
| elevation | flat, raised, floating, modal |
| spacing | none, tight, compact, spacious |
| state | hover, active, focus, disabled |



# Compiler Intelligence

ChainCSS analyzes your styles at build time and reports issues before they ship.

```ts
chain()
  .width("1200px")
  .color("#999")
  .fontSize("10px")
  .outline("none")
  .animation("fadeIn 1s")
  .$el("risky-button");
```

The compiler can:
- detect WCAG contrast failures
- fix invalid font sizes
- add focus-visible fallbacks
- wrap animations in reduced-motion queries
- prevent mobile overflow



# Constraint-Based Styling

```ts
chain()
  .constrain("width", "< parent")
  .constrain("height", "= width * 0.5")
  .constrain("columns", ">= 3 when > 768px")
  .$el("responsive-card");
```



# Scroll Timeline Engine

```ts
import {
  createScrollAnimation,
  compileScrollAnimation
} from "chaincss";

const fadeIn = createScrollAnimation(
  "fadeIn",
  ".reveal"
);

const parallax = createScrollAnimation(
  "parallax",
  ".bg"
);
```

Native scroll-driven animations with zero JavaScript runtime.



# Core API

## The Chain

```ts
import { chain } from "chaincss";

const styles = chain()
  .display("flex")
  .padding(20)
  .color("red")
  .$el("my-component");
```

## Smart Chain

```ts
import { smartChain } from "chaincss";

const styles = smartChain()
  .display("flex")
  .padding(20)
  .color(props.textColor)
  .fontSize(theme.sizes.lg)
  .$el("hybrid-card");
```



# Shorthands

```ts
chain()
  .bg("#fff")
  .m(16)
  .p(20)
  .br(8)
  .fs(16)
  .fw(700)
  .c("#333");
```


# Macros

```ts
chain().flex();
chain().grid();
chain().center();
chain().stack(16);
chain().glass();
chain().glow("#6366f1");
chain().focusRing("#3b82f6");
```



# Conditional Styles

```ts
chain()
  .padding(12)
  .when(isActive, c =>
    c.background("#10b981")
      .color("white")
  )
  .$el("stateful-btn");
```



# Responsive Design

```ts
chain()
  .display("flex")
  .flexDirection("column")
  .responsive("md", c =>
    c.flexDirection("row")
  )
  .$el("responsive");
```



# Math Engine

```ts
import {
  math,
  add,
  fluidType,
  convert
} from "chaincss";

add("10px", "2rem");

fluidType({
  minSize: 14,
  maxSize: 20
});

convert("32px", "rem");
```



# Design Tokens

```ts
import {
  createTokens,
  createThemeContract,
  createTheme
} from "chaincss";

const tokens = createTokens({
  colors: {
    primary: "#6366f1",
    secondary: "#10b981"
  }
});
```



# Recipe System

```ts
import { recipe } from "chaincss";

const button = recipe({
  base: {
    selectors: ["btn"],
    display: "inline-flex",
    borderRadius: "8px"
  }
});
```



# Animations

```ts
chain()
  .fadeIn()
  .slideInUp()
  .zoomIn()
  .bounce()
  .pulse()
  .$el("animated");
```



# Self-Healing CSS

```ts
import { correct, heal } from "chaincss";

correct("display", "flexbox");
correct("position", "abs");

heal(
  {
    display: "flexbox",
    position: "abs"
  },
  "smart"
);
```



# CLI

```bash
chaincss init
chaincss build
chaincss watch
chaincss cache clear
chaincss optimize --report
chaincss doctor
```



# Performance

- Zero runtime for static styles
- Atomic CSS extraction
- Smart static/dynamic splitting
- Cross-file dead code elimination
- Multi-pass optimization pipeline



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
  <strong>ChainCSS v2.3</strong> — The CSS intelligence platform.<br>

  <a href="https://github.com/melcanz08/chaincss">
    github.com/melcanz08/chaincss
  </a>
</p>
