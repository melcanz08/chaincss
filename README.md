# @melcanz85/chaincss

![npm downloads](https://img.shields.io/npm/dm/@melcanz85/chaincss)
[![npm version](https://img.shields.io/npm/v/@melcanz85/chaincss.svg)](https://www.npmjs.com/package/@melcanz85/chaincss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Compile-time CSS-in-JS** - Runs during build, not in the browser!

A simple JavaScript-to-CSS transpiler that converts JS objects into optimized CSS **without runtime overhead**.

## Installation

```bash
    npm install @melcanz85/chaincss
```

**Usage (Node.js)**

Quick Setup

### Install development dependencies:

```bash
    npm install --save-dev nodemon concurrently
```

### Update your package.json scripts:

    "scripts": {
      "start": "concurrently \"nodemon server.js\" \"nodemon --watch chaincss/*.jcss --watch processor.cjs --exec 'node processor.cjs'\""
    }


## CSS Prefixing

ChainCSS offers two prefixing approaches:

### 1. Built-in Prefixer (Auto Mode, Default)

Our lightweight built-in prefixer handles the most common CSS properties:
- Flexbox & Grid
- Transforms & Animations
- Filters & Effects
- Text effects
- Box properties

**No additional installation needed!** Just run:
```bash
    npx chaincss input.jcss output.css --watch
```
### 2. Full Autoprefixer Mode (Complete Coverage)

For complete prefixing coverage of all CSS properties:

```bash
    npm install autoprefixer postcss browserslist caniuse-db
    
    # then run this command 
    npx chaincss input.jcss output.css --watch --prefixer-mode full

```

### 3. Make Full Mode Permanent

Edit your package.json script:

    "scripts": {
        "css:watch": "chaincss src/styles.jcss dist/styles.css --watch --prefixer-mode full",
        "start": "concurrently \"npm run dev\" \"npm run css:watch\""
    }


**Project Structure (vanillajs, vanilla nodejs)**

Create this folder structure in your vanillaJS project:

    your-project/
    ├── chaincss/                 # ChainCSS source files
    │   ├── main.jcss             # Main entry file
    │   ├── chain.jcss            # Chaining definitions
    │   └── processor.js         # Processing script
    ├── public/                   # Output files
    │   ├── index.html
    │   └── style.css             # Generated CSS
    ├── node_modules/
    ├── package.json
    ├── package.lock.json
    └── server.js


**The Initialization processor Setup**

In chaincss/processor.js:

    const chain = require("@melcanz85/chaincss");

    try {
      // Process main file and output CSS
      chain.processor('./chaincss/main.jcss', './public/style.css');
    } catch (err) {
      console.error('Error processing chainCSS file:', err.stack);
      process.exit(1);
    }

## Code Examples

    //--Chaining File (chaincss/chain.jcss):

**This is where the chaining happens all codes must be in javascript syntax. 
    The chain methods are the same as the css properties but in camelCase mode. 
    The value of the block() method is the css selector which is always at the 
    end of the chain or block.**

       /* Header/Navigation */
    const navbar = $().backdropFilter('blur(10px)').padding('1rem 5%')
        .position('fixed').width('100%').top('0').zIndex('1000').boxShadow('0 2px 20px rgba(0,0,0,0.1)')
        .block('.navbar');

    const nav_container = $().maxWidth('1200px').margin('0 auto').display('flex')
        .justifyContent('space-between').alignItems('center').block('.nav-container');

    module.exports = {
      navbar,
      nav_container
    };


**Main File (chaincss/main.jcss):**

    <@
      // Import chaining definitions
      const style = get('./chain.jcss');

      // Override specific styles
      style.navbar.padding = '2rem 5%';
      
      // Compile to CSS
      compile(style);
    @>

    @keyframes fadeInUp {
        <@
            const from = $().opacity('0').transform('translateY(20px)').block('from');
            const to = $().chain.opacity('1').transform('translateY(0)').block('to');
            run(from,to);
        @>
    }

    /* Responsive */
    @media (max-width: 768px) {
        <@
            const hero_h1 = $().fontSize('2.5rem').block('.hero h1');
            const stats = $().flexDirection('column').gap('1rem').block('.stats');
            const cta_buttons = $().flexDirection('column').alignItems('center').block('.cta-buttons');
            const ex_container = $().gridTemplateColumns('1fr').block('.example-container');
            const nav_links = $().display('none').block('.nav-links');
            run(hero_h1,stats,cta_buttons,ex_container,nav_links);
        @>
    }


## ⚛️ Using ChainCSS with React

ChainCSS works great with React and Vite! Here's how to set it up:

### Quick Start with React + Vite

1. **Create a new React project**
```bash
    npm create vite@latest my-app -- --template react
    cd my-app
```

### Project Structure (Component-First Approach)

    my-react-app/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar/
    │   │   │   ├── Navbar.jsx
    │   │   │   └── navbar.jcss             # Chain definitions with fluent API
    │   │   ├── Button/
    │   │   │   ├── Button.jsx
    │   │   │   └── button.jcss             # Chain definitions with fluent API
    │   │   └── ...
    │   ├── style/
    │   │   └── global.css                  # Generated CSS
    │   ├── App.jsx
    │   └── main.jsx
    ├── chaincss/
    │   ├── main.jcss                        # Entry point - imports and compiles
    │   └── processor.js                     # Processing script
    └── package.json

### How It Works

1. **Each component has its own `.jcss` file** with style definitions as JavaScript objects
2. **`main.jcss` imports all component styles** using `get()` function
3. **Styles are merged and compiled** into a single `global.css` file
4. **React components import the generated CSS** and use the class names

### Example: Navbar & Hero Components

**src/components/Nav/navbar.jcss**

    const navbar = $()
    .bg('rgba(255, 255, 255, 0.95)')
    .backdropFilter('blur(10px)')
    .padding('1rem 5%')
    .position('fixed')
    .width('100%')
    .top('0')
    .zIndex('1000')
    .boxShadow('0 2px 20px rgba(0,0,0,0.1)')
    .block('.navbar');

    module.exports = {navbar}

**src/components/Hero/hero.jcss**

    const hero = chain
    .padding('120px 5% 80px')
    .bg('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
    .color('white')
    .textAlign('center')
    .block('.hero');

    module.exports = {hero}

**chaincss/main.jcss**

    // You can mix a default style using run() method or even vanilla css (without delimeters)
    <@
    const reset =  $().margin('0').padding('0').boxSizing('border-box').block('*');
    const body =  $().fontFamily("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                Oxygen, Ubuntu, sans-serif").lineHeight('1.6').color('#1e293b')
                .background('linear-gradient(135deg, #667eea 0%, #764ba2 100%)').block('body');
    run(reset, body);
    @>

    .button {
      background-color: #667eea;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      border: none;
      cursor: pointer;
    }

    <@
    // Import all component styles
    const nav = get('./src/components/nav/nav.jcss');
    const hero = get('./src/components/sect_hero/hero.jcss');
    const feature = get('./src/components/sect_feature/feature.jcss');
    const example = get('./src/components/sect_example/example.jcss');
    const gstart = get('./src/components/sect_gStart/gStart.jcss');
    const footer = get('./src/components/footer/footer.jcss');

    const merged = Object.assign({},nav,hero,feature,example,gstart,footer);

        // Overwrite your chaining file
        nav.logo.textDecoration = 'none';
        //example.css_output.overflowWrap = 'break-word';
        
    compile(merged);
    @>

    // you can add keyframes and media queries in this setup
    @keyframes fadeInUp {
    <@
        const from =  $().opacity('0').transform('translateY(20px)').block('from');
        const to =  $().opacity('1').transform('translateY(0)').block('to');
        run(from,to);
    @>
}

    /* Responsive */
    @media (max-width: 768px) {
    <@
        const hero =  $().fontSize('2.5rem').block('.hero h1');
        const stats =  $().flexDirection('column').gap('1rem').block('.stats');
        const ctaButtons =  $().flexDirection('column').alignItems('center').block('.cta-buttons');
        const exampleContainer =  $().gridTemplateColumns('1fr').block('.example-container');
        const navLinks =  $().display('none').block('.nav-links');
        run(hero,stats,ctaButtons,exampleContainer,navLinks);
    @>
}

**Benefits of This Approach**

    ✅ Component Co-location: Styles live next to their components

    ✅ Single Source of Truth: Each component manages its own styles

    ✅ Easy to Maintain: Add/remove components without touching a central style file

    ✅ Scalable: Perfect for large React applications

    ✅ No Redundancy: Styles are automatically merged and optimized

This structure is much cleaner and follows React best practices! Each component owns its styles, and 
    `main.jcss` simply orchestrates the compilation.

## 🎯 Best Practices with React

    1. Component-Specific Styles

        * Keep styles close to components: Button/button.jcss

        * Use descriptive class names that match your components

    2. Global Styles

        * Use main.jcss for global resets and animations

        * Import generated CSS once in your root component

    3. Dynamic Styles

    // In your .jcss file
    const theme = {
      primary: '#667eea',
      secondary: '#764ba2'
    };

    const button = chain
      .backgroundColor(theme.primary)
      .block('.btn');
      
    const buttonHover = chain
      .backgroundColor(theme.secondary)
      .block('.btn:hover');

## 📝 Notes
    
    You can directly put css syntax code on your main.jcss file.

    But chainCSS syntax must be wrapped in <@ @> delimiters.

    run() and compile() method should be separate block <@ run() @> <@ compile @>

    The get() function imports chaining definitions from your chain.jcss file

    You can modify your style in between get() and compile() in the 
    main file it will overwrite the styles in the chain file.

## 🎨 Editor Support

Since .jcss files are just JavaScript files with ChainCSS syntax, you can 
easily enable proper syntax highlighting in your editor:

**VS Code**

Add this to your project's .vscode/settings.json:

    {
        "files.associations": {
            "*.jcss": "javascript"
        }
    }

**WebStorm / IntelliJ IDEA**

    Go to Settings/Preferences → Editor → File Types

    Select JavaScript in the list

    Click + and add *.jcss to the registered patterns

**Vim / Neovim**

Add to your .vimrc or init.vim:

    au BufRead,BufNewFile *.jcss setfiletype javascript

**Sublime Text**

    Create or edit ~/Library/Application Support/Sublime Text/Packages/User/JCSS.sublime-settings:

json

{
    "extensions": ["jcss"],
    "syntax": "Packages/JavaScript/JavaScript.sublime-syntax"
}

**Atom**

Add to your config.cson:
coffeescript

    "*":
      core:
        customFileTypes:
          "source.js": [
            "jcss"
          ]


Other Editors

Most modern editors allow you to associate file extensions with language modes. 
Simply configure your editor to treat .jcss files as JavaScript.


## Features

Status               Feature             Description

✅ Basic             JS → CSS            Convert plain JS objects to CSS

✅ Vendor            prefixing           Auto-add -webkit-, -moz-, etc.

✅ Keyframe          animations          @keyframes support

✅ Media queries     responsive          @media support
                     
✅ Source maps       Debug               generated CSS

✅ Watch             mode                Auto-recompile on file changes


### Key Differentiators

- ** Compile-time, not runtime** - chaincss processes your styles during build, generating pure CSS files. Zero JavaScript execution in the browser means faster page loads!

- ** Performance by design** - Unlike runtime CSS-in-JS libraries, chaincss adds no bundle weight and causes no layout shifts

- ** Build-time processing** - Your `.jcss` files are transformed before deployment, not in the user's browser


### chaincss vs Other Approaches

|    Feature     |     chaincss      |  Runtime CSS-in-JS  | Tailwind      | Vanilla CSS |
|----------------|-------------------|---------------------|---------------|-------------|
| **When CSS is generated** |  **Build time** |  Runtime (browser) |  Build time |  Already written |
| **Browser work**| None - just serves CSS | Executes JS to generate CSS | None - just serves CSS | None |
| **Dynamic values**|  Via JS at build time |  Via props at runtime | ⚠ Limited  |  Manual |
| **Bundle size** | Just the CSS | CSS + JS runtime | Just the CSS | Just the CSS |

### 👨‍💻 Contributing

    Contributions are welcome! Feel free to open issues or submit pull requests.

### License

MIT © Rommel Caneos
