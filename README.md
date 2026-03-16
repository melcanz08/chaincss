# ChainCSS

![npm downloads](https://img.shields.io/npm/dm/@melcanz85/chaincss)
[![npm version](https://img.shields.io/npm/v/@melcanz85/chaincss.svg)](https://www.npmjs.com/package/@melcanz85/chaincss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://melcanz08.github.io/chaincss_react_website/)

**Write CSS with JavaScript. The only CSS-in-JS library that lets you CHOOSE your runtime cost.**

ChainCSS is a revolutionary CSS-in-JS solution that gives you **two powerful modes** in one package:

**Build-time compilation** → Pure CSS, zero JavaScript in browser

**Runtime hooks** → Dynamic, prop-based styles when you need them

## Installation

```bash

    npm install @melcanz85/chaincss
```

### File Structure

```text
    your-project/
    ├── node_module
    ├── src/
    │   ├── main.jcss           # Entry point - imports & compiles
    │   └── *.jcss              # Your style definitions             
    ├── style/                  # Generated CSS will be stored here
    ├── index.html              # Your web page
    └── package.json
```

## Two Powerful Modes - One API

### Mode 1: Build-time (Zero Runtime)

**Perfect for:** Static styles, layouts, design systems — anything that doesn't change.

```javascript
    // src/button.jcss
    const button = $()
      .backgroundColor('#667eea')
      .color('white')
      .padding('0.5rem 1rem')
      .borderRadius('4px')
      .block('.btn');

    module.exports =  button;
````
**in your main.jcss**

```javascript
  <@
    const button = get('./button.jcss');

    compile(button);
  @>
```
..then run this in terminal/command prompt

```bash
  npx chaincss ./src/main.jcss ./style --watch 
  # ./style/global.css generated!
````
OR with vanilla nodejs project

```bash
  npx chaincss ./src/main.jcss ./style --watch & node server.js
  # ./style/global.css generated!
````
* Note: running `npx chaincss ./src/main.jcss ./style --watch ` for the first time will
        generate ./chaincss.config.js with default values. You can edit this to 
        customize your build!.


### Mode 2: Runtime (React Hooks)

**Perfect for:** Dynamic styles that respond to props, state, or themes.

```jsx
    // components/DynamicButton.jsx
    import { useChainStyles } from '@melcanz85/chaincss';

    function DynamicButton({ variant = 'primary', children }) {
      const styles = useChainStyles({
        button: () => $()
          .backgroundColor(variant === 'primary' ? '#667eea' : '#48bb78')
          .color('white')
          .padding('0.5rem 1rem')
          .borderRadius('4px')
          .hover()
            .transform('translateY(-2px)')
            .boxShadow('0 4px 6px rgba(0,0,0,0.1)')
          .block()
      });
      
      return <button className={styles.button}>{children}</button>;
    }
    //  Styles injected at runtime
    //  Automatic cleanup on unmount
    //  Fully dynamic based on props


```

## Use BOTH in the Same Project!

```jsx
    // Best of both worlds:
    // - Layout styles → Build-time (zero cost)
    // - Interactive styles → Runtime (dynamic)

    // chaincss/layout.jcss (build-time)
    const grid = $().display('grid').gap('1rem').block('.grid');

    // components/Card.jsx (runtime)
    function Card({ isHighlighted }) {
      const styles = useChainStyles({
        card: () => $()
          .backgroundColor(isHighlighted ? '#fffacd' : 'white')
          .padding('1rem')
          .block()
      });
    }
```

## Features at a Glance

    Feature             Status      Description

    Zero Runtime        ✅          Pure CSS output, no JS in browser

    React Hooks         ✅          Dynamic runtime styles when needed

    Atomic CSS          ✅          90% smaller CSS files

    TypeScript          ✅          First-class type support

    Design Tokens       ✅          Centralized design system

    Auto-prefixing      ✅          Built-in + full Autoprefixer

    Source Maps         ✅          Debug your .jcss files

    Watch Mode          ✅          Instant recompilation


## The ChainCSS API

### The Chain Builder

```javascript
    // jQuery-like fluent API
    const style = $()
      .propertyName('value')      
      .anotherProperty('value')
      .block('.selector');         // End the chain with selector(s)

    // Pseudo-classes & nested styles
    const button = $()
      .color('white')
      .backgroundColor('#667eea')
      .hover()
        .backgroundColor('#5a67d8')
        .transform('scale(1.05)')
      .focus()
        .boxShadow('0 0 0 3px rgba(102,126,234,0.5)')
      .block('.btn');
````

### Basic Example

**chaincss/button.jcss**

```javascript
    const button = $()
      .backgroundColor('#667eea')
      .color('white')
      .padding('0.75rem 1.5rem')
      .borderRadius('0.375rem')
      .fontWeight('600')
      .block('.btn');

    module.exports = button;
```
**chaincss/main.jcss**

```javascript
    <@
      const button  = get('./button.jcss');
      compile({ button });
    @>
````

## Advanced Features

### Design Tokens

```javascript

    // tokens.js
    const { createTokens } = require('@melcanz85/chaincss');

    module.exports = createTokens({
      colors: {
        primary: '#667eea',
        secondary: '#764ba2'
      },
      spacing: {
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem'
      }
    });

    // In your styles
    const button = $()
      .color('$colors.primary')     // ← Token syntax!
      .padding('$spacing.md')
      .block('.btn');
```

## Atomic CSS Optimization

```javascript
    // chaincss.config.js
    module.exports = {
      atomic: {
        enabled: true,      // Enable 90% CSS size reduction
        threshold: 3,        // Styles used 3+ times become atomic
        naming: 'hash'       // Smallest class names
      }
    };
```
**Before (standard CSS):** 4,823 chars
**After (atomic CSS):** 499 chars → **90% smaller!**


## Quick Start Guides

### With Node.js (Vanilla)

```bash
# 1. Install
npm install @melcanz85/chaincss

# 2. Create your first .jcss file
mkdir chaincss
echo "const hello = $().color('red').block('.hello');
compile({ hello });" > chaincss/main.jcss

# 3. Build
  npx chaincss ./src/main.jcss ./style --watch & node server.js
# ./style/global.css generated!
```

### With React + Vite

```bash
    # 1. Create React app
    npm create vite@latest my-app -- --template react
    cd my-app

    # 2. Install ChainCSS
    npm install @melcanz85/chaincss

    # 3. Create component with styles
    mkdir -p src/components/Button
```

**src/components/Button/Button.jsx**

```jsx

    import { useChainStyles } from '@melcanz85/chaincss';

    export function Button({ variant = 'primary', children }) {
      const styles = useChainStyles({
        button: () => $()
          .backgroundColor(variant === 'primary' ? '#667eea' : '#48bb78')
          .color('white')
          .padding('0.5rem 1rem')
          .borderRadius('0.375rem')
          .hover()
            .transform('translateY(-2px)')
            .boxShadow('0 4px 6px rgba(0,0,0,0.1)')
          .block()
      });
      
      return <button className={styles.button}>{children}</button>;
    }
```

See ChainCSS in action! Visit our interactive demo site - [https://melcanz08.github.io/chaincss_react_website/]](https://melcanz08.github.io/chaincss_react_website/)

## Performance Comparison

    Approach                Runtime Cost    Bundle Size         Dynamic Styles      Learning Curve

    ChainCSS (Build)        Zero            Just CSS            Build-time          Low

    ChainCSS (Runtime)      Minimal         Small runtime       Full                Low

    Styled Components       5-10KB runtime  CSS + runtime       Full                Medium

    Emotion                 8-12KB runtime  CSS + runtime       Full                Medium

    Tailwind                Zero            Just CSS            Limited             High

    CSS Modules             Zero            Just CSS            None                Low

**ChainCSS is the ONLY library that gives you DUAL options**

## API Reference

### Core Functions

    Function                        Description

    $()                           Create a new chain builder

    .block(selector)              End chain and assign selector(s)

    compile(styles)               Compile style objects to CSS

    run(...styles)                Process inline styles

    get(filename)                 Import .jcss files

    processor(input, output)      Build-time processor


### React Hooks

    Hook                                        Description

    useChainStyles(styles, options)           Basic styles hook

    useDynamicChainStyles(factory, deps)      Styles that depend on props/state

    useThemeChainStyles(styles, theme)        Theme-aware styles

    ChainCSSGlobal                            Global styles component

    cx(...classes)                            Conditional class merging


## Editor Support

### VS Code

```json
    {
      "files.associations": {
        "*.jcss": "javascript"
      }
    }
```

### WebStorm

* Settings → Editor → File Types

* Add `*.jcss` as JavaScript

### Vim

```vim
    au BufRead,BufNewFile `*.jcss` setfiletype javascript
```

## Contributing

Contributions are welcome! Whether it's:

* Bug fixes

* Documentation improvements

* New features

* Test cases

Please see CONTRIBUTING.md for guidelines.


## License

MIT © [Rommel Caneos]('https://github.com/melcanz08')


## Star Us on GitHub!

If ChainCSS helps you, please [give it a star!]('https://github.com/melcanz08/chaincss') It helps others discover it.