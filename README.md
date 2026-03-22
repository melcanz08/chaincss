# ChainCSS

![npm downloads](https://img.shields.io/npm/dm/@melcanz85/chaincss)
[![npm version](https://img.shields.io/npm/v/@melcanz85/chaincss.svg)](https://www.npmjs.com/package/@melcanz85/chaincss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://chaincss.dev)

**Write CSS with JavaScript. Lets you CHOOSE your runtime cost. DUAL MODE**

* **Build-time compilation** → Pure CSS, zero JavaScript in browser

* **Runtime hooks** → Dynamic, prop-based styles when you need them

### Requirements

* Node.js 18.x or higher [download.](https://nodejs.org/en/download)

* For React: React 16.8+ (hooks support required)

## Installation & Setup

### For Static/Build-time Usage

```bash

    npm install @melcanz85/chaincss
```

### For React with Runtime Hooks

```bash
  npm install @melcanz85/chaincss
  # React hooks are included in the main package
```

## Quick Start

  **Syntax**

1. Create your first .jcss file

```javascript
// main.jcss
<@
  const text = $().color('blue').textAlign('center').block('p');

  //text.fontSize = '2rem';
  
  run(text);
@>
```

2. Add the stylesheet link to your HTML

```html
  <!-- index.html -->
  <!DOCTYPE html>
  <html>
  <head>
    <title>chaincss</title>
    <link rel="stylesheet" type="text/css" href="style/global.css">
  </head>
  <body>
    <p>Hello World</p>
  </body>
  </html>
```

3. Run the compiler

```bash
  npx chaincss ./src/main.jcss ./style --watch 
```

* *Note: The first run creates ./chaincss.config.js with default values. Edit this file to customize your build.*

```javascript

  module.exports = {
    atomic: {
      enabled: true, // enable this for 
      threshold: 3,
      naming: 'hash',
      cache: true,
      cachePath: './.chaincss-cache',
      minify: true
    },
    prefixer: {
      mode: 'auto',
      browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
      enabled: true,
      sourceMap: true,
      sourceMapInline: false
    }
  };

````

4. Open index.html in your browser — your styles should be applied!

* To modify or add styles just add a property to the newly created style object before the run() function. They become javascript regular objects.

```javascript
// main.jcss
<@
  const text = $().color('blue').textAlign('center').block('p');

  text.fontSize = '2rem';
  text.padding = '10px';
  text.backgroundColor = 'rgb(106, 90, 205)';
  
  run(text);
@>
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
  // src/main.jcss
  <@
    const button = get('./button.jcss');

    compile(button);
  @>
```

### Mode 2: Runtime (React Hooks)

**Perfect for:** Dynamic styles that respond to props, state, or themes.

```jsx
    // src/components/Counter.jsx
  import { useState } from 'react';
  import { useChainStyles, $ } from '@melcanz85/chaincss/react';

  export default function Counter() {
    const [count, setCount] = useState(0);

    const styles = useChainStyles(() => {
      const container = $()
        .display('flex')
        .flexDirection('column')
        .alignItems('center')
        .justifyContent('center')
        .gap('3rem')
        .padding('4rem 2.5rem')
        .backgroundColor('rgba(255, 255, 255, 0.92)')
        .borderRadius('2rem')
        .boxShadow('0 25px 50px -12px rgba(0, 0, 0, 0.25)')
        .backdropFilter('blur(12px)')
        .maxWidth('420px')
        .width('90%')
        .block();

      const numberBase = $()
        .fontSize('6rem')
        .fontWeight('800')
        .letterSpacing('-0.05em')
        .transition('color 0.5s ease, transform 0.3s ease')
        .transform(count === 0 ? 'scale(1)' : 'scale(1.1)')
        .animation(count > 0 ? 'pulse 1.8s infinite ease-in-out' : 'none')
        .block();

    const numberColor = $()
        .color(
          count === 0 ? '#4a5568' : `hsl(${ (count * 40) % 360 }, 80%, 60%)`
        )
        .block();

    return { container, numberBase, numberColor };
    }, [count]);

    return (
      <div className={styles.container}>
        <div className={`${styles.numberBase} ${styles.numberColor}`}>
          {count}
        </div>

        <button className="increment-btn" onClick={() => setCount(prev => prev + 1)}>
          Tap to Count Up
        </button>
      </div>
    );
  }
```

## Use BOTH in the Same Project!

```javascript
    // Best of both worlds:
    // - Layout styles → Build-time (zero cost)
    // - Interactive styles → Runtime (dynamic)

    // chaincss/layout.jcss (build-time)
    const grid = $().display('grid').gap('1rem').block('.grid');
```

```jsx
    // components/Card.jsx (runtime)
    function Card({ isHighlighted }) {
      const styles = useChainStyles(() => {
        const card = $()
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
```

**In your styles**

```javascript
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
        enabled: true, 
        threshold: 3,    
        naming: 'hash'
      }
    };
```
**Before (standard CSS):** 4,823 chars
**After (atomic CSS):** 499 chars → **90% smaller!**


## Performance Comparison

    Approach                Runtime Cost    Bundle Size         Dynamic Styles      Learning Curve

    ChainCSS (Build)        Zero            Just CSS            Build-time          Low

    ChainCSS (Runtime)      Minimal         Small runtime       Full                Low

    Styled Components       5-10KB runtime  CSS + runtime       Full                Medium

    Emotion                 8-12KB runtime  CSS + runtime       Full                Medium

    Tailwind                Zero            Just CSS            Limited             High

    CSS Modules             Zero            Just CSS            None                Low

**ChainCSS a "DUAL MODE" css-in-js library**


## API Reference


### Core Functions

Function                        Description

`$()`                           Create a new chain builder

`.block(selector)`              End chain and assign selector(s)

`compile(styles)`               Compile style objects to CSS

`run(...styles)`                Process inline styles

`get(filename)`                 Import `.jcss` files

`processor(input, output)`      Build-time processor


### React Hooks

Hook                                        Description

`useChainStyles(styles, options)`           Basic styles hook

`useDynamicChainStyles(factory, deps)`      Styles that depend on props/state

`useThemeChainStyles(styles, theme)`        Theme-aware styles

`ChainCSSGlobal`                            Global styles component

`cx(...classes)`                            Conditional class merging


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

### Troubleshooting

**Q: My styles aren't appearing in the browser**

* Ensure your HTML includes `<link rel="stylesheet" href="style/global.css">`

* Run `npx chaincss` at least once to generate the initial CSS file

* Check that your `.jcss` files are in the correct directory

* Verify the path in your `npx chaincss` command matches your file structure

**Q: React hooks aren't working**

* Verify you're using React 16.8 or newer

* Import from `@melcanz85/chaincss` (not a subpath)

**Q: The `get()` function returns undefined**

* Ensure the imported file exports something (`use module.exports = ...`)

* Check that the file path is correct relative to your `main.jcss`

**Q: Changes aren't reflected after saving**

* Make sure the `--watch` flag is active

* If not using watch mode, re-run the build command

* Clear your browser cache or do a hard refresh


## See ChainCSS in Action

Visit our interactive demo site: [https://www.chaincss.dev/](https://www.chaincss.dev)

## Contributing

Contributions are welcome! Whether it's:

* Bug fixes

* Documentation improvements

* New features

* Test cases

Please see CONTRIBUTING.md for guidelines.


## License

MIT © [Rommel Caneos](https://github.com/melcanz08)


## Star Us on GitHub!

If ChainCSS helps you, please [give it a star!](https://github.com/melcanz08/chaincss) It helps others discover it.