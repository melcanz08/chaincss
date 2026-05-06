<p align="center">
  <h1 align="center">ChainCSS</h1>
  <p align="center">
    <strong>The first CSS-in-JS library with true auto-detection mixed mode.</strong><br>
    Zero runtime by default. Dynamic when you need it. No compromises.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/chaincss"><img src="https://img.shields.io/npm/v/chaincss" alt="npm"></a>
  <a href="https://github.com/melcanz08/chaincss/blob/main/LICENSE"><img src="https://img.shields.io/github/license/melcanz08/chaincss" alt="license"></a>
  <a href="https://chaincss.dev"><img src="https://img.shields.io/badge/docs-chaincss.dev-blue" alt="docs"></a>
</p>

---

## What is ChainCSS?

ChainCSS lets you write styles as **native JavaScript method chains** instead of CSS strings or object literals. It auto-detects which parts of your styles are static (compile to zero-runtime CSS) and which are dynamic (stay in JS), then splits them automatically.

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
text


**No CSS syntax. No template literals. No object literals. Just JavaScript.**

---

## The Killer Feature: Auto-Detection Mixed Mode

ChainCSS automatically detects which styles are static and which are dynamic.

import { smartChain } from "chaincss";

const styles = smartChain()
.display("flex") // static -> extracted to CSS file
.padding(20) // static -> extracted to CSS file
.color(props.textColor) // dynamic -> stays in JS
.fontSize(theme.sizes.lg) // dynamic -> stays in JS
.$el("dynamic-card");
text


| Library | Approach | Dynamic Support | Runtime Cost |
|---------|----------|----------------|-------------|
| Tailwind | Utility classes | No | Zero |
| Styled Components | Runtime CSS-in-JS | Yes | Full |
| Panda CSS | Build-time + recipes | Limited | Near-zero |
| Vanilla Extract | Build-time only | No | Zero |
| **ChainCSS** | **Auto-detection + split** | **Yes** | **Minimal** |

---

## Installation

npm install chaincss
text


### Quick Start with Vite

// vite.config.ts
import { defineConfig } from "vite";
import chaincss from "chaincss/plugin/vite";

export default defineConfig({
plugins: [chaincss()],
});
text


---

## Core API

### The Chain

import { chain } from "chaincss";

const styles = chain()
.display("flex")
.padding(20) // numbers auto-convert to px
.color("red")
.$el("my-component");
text


### Shorthands (80+)

chain()
.bg("#fff") // backgroundColor
.m(16) // margin
.p(20) // padding
.br(8) // borderRadius
.fs(16) // fontSize
.fw(700) // fontWeight
.c("#333") // color
.w(200) // width
.h(100) // height
.d("flex") // display
text


### Macros (57 built-in)

**Layout:**

chain().flex() // display: flex
chain().grid() // display: grid
chain().center() // flex + align-items + justify-content center
chain().flexCenter() // flex centering
chain().gridCenter() // grid centering
chain().stack(16) // flex column with gap
chain().cols(3) // grid-template-columns: repeat(3, 1fr)
chain().bento(4) // bento grid layout
text


**Spacing:**

chain().mx(10) // margin-left + margin-right
chain().my(20) // margin-top + margin-bottom
chain().px(16) // padding-left + padding-right
chain().py(24) // padding-top + padding-bottom
chain().size(50) // width + height
chain().gap(16) // gap
text


**Positioning:**

chain().absolute({ top: 0, left: 0 })
chain().fixed({ top: 0, right: 0 })
chain().sticky({ top: 0 })
chain().relative()
text


**Visibility:**

chain().hide() // visibility: hidden + opacity: 0
chain().show() // visibility: visible + opacity: 1
chain().unselectable() // user-select: none
chain().scrollable("y") // overflow-y: auto
text


**Shapes:**

chain().circle(50) // width + height + border-radius: 50%
chain().square(40) // width + height
chain().pill() // border-radius: 9999px
chain().truncate() // text-overflow: ellipsis
chain().aspect("16/9") // aspect-ratio
text


**Aesthetic Effects:**

chain().glass() // backdrop-filter blur + semi-transparent bg
chain().glow("#ff0000") // box-shadow glow
chain().textGradient(["#667eea", "#764ba2"]) // gradient text
chain().meshGradient(["#f0f", "#0ff", "#ff0", "#0f0"]) // mesh gradient
chain().noise(0.05) // noise texture overlay
chain().shimmer() // loading shimmer effect
text


**State & Interactions:**

chain()
.hover()
.background("#2563eb")
.transform("scale(1.05)")
.end()

chain().clickScale(0.95) // scale on click
chain().pressable() // cursor pointer + hover effects
chain().focusRing("#3b82f6") // focus-visible ring
chain().skeleton(true) // loading skeleton animation
chain().dark(c => c.bg("#1a202c").c("white")) // dark mode
chain().light(c => c.bg("white").c("#1a202c")) // light mode
chain().children(c => c.gap(8)) // direct children styles
text


**Utility:**

chain().fullScreen() // fixed fullscreen overlay
chain().containerMacro(1200) // centered container
chain().outlineDebug() // debug outlines
chain().parallax(2) // parallax scrolling
chain().lineClamp(3) // text line clamp
chain().frostedNav(15) // frosted glass navigation
text


### Conditional Styles

chain()
.padding(12)
.when(isActive, c => c
.background("#10b981")
.color("white")
)
.when(isDisabled, c => c
.opacity(0.5)
.cursor("not-allowed")
)
.$el("stateful-btn");
text


### Nested Selectors

chain()
.display("flex")
.nest("& > *", c => c.flex(1))
.nest("&:first-child", c => c.fontWeight(700))
.nest(".child", c => c.color("red"))
.$el("flex-container");
text


