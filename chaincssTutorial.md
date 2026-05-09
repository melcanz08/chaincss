# ChainCSS v2.3 — Comprehensive Tutorial

> **The CSS Intelligence Platform** — Write styles as JavaScript. Compiler-enforced quality. Zero runtime.

---

# Table of Contents

1. [Installation & Setup](#1-installation--setup)
2. [The Chain API](#2-the-chain-api)
3. [Shorthands](#3-shorthands)
4. [Macros](#4-macros)
5. [Intent API](#5-intent-api)
6. [Semantic Tokens](#6-semantic-tokens)
7. [Responsive Design](#7-responsive-design)
8. [Conditional Styles](#8-conditional-styles)
9. [Nested Selectors & Mixins](#9-nested-selectors--mixins)
10. [Math Engine](#10-math-engine)
11. [Constraint-Based Styling](#11-constraint-based-styling)
12. [Design Tokens & Themes](#12-design-tokens--themes)
13. [Recipe System](#13-recipe-system)
14. [Animations](#14-animations)
15. [Scroll Timeline Engine](#15-scroll-timeline-engine)
16. [Self-Healing CSS](#16-self-healing-css)
17. [Compiler Intelligence](#17-compiler-intelligence)
18. [Accessibility Engine](#18-accessibility-engine)
19. [Source-Aware Optimization](#19-source-aware-optimization)
20. [CLI Commands](#20-cli-commands)
21. [Framework Integration](#21-framework-integration)
22. [Configuration](#22-configuration)

---

# 1. Installation & Setup

## Install

```bash
npm install chaincss
```

---

## Vite Setup

```ts
// vite.config.ts
import { defineConfig } from "vite";
import chaincss from "chaincss/plugin/vite";

export default defineConfig({
  plugins: [
    chaincss({
      atomic: true,
      minify: false,
      verbose: false,
      hmr: true,
    }),
  ],
});
```

---

## Quick Start

```ts
import { chain } from "chaincss";

const styles = chain()
  .display("flex")
  .padding(20)
  .color("red")
  .$el("my-component");
```

---

## Three Modes

| Mode | API | Use Case |
|---|---|---|
| Build-time | `chain()` | Static styles |
| Runtime | `chain()` in browser | Dynamic styles |
| Hybrid | `smartChain()` | Static + dynamic |

```ts
import { smartChain } from "chaincss";

const styles = smartChain()
  .display("flex")
  .padding(20)
  .color(props.textColor)
  .fontSize(theme.sizes.lg)
  .$el("hybrid-card");
```

---

# 2. The Chain API

Every chain starts with `chain()` and ends with `$el()`.

## Basic Usage

```ts
const card = chain()
  .display("flex")
  .flexDirection("column")
  .gap(16)
  .padding(24)
  .backgroundColor("white")
  .borderRadius(12)
  .boxShadow("0 2px 8px rgba(0,0,0,0.1)")
  .$el("card");
```

---

## The `$el()` Method

```ts
// Single selector
chain().color("red").$el("heading");

// Multiple selectors
chain().color("red").$el("h1", "h2", "h3");

// Raw styles
chain().color("red").$el();
```

---

## Debugging

```ts
chain()
  .debug()
  .explain("bg")
  .bg("white")
  .$el("debugged");
```

---

# 3. Shorthands

## Spacing

```ts
chain()
  .m(16)
  .mt(8)
  .mr(12)
  .mb(8)
  .ml(12)
  .mx(20)
  .my(10)
  .p(24)
  .pt(16)
  .pr(16)
  .pb(16)
  .pl(16)
  .px(20)
  .py(12);
```

---

## Sizing

```ts
chain()
  .w(200)
  .h(100)
  .minW(300)
  .maxW(1200)
  .minH(200)
  .maxH(800)
  .size(50);
```

---

## Typography

```ts
chain()
  .bg("#f0f0f0")
  .c("#333")
  .fs(16)
  .fw(700)
  .lh(1.5)
  .ls("0.5px")
  .ta("center");
```

---

# 4. Macros

## Layout

```ts
chain().flex();
chain().inlineFlex();
chain().flexCenter();
chain().grid();
chain().gridCenter();
chain().stack(16);
chain().bento(4);
```

---

## Effects

```ts
chain()
  .glass()
  .glow("#6366f1")
  .textGradient(["#667eea", "#764ba2"])
  .meshGradient(["#f0f", "#0ff", "#ff0"]);
```

---

## State & Interaction

```ts
chain()
  .clickScale(0.95)
  .pressable()
  .focusRing("#3b82f6")
  .skeleton(true);
```

---

# 5. Intent API

```ts
// Layout
chain().intent("center-content").$el("centered");
chain().intent("stack").$el("stack");
chain().intent("sidebar-layout").$el("dashboard");

// Components
chain().intent("card").$el("card");
chain().intent("button-primary").$el("cta");
chain().intent("modal").$el("dialog");

// Semantic
chain().intent("hero-section").$el("hero");
chain().intent("sticky-header").$el("nav");

// Interaction
chain().intent("hover-lift").$el("interactive");
chain().intent("focus-ring").$el("accessible");
```

---

# 6. Semantic Tokens

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

---

# 7. Responsive Design

```ts
chain()
  .display("flex")
  .flexDirection("column")
  .responsive("md", c =>
    c.flexDirection("row")
  )
  .$el("responsive");
```

---

## Container Queries

```ts
chain()
  .containerQuery("(min-width: 400px)", c =>
    c.gridTemplateColumns("1fr 1fr")
  )
  .$el("container-responsive");
```

---

# 8. Conditional Styles

## `when()`

```ts
chain()
  .padding(12)
  .when(isActive, c =>
    c.background("#10b981")
      .color("white")
  )
  .when(isDisabled, c =>
    c.opacity(0.5)
      .cursor("not-allowed")
  )
  .$el("stateful-btn");
```

---

## CSS `if()`

```ts
chain()
  .background("if(style(--theme: dark): #1a1a1a else #ffffff)")
  .color("if(style(--theme: dark): white else black)")
  .$el("theme-aware");
```

---

# 9. Nested Selectors & Mixins

## Nested Selectors

```ts
chain()
  .display("flex")
  .nest("& > *", c => c.flex(1))
  .nest("&:first-child", c => c.fontWeight(700))
  .nest(".child", c => c.color("red"))
  .$el("flex-container");
```

---

## Mixins

```ts
const flexCenter = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

chain()
  .use(flexCenter)
  .padding(24)
  .$el("composed-card");
```

---

# 10. Math Engine

## Import

```ts
import {
  math,
  add,
  subtract,
  multiply,
  divide,
  fluidType,
  convert,
  scale
} from "chaincss";
```

---

## Basic Arithmetic

```ts
add("10px", "20px");
subtract("50px", "20px");
multiply("10px", 3);
divide("100px", 4);
```

---

## Fluid Typography

```ts
fluidType({
  minSize: 14,
  maxSize: 20
});
```

---

# 11. Constraint-Based Styling

```ts
chain()
  .constrain("width", "< parent")
  .constrain("height", "= width * 0.5")
  .constrain("columns", ">= 3 when > 768px")
  .$el("responsive-card");
```

---

# 12. Design Tokens & Themes

## Creating Tokens

```ts
import { createTokens } from "chaincss";

const tokens = createTokens({
  colors: {
    primary: "#2563eb",
    success: "#10b981",
  },

  spacing: {
    sm: "8px",
    md: "16px",
    lg: "24px",
  },
});
```

---

## Theme Contracts

```ts
import {
  createThemeContract,
  createTheme
} from "chaincss";

const contract = createThemeContract({
  colors: {
    primary: "",
    background: "",
  },
});

const lightTheme = createTheme(contract, {
  colors: {
    primary: "#3b82f6",
    background: "#ffffff",
  },
});
```

---

# 13. Recipe System

```ts
import { recipe } from "chaincss";

const button = recipe({
  base: {
    selectors: ["btn"],
    display: "inline-flex",
    borderRadius: "8px",
  },

  variants: {
    size: {
      sm: { padding: "8px 16px" },
      lg: { padding: "16px 32px" },
    },
  },
});
```

---

# 14. Animations

## Presets

```ts
chain().fadeIn().$el("el");
chain().slideInUp().$el("el");
chain().zoomIn().$el("el");
chain().bounce().$el("el");
chain().pulse().$el("el");
chain().spin().$el("el");
```

---

## Custom Animation

```ts
chain()
  .animate(
    "myBounce",
    {
      "0%": { transform: "scale(1)" },
      "50%": { transform: "scale(1.2)" },
      "100%": { transform: "scale(1)" },
    },
    {
      duration: "0.5s",
      timing: "ease-in-out",
    }
  )
  .$el("custom-animated");
```

---

# 15. Scroll Timeline Engine

```ts
import {
  createScrollAnimation,
  compileScrollAnimation,
} from "chaincss";

const fadeIn = createScrollAnimation(
  "fadeIn",
  ".reveal"
);
```

---

# 16. Self-Healing CSS

```ts
import { correct, heal } from "chaincss";

correct("display", "flexbox");
correct("position", "abs");

heal(
  {
    display: "flexbox",
    position: "abs",
  },
  "smart"
);
```

---

# 17. Compiler Intelligence

```ts
chain()
  .width("1200px")
  .fontSize("48px")
  .$el("hero");
```

The compiler can:
- prevent mobile overflow
- infer responsive layouts
- detect inaccessible font sizes
- optimize layouts automatically

---

# 18. Accessibility Engine

| Check | WCAG | Auto Fix |
|---|---|---|
| Contrast ratio | 1.4.3 AA | No |
| Font size | 1.4.4 AA | Yes |
| Touch target | 2.5.8 AA | Yes |
| Focus indicator | 2.4.7 AA | Yes |

---

# 19. Source-Aware Optimization

Detects:
- duplicate styles
- dead CSS
- specificity wars
- animation conflicts
- redundant media queries

---

# 20. CLI Commands

```bash
chaincss init
chaincss build
chaincss watch
chaincss cache clear
chaincss cache stats
chaincss optimize --report
chaincss doctor
```

---

# 21. Framework Integration

## React

```tsx
import { chain } from "chaincss";

function Card({ children }) {
  const styles = chain()
    .intent("card")
    .$el("card");

  return (
    <div className={styles.selectors[0]}>
      {children}
    </div>
  );
}
```

---

## Vue

```vue
<script setup>
import { chain } from "chaincss";

const styles = chain()
  .grid()
  .cols(3)
  .gap(16)
  .$el("grid");
</script>

<template>
  <div :class="styles.selectors[0]">
    <slot />
  </div>
</template>
```

---

## Svelte

```svelte
<script>
  import { chain } from "chaincss";

  const styles = chain()
    .flex()
    .center()
    .$el("centered");
</script>

<div class={styles.selectors[0]}>
  <slot />
</div>
```

---

# 22. Configuration

```ts
// chaincss.config.ts
import { defineConfig } from "chaincss";

export default defineConfig({
  atomic: {
    enabled: true,
    mode: "hybrid",
  },

  tokens: {
    enabled: true,
    prefix: "$",
  },

  breakpoints: {
    sm: "(min-width: 640px)",
    md: "(min-width: 768px)",
  },
});
```

## 23. Power Macros

### `autoContrast()`

Automatically generates accessible foreground colors based on WCAG contrast rules.

```ts
import { intent } from "chaincss";

intent.autoContrast("#1a1a1a"); // "#ffffff"
intent.autoContrast("#ffffff"); // "#000000"
intent.autoContrast("#a0c4ff"); // "#000000"

chain()
  .backgroundColor("#1a1a1a")
  .color(intent.autoContrast("#1a1a1a"))
  .$el("accessible");
```

### Smart Layout Macros

```ts
chain()
  .stack("vertical center gap-4")
  .glass()
  .hoverLift()
  .$el("smart-layout");
```

### Auto Grid

Automatically creates responsive grid layouts.

```ts
chain()
  .autoGrid({
    min: 250,
    gap: 24,
  })
  .$el("gallery");
```

Compiles to:

```css
grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
gap: 24px;
```

### Smart Container

```ts
chain()
  .containerMacro(1200)
  .$el("container");
```

Compiles to:

```css
width: min(100%, 1200px);
margin-inline: auto;
padding-inline: 24px;
```

### Glassmorphism Macro

```ts
chain()
  .glass()
  .$el("glass-card");

chain()
  .glass(12)
  .$el("strong-glass");
```

### Frosted Navigation

```ts
chain()
  .frostedNav(16)
  .$el("navbar");
```

### Skeleton Loader

```ts
chain()
  .skeleton(true)
  .$el("loading-card");

chain()
  .skeleton({
    active: true,
    color: "#e5e7eb",
    shimmer: true,
  })
  .$el("advanced-loader");
```

### Interactive Macros

```ts
chain()
  .pressable()
  .clickScale(0.96)
  .focusRing("#3b82f6")
  .$el("interactive-button");
```

### Accessibility Helpers

```ts
chain()
  .visuallyHidden()
  .$el("screen-reader-only");

chain()
  .focusVisible()
  .$el("accessible-focus");
```

### Macro Autocomplete

```ts
import {
  getSuggestion,
  getAutocompleteSuggestions,
  KNOWN_MACROS,
} from "chaincss";

getSuggestion("card");
// → "card"

getSuggestion("glsas");
// → "glass"

getAutocompleteSuggestions("sticky", 10);
// → ["sticky", "stickyHeader", "stickyFooter"]

KNOWN_MACROS.length;
// → total available macros
```

---

## 24. Complete API Reference

### Core Imports

```ts
import {
  chain,
  $,
  smartChain,

  // Intent API
  intentAPI,
  resolveIntent,
  getAvailableIntents,

  // Semantic Tokens
  semanticTokens,
  resolveSemantic,
  getSemanticIntents,

  // Math Engine
  math,
  add,
  subtract,
  multiply,
  divide,
  fluidType,
  convert,
  scale,
  toPx,

  // Constraint System
  constraintSolver,
  resolveConstraint,

  // Self-Healing CSS
  intent,
  correct,
  heal,
  validateValue,
  getIntent,

  // Scroll Timeline Engine
  scrollTimeline,
  createScrollAnimation,
  compileScrollAnimation,
  getScrollPresets,

  // Accessibility Engine
  accessibilityEngine,
  auditAccessibility,

  // Optimization
  sourceOptimizer,
  optimizeSource,

  // Pattern Learning
  patternLearner,
  learnPatterns,

  // Compiler Intelligence
  orchestrator,
  contrastRatio,
  checkContrast,
  layoutIntelligence,
  recognizeLayout,
  suggestMacro,
  responsiveInference,
  analyzeResponsive,

  // CSS if() Engine
  compileIfConditions,
  generateIfCSS,

  // Compiler IR
  styleIR,
  parseIR,
  generateCSS,
  applyPass,

  // Pipeline
  PassManager,
  runDefaultPipeline,
  DEFAULT_PIPELINE,

  // Suggestions
  getSuggestion,
  getSuggestions,
  KNOWN_MACROS,

  // Design Tokens
  createTokens,
  createThemeContract,
  createTheme,
  validateTheme,
  Theme,

  // Recipes
  recipe,

  // Animations
  animationPresets,
  createAnimation,

  // Shorthands & Macros
  shorthandMap,
  macros,
  handleShorthand,

  // Timeline
  enableTimeline,
  getStyleHistory,
  getStyleDiff,

  // Compiler
  ChainCSSCompiler,
  compileChainCSS,

  // Runtime
  injectChainStyles,
  setManifest,
  setTokens,
} from "chaincss";
```

---

# Quick Reference Cards

## Chain Lifecycle

```txt
chain() -> [methods] -> $el("selector")
```

---

## Three Modes

```txt
chain()      -> build-time (zero runtime)
chain()      -> runtime (browser injection)
smartChain() -> hybrid auto-detection
```

---

## Method Categories

### Shorthand Methods

```ts
.bg()
.c()
.m()
.p()
.w()
.h()
.br()
.fs()
.fw()
```

### Layout Macros

```ts
.flex()
.grid()
.center()
.stack()
.cols()
.rows()
.glass()
.pill()
```

### Intent API

```ts
.intent("card")
.intent("button-primary")
.intent("hero-section")
.intent("sidebar-layout")
```

### Semantic Tokens

```ts
.surface()
.text()
.elevation()
.spacing()
.state()
```

### Math Helpers

```ts
.add()
.calc()
.clamp()
.fluidType()
.scale()
.convert()
```

### Constraints

```ts
.constrain("width", "< parent")
.constrain("height", "= width * 0.5")
```

### State Methods

```ts
.hover()
.when()
.responsive()
.dark()
.light()
.focusRing()
```

### Animation Methods

```ts
.fadeIn()
.slideInUp()
.zoomIn()
.animate()
.duration()
.delay()
```

---

# Compiler Pipeline

```txt
Chain API
   ↓
Parser
   ↓
Style IR
   ↓
Validation
   ↓
Accessibility Engine
   ↓
Optimization Passes
   ↓
Atomic Extraction
   ↓
CSS Generation
   ↓
Output Files
```

---

# Architecture Overview

| Layer | Purpose |
|---|---|
| Chain API | Fluent style authoring |
| Intent Engine | Semantic layout resolution |
| Semantic Tokens | Theme-aware styling |
| Compiler IR | Intermediate style representation |
| Accessibility Engine | WCAG validation |
| Responsive Inference | Mobile-aware optimization |
| Source Optimizer | Deduplication & dead-code removal |
| Runtime Injector | Browser style injection |
| Timeline Engine | Style history tracking |

---

# Feature Summary

| Feature | Count |
|---|---|
| Intents | 22 |
| Semantic Tokens | 30 |
| Layout Patterns | 35+ |
| Macros | 57+ |
| Shorthands | 80+ |
| Animations | 42 |
| Breakpoints | 20 |
| Compiler Passes | 10 |
| WCAG Detectors | 6 |
| Scroll Presets | 7 |
| Framework Integrations | 4 |
| CLI Commands | 7 |
| Test Suites | 39 |
| Passing Tests | 708 |

---

# Final Notes

ChainCSS is designed to combine:

- **Tailwind-level utility speed**
- **CSS-in-JS flexibility**
- **Compiler intelligence**
- **Accessibility enforcement**
- **Semantic design systems**
- **Zero-runtime extraction**

The result is a styling platform that understands intent — not just CSS properties.

---

<p align="center">
  <strong>⛓️ ChainCSS v2.3</strong><br>
  <em>The CSS Intelligence Platform</em><br><br>
  708 tests · 17 modules · Zero runtime · WCAG-aware
</p>