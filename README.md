# ChainCSS

![npm downloads](https://img.shields.io/npm/dm/@melcanz85/chaincss)
[![npm version](https://img.shields.io/npm/v/@melcanz85/chaincss.svg)](https://www.npmjs.com/package/@melcanz85/chaincss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://chaincss.dev)

> Chainable CSS-in-JS with build-time compilation, atomic CSS, and zero-runtime options

##  Features

### Core Styling Features

| Feature | Description |
|---------|-------------|
| **Chainable API** | `$().color('red').padding('10px').block()` |
| **CSS Properties** | All standard CSS properties (camelCase) |
| **Multiple Selectors** | `.block('.btn', '.button', '[type="button"]')` |
| **Hover States** | `.hover().backgroundColor('blue').end()` |
| **Hover Exit** | `.end()` method to exit hover mode |
| **Nested Selectors** | `.select('.parent .child')` |
| **Token Resolution** | `$colors.primary` → actual color value |
| **CSS Property Validation** | Warns on invalid CSS properties |

### At-Rules (CSS Rules)

| At-Rule | Method | Example |
|---------|--------|---------|
| **Media Queries** | `.media()` | `.media('(max-width: 768px)', (css) => {...})` |
| **Keyframes** | `.keyframes()` | `.keyframes('slide', (kf) => {...})` |
| **Font Face** | `.fontFace()` | `.fontFace((css) => {...})` |
| **Supports** | `.supports()` | `.supports('display: grid', (css) => {...})` |
| **Container Queries** | `.container()` | `.container('(min-width: 400px)', (css) => {...})` |
| **CSS Layers** | `.layer()` | `.layer('components', (css) => {...})` |
| **Counter Styles** | `.counterStyle()` | `.counterStyle('circled', (css) => {...})` |
| **Custom Properties** | `.property()` | `.property('--my-color', (css) => {...})` |

### Design System

| Feature | Description |
|---------|-------------|
| **Design Tokens** | `createTokens()` with colors, spacing, typography |
| **Token Getter** | `tokens.get('colors.primary')` |
| **Token Resolution in Styles** | `$colors.primary` syntax |
| **Responsive Values** | `responsive({ base: '16px', sm: '14px', lg: '18px' })` |
| **Theme Switching** | Dynamic token updates at runtime |
| **CSS Variables Output** | `tokens.toCSSVariables()` |

### Component System

| Feature | Description |
|---------|-------------|
| **Framework Agnostic** | React, Next.js, Vite, Webpack |
| **Recipe System** | `recipe()` for variant-based components |
| **Base Styles** | `recipe({ base: $().padding('8px').block() })` |
| **Variants** | `variants: { color: { primary: $().bg('blue').block() } }` |
| **Default Variants** | `defaultVariants: { color: 'primary' }` |
| **Compound Variants** | `compoundVariants: [{ variants: { color: 'primary', size: 'lg' }, style: ... }]` |
| **Variant Combination** | `button({ color: 'primary', size: 'lg' })` |
| **Compile All Variants** | `button.compileAll()` |

### Build-Time Features (CLI)

| Feature | Command/Flag |
|---------|--------------|
| **CSS Compilation** | `chaincss input.jcss output/dir` |
| **Watch Mode** | `--watch` flag |
| **Atomic CSS Optimization** | `--atomic` flag |
| **Source Maps** | `--source-map` flag |
| **Minification** | Via CleanCSS (built-in) |
| **Autoprefixer** | `--prefixer-mode auto` |
| **Class Map Generation** | `.map.json` output |
| **JS Module Export** | `.classes.js` output |
| **TypeScript Definitions** | `.classes.d.ts` output |
| **Build Manifest** | `chaincss-manifest.json` |
| **CSS Property Cache** | Local cache for faster builds |

### React Runtime Features

| Feature | Description |
|---------|-------------|
| **useChainStyles** | Main React hook for styles |
| **useDynamicChainStyles** | For dynamic styles with dependencies |
| **useThemeChainStyles** | For theme-aware styles |
| **ChainCSSGlobal** | Global style injection component |
| **withChainStyles** | HOC for class components |
| **cx** | Class name utility (like clsx) |

### Plugin Ecosystem

| Plugin | Description |
|--------|-------------|
| **Vite Plugin** | `.jcss` support with HMR |
| **Webpack Plugin** | Build-time compilation |
| **Next.js Plugin** | SSR support |
| **Webpack Loader** | ChainCSS loader for webpack |

### Development Tools

| Feature | Description |
|---------|-------------|
| **TypeScript Support** | Full type definitions (`types.d.ts`) |
| **Configuration File** | `chaincss.config.cjs` for customization |
| **Cache Management** | Atomic optimizer cache |
| **Cache Cleanup** | Auto cleanup of old cache files |
| **Atomic Optimizer Stats** | `atomicOptimizer.getStats()` |
| **configureAtomic** | Programmatic atomic config |

### CSS Output Features

| Feature | Description |
|---------|-------------|
| **Pure CSS Output** | `global.css` generation |
| **Atomic CSS Output** | Reusable atomic classes |
| **Source Maps** | `.map` files for debugging |
| **Class Mapping** | Selector → atomic class map |
| **Minified Output** | Via CleanCSS |
| **Vendor Prefixing** | Via Autoprefixer |

### Performance Features

| Feature | Description |
|---------|-------------|
| **Zero Runtime Option** | Build mode = 0KB runtime |
| **Small Runtime** | Runtime mode = ~3.2KB |
| **Tree Shaking** | `sideEffects: false` |
| **Atomic CSS Optimization** | Eliminates duplicate styles |
| **Cache Strategy** | File + compiled function cache |

### Security & Compatibility

| Feature | Description |
|---------|-------------|
| **No eval()** | Uses `new Function()` with parameters |
| **No vm2** | Native Node.js module system |
| **Node.js 14+** | Minimum version requirement |
| **ESM/CJS Support** | Dual module format |
| **Browser Support** | Modern browsers via autoprefixer |

## Documentation

For complete guide, documentation, examples, and API reference, 
just go to the docs section of [https://chaincss.dev](https://www.chaincss.dev)

## License

MIT © [Rommel Caneos](https://github.com/melcanz08)