### Mixins with use()

const sharedStyles = { display: "flex", alignItems: "center", gap: 8 };
chain().use(sharedStyles).padding(20).$el("reused");
text


### Responsive Design

chain()
.display("flex")
.flexDirection("column")
.responsive("md", c => c.flexDirection("row"))
.media("(min-width: 1024px)", c => c.maxWidth(1200))
.$el("responsive");
text


Built-in breakpoints: sm, md, lg, xl, 2xl, mobile, tablet, desktop, dark, light, reducedMotion, highContrast, print, hover, portrait, landscape.

### Transform Methods

chain().scale(1.1).rotate("45deg").x(10).y(20).$el("transformed");
text


### Math Helpers

chain()
.width(chain().calc("100% - 20px"))
.fontSize(chain().clamp(16, 4, 24))
.margin(chain().add(10, 20))
.$el("calculated");
text


---

## Recipe System (Variants)

import { recipe } from "chaincss";

const button = recipe({
base: {
selectors: ["btn"],
display: "inline-flex",
borderRadius: "8px",
fontWeight: 600,
},
variants: {
size: {
sm: { padding: "8px 16px", fontSize: "14px" },
md: { padding: "12px 24px", fontSize: "16px" },
lg: { padding: "16px 32px", fontSize: "18px" },
},
color: {
primary: { background: "#3b82f6", color: "white" },
danger: { background: "#ef4444", color: "white" },
},
},
defaultVariants: { size: "md", color: "primary" },
compoundVariants: [
{
variants: { size: "lg", color: "primary" },
style: { fontWeight: 800 },
},
],
});

const styles = button({ size: "lg", color: "danger" });
text


---

## Animations (42 built-in presets)

chain()
.fadeIn()
.slideInUp()
.zoomIn()
.bounce()
.pulse()
.spin()
.shake()
.wiggle()
.float()
.flash()
.textReveal()
.$el("animated");

// Custom animation
chain()
.animate("myKeyframes", {
"0%": { opacity: 0, transform: "scale(0.5)" },
"100%": { opacity: 1, transform: "scale(1)" },
}, { duration: "0.5s", timing: "ease-out" })
.$el("custom-anim");
text


---

## Design Tokens

import { createTokens } from "chaincss";

const tokens = createTokens({
colors: { primary: "#3b82f6", secondary: "#10b981", danger: "#ef4444" },
spacing: { sm: "8px", md: "16px", lg: "24px" },
});

chain(true)
.color("colors.primary").padding("colors.primary").padding("spacing.md")
.$el("themed");
text


---

## Theme Contract

import { createThemeContract, createTheme, validateTheme } from "chaincss";

const contract = createThemeContract({
colors: { primary: "", background: "", text: "" },
});

const lightTheme = createTheme(contract, {
colors: { primary: "#3b82f6", background: "#ffffff", text: "#1a202c" },
});

const darkTheme = createTheme(contract, {
colors: { primary: "#60a5fa", background: "#1a202c", text: "#f7fafc" },
});
text


---

## Framework Integration

### React

import { chain } from "chaincss";

function Card() {
const styles = chain().bg("white").p(24).rounded(12).$el("card");
return <div className={styles.selectors[0]}>Content</div>;
}
text


### Vue

import { chain } from "chaincss";
const styles = chain().display("grid").cols(3).gap(16).$el("vue-grid");
// <div :class="styles.selectors[0]">
text


### Svelte

import { chain } from "chaincss";
const styles = chain().flex().center().$el("centered");
// <div class={styles.selectors[0]}>Content</div>
text


---

## Smart Chain (Auto-Detection)

import { smartChain, buildChain, runtimeChain } from "chaincss";

// Auto-detect
const styles = smartChain()
.display("flex") // static -> build
.color(dynamicVariable) // dynamic -> runtime
.$el("hybrid");

// Force build-time only
const static = buildChain().display("flex").$el("static");

// Force runtime only
const dynamic = runtimeChain().color(props.color).$el("runtime");
text


---

## CLI

chaincss init # Create config file
chaincss build # Build all styles
chaincss watch # Watch for changes
chaincss cache clear # Clear cache
chaincss cache stats # Cache statistics
chaincss timeline list # Style history
text


---

## Configuration

// chaincss.config.js
export default {
inputs: ["src//*.chain.{js,ts}", "src//*.tsx"],
output: { cssFile: "global.css", minify: true },
atomic: { enabled: true, mode: "hybrid", threshold: 2, naming: "hash" },
breakpoints: { sm: "(min-width: 640px)", md: "(min-width: 768px)", lg: "(min-width: 1024px)" },
tokens: { enabled: true, prefix: "$" },
};
text


---

## Complete Feature List

| Category | Count |
|----------|-------|
| Macros | 57 |
| Shorthand Properties | 80 |
| Animation Presets | 42 |
| Breakpoints | 20 |
| Chain API Methods | 30+ |
| Math Helpers | 15 |
| CSS Properties | 300+ |
| CLI Commands | 5 |
| Framework Integrations | 4 (React, Vue, Svelte, Solid) |
| Plugins | 2 (Vite, Webpack) |
| React Hooks | 6 |
| Recipe System | Variants, defaultVariants, compoundVariants |
| Theme System | Theme, createThemeContract, validateTheme |

**Total: 550+ features | 210 tests | Zero-runtime by default**

---

## Contributing

git clone https://github.com/melcanz08/chaincss.git
cd chaincss
npm install
npm test
text


---

## License

MIT © Rommel Caneos

<p align="center">
  <strong>ChainCSS</strong> — Write styles like JavaScript. Ship zero runtime.<br>
  <a href="https://chaincss.dev">chaincss.dev</a>
</p>
