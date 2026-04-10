# ChainCSS

[![npm version](https://img.shields.io/npm/v/chaincss)](https://www.npmjs.com/package/chaincss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://chaincss.dev)

> **ChainCSS** The JavaScript-native styling engine for the modern web.

> **Note:** The previous package `@melcanz85/chaincss` is no longer supported.  
> **Please install this updated `chaincss` instead:** `npm install chaincss`

## ✨ Features

### Core Styling

| Feature | Description | Example |
|---------|-------------|---------|
| **Chainable API** | Intuitive method chaining | `$.color('red').padding('10px')` |
| **Shorthand Properties** | Write less, do more | `$.bg('blue').c('white').p('20px')` |
| **CSS Properties** | All standard CSS properties | `$.display('flex').gap('1rem')` |
| **Multiple Selectors** | Style multiple elements | `.$el('.btn', '.button')` |
| **Hover States** | Interactive styles | `.hover().bg('darkblue').end()` |
| **Responsive Breakpoints** | Built-in breakpoint methods | `.mobile(css => css.p('1rem'))` |
| **Media Queries** | Custom media queries | `.media('(max-width: 768px)', ...)` |

### 🚀 Advanced Features

| Feature | Description | Example |
|---------|-------------|---------|
| **Animation Presets** | Pre-built animations | `.fadeIn().duration('0.3s')` |
| **Math Helpers** | CSS calc() helpers | `$.width($.calc('100% - 20px'))` |
| **Design Tokens** | Centralized design values | `tokens.get('colors.primary')` |
| **Debug Mode** | Console debugging for styles | `$.debug().bg('red')` |
| **Source Comments** | Track style origins | `/* Generated from: nav.chain.js:15 */` |
| **Style Timeline** | Track style changes | `chaincss build --timeline` |

### 🏗️ Build System

| Feature | Command/Flag |
|---------|--------------|
| **CSS Compilation** | `chaincss build` |
| **Watch Mode** | `chaincss watch` |
| **Config File** | `chaincss.config.js` |
| **Auto-prefixer** | Built-in via `--prefixer` |
| **Minification** | Global.css minified, components unminified |
| **TypeScript Support** | Full type definitions |
| **Source Maps** | For debugging |

### ⚛️ Framework Support

| Framework | Support |
|-----------|---------|
| **React** | ✅ `useChainStyles` hook, `createStyledComponent` |
| **Vue** | ✅ `useAtomicClasses` composable |
| **Solid** | ✅ Coming soon |
| **Svelte** | ✅ Coming soon |
| **Vanilla** | ✅ Runtime mode |

### 🔌 Plugins

| Plugin | Description |
|--------|-------------|
| **Vite** | Automatic `.chain.js` compilation |
| **Webpack** | Build-time integration |
| **Next.js** | SSR support |

### 📁 File Structure

```
src/
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── styles/
│           ├── button.chain.js    # Source styles
│           ├── button.class.js    # Generated class names
│           └── button.css         # Generated CSS
├── global-style/
│   ├── global.chain.js             # Global styles
│   └── global.css                  # Combined CSS
└── chaincss.config.js              # Configuration
```

## 📦 Installation

```bash
npm install chaincss
```

## 🚀 Quick Start

### 1. Initialize configuration

```bash
npx chaincss init
# or for full configuration
npx chaincss init --full
```

### 2. Create your first style

```javascript
// src/components/Button/styles/button.chain.js
import { $ } from 'chaincss';

export const button = $
  .bg('#667eea')
  .c('white')
  .p('12px 24px')
  .rounded('8px')
  .cursor('pointer')
  .hover()
    .bg('#5a67d8')
  .end()
  .$el('.btn');
```

### 3. Build styles

```bash
npx chaincss build
```

### 4. Use in React

```jsx
import { button } from './styles/button.class.js';
import './styles/button.css';

function Button() {
  return <button className={button}>Click me</button>;
}
```

## 📝 Examples

### Responsive Design

```javascript
export const title = $
  .fontSize('3rem')
  .mobile(css => css.fontSize('1.5rem'))
  .tablet(css => css.fontSize('2rem'))
  .desktop(css => css.fontSize('2.5rem'))
  .$el('.title');
```

### Animations

```javascript
export const card = $
  .fadeInUp({ duration: '0.5s' })
  .pulse({ duration: '2s', iteration: 'infinite' })
  .bg('white')
  .rounded('12px')
  .$el('.card');
```

### Math Helpers

```javascript
export const container = $
  .width($.calc('100% - 40px'))
  .padding($.add($.rem(2), $.px(10)))
  .margin($.subtract('100vw', '20px'))
  .$el('.container');
```

### Shorthand Properties

```javascript
export const card = $
  .bg('white')
  .c('gray-800')
  .p('20px')
  .m('10px')
  .rounded('8px')
  .shadow('lg')
  .$el('.card');
```

## ⚙️ Configuration

Create `chaincss.config.js`:

```javascript
export default {
  inputs: ['src/**/*.chain.js'],
  output: 'dist/styles',
  atomic: {
    enabled: false,  // Enable atomic CSS optimization
    naming: 'readable'  // or 'hash' for production
  },
  prefixer: {
    enabled: true  // Auto-prefixer for cross-browser support
  },
  breakpoints: {
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)'
  },
  debug: false,
  verbose: false
};
```

## 🎯 Runtime Mode (Optional)

For dynamic styles without build step:

```jsx
import { useChainStyles } from 'chaincss/runtime';

function DynamicButton() {
  const styles = useChainStyles({
    button: {
      backgroundColor: '#667eea',
      color: 'white',
      padding: '12px 24px'
    }
  });
  
  return <button className={styles.button}>Click me</button>;
}
```

## 📊 CLI Commands

| Command | Description |
|---------|-------------|
| `chaincss init` | Create config file |
| `chaincss init --full` | Create full config with all options |
| `chaincss build` | Build all styles |
| `chaincss build --timeline` | Build with timeline tracking |
| `chaincss watch` | Watch for changes |
| `chaincss clean` | Remove generated files |

## 🔧 Package.json Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"npm:css:watch\" \"vite\"",
    "build": "npm run css:build && vite build",
    "css:build": "chaincss build",
    "css:watch": "chaincss watch",
    "css:clean": "chaincss clean"
  }
}
```

## 📚 Documentation

For complete guide, API reference, and examples:

### [Documentation](https://chaincss.dev/docs)

- [Getting Started](https://chaincss.dev/docs)
- [Chainable API](https://chaincss.dev/docs/chainable-api)
- [Responsive Design](https://chaincss.dev/docs/responsive)
- [Animations](https://chaincss.dev/docs/animations)
- [Configuration](https://chaincss.dev/docs/configuration)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## 📄 License

MIT © [Rommel Caneos](https://github.com/melcanz08)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=melcanz08/chaincss&type=Date)](https://star-history.com/#melcanz08/chaincss&Date)