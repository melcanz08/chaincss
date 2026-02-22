# @melcanz85/chaincss

[![npm version](https://badge.fury.io/js/@melcanz85%2Fchaincss.svg)](https://badge.fury.io/js/@melcanz85%2Fchaincss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A simple JavaScript-to-CSS transpiler that converts JS objects into optimized CSS.

## 🚀 Installation

```bash
    npm install @melcanz85/chaincss
```
📦 Usage (Node.js)

Quick Setup

### Install development dependencies:

```bash
    npm install --save-dev nodemon concurrently
```

### Update your package.json scripts:

json

"scripts": {
  "start": "concurrently \"nodemon server.js\" \"nodemon --watch chaincss/*.jcss --watch processor.js --exec 'node processor.js'\""
}


## 🔧 CSS Prefixing

ChainCSS offers two prefixing modes:

### 1. Lightweight Mode (Default, ~50KB)
Built-in prefixer that handles the most common CSS properties:
- Flexbox & Grid
- Transforms & Animations
- Filters & Effects
- Text effects
- Box properties

No additional installation needed!

### 2. Full Mode (Uses Autoprefixer)
For complete prefixing coverage of all CSS properties:

```bash
npm install autoprefixer postcss browserslist caniuse-db
```
Project Structure

Create this folder structure in your project:

    your-project/
    ├── chaincss/                 # ChainCSS source files
    │   ├── main.jcss             # Main entry file
    │   ├── chain.jcss            # Chaining definitions
    │   └── processor.js          # Processing script
    ├── public/                   # Output files
    │   ├── index.html
    │   └── style.css             # Generated CSS
    ├── node_modules/
    ├── package.json
    └── package-lock.json


The Initialization processor Setup

In chaincss/processor.js:

    const chain = require("@melcanz85/chaincss");

    try {
      // Process main file and output CSS
      chain.processor('./chaincss/main.jcss', './public/style.css');
    } catch (err) {
      console.error('Error processing chainCSS file:', err.stack);
      process.exit(1);
    }

💻 Code Examples

    //--Chaining File (chaincss/chain.jcss):

### This is where the chaining happens all codes must be in javascript syntax. 
    The chain methods are the same as the css properties but in camelCase mode 
    and the exception of the background property which is shorten to 'bg' only for
    example background-color is bgColor() in chaincss. The value of the block() 
    method is the css selector which is always at the end of the chain or block.

    // Variables for consistent styling
    const bodyBg = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    const headerBg = 'rgba(255, 255, 255, 0.95)';
    const bodyFontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, 
                            Ubuntu, sans-serif";
    const headerBoxShadow = '0 2px 20px rgba(0,0,0,0.1)';
    const logoFontSize = '1.8rem';

    const reset = chain
      .margin('0')
        .padding('0')
        .boxSizing('border-box')
        .block('*');

    const body = chain
        .fontFamily(bodyFontFamily)
        .lineHeight('1.6')
        .color('#1e293b')
        .bg(bodyBg)
        .block('body');

        /* Header/Navigation */
    const navbar = chain
        .bg(headerBg)
        .backdropFilter('blur(10px)')
        .padding('1rem 5%')
        .position('fixed')
        .width('100%')
        .top('0')
        .zIndex('1000')
        .boxShadow(headerBoxShadow)
        .block('.navbar');

    const nav_container = chain
        .maxWidth('1200px')
        .margin('0 auto')
        .display('flex')
        .justifyContent('space-between')
        .alignItems('center')
        .block('.nav-container');

    const logo = chain
        .fontSize(logoFontSize)
        .fontWeight('700')
        .bg('linear-gradient(135deg, #667eea, #764ba2)')
        .backgroundClip('text')
        .textFillColor('transparent')
        .letterSpacing('-0.5px')
        .block('.logo');

    module.exports = {
      reset,
      navbar,
      nav_container,
      logo
    };


//--Main File (chaincss/main.jcss):

    <@
      // Import chaining definitions
      const style = get('./chain.jcss');

      // Override specific styles
      style.logo.fontSize = '2rem';
      
      // Compile to CSS
      compile(style);
    @>

    @keyframes fadeInUp {
    <@
      run(
        chain.opacity('0').transform('translateY(20px)').block('from'),
        chain.opacity('1').transform('translateY(0)').block('to'),
      );
    @>
    }

    /* Responsive */
    @media (max-width: 768px) {
    <@
      run(
        chain.fontSize('2.5rem').block('.hero h1'),
        chain.flexDirection('column').gap('1rem').block('.stats'),
        chain.flexDirection('column').alignItems('center').block('.cta-buttons'),
        chain.gridTemplateColumns('1fr').block('.example-container'),
        chain.display('none').block('.nav-links')
      );
    @>
    }

📝 Notes
    
    You can directly put css syntax code on your main file.

    But chainCSS syntax must be wrapped in <@ @> delimiters.

    The get() function imports chaining definitions from your chain.jcss file

    You can modify your style in between get() and compile() in the 
    main file it will overwrite the styles in the chain file.

🎨 Editor Support

Since .jcss files are just JavaScript files with ChainCSS syntax, you can 
easily enable proper syntax highlighting in your editor:

VS Code

Add this to your project's .vscode/settings.json:

{
    "files.associations": {
        "*.jcss": "javascript"
    }
}

WebStorm / IntelliJ IDEA

    Go to Settings/Preferences → Editor → File Types

    Select JavaScript in the list

    Click + and add *.jcss to the registered patterns

Vim / Neovim

Add to your .vimrc or init.vim:

    au BufRead,BufNewFile *.jcss setfiletype javascript

Sublime Text

    Create or edit ~/Library/Application Support/Sublime Text/Packages/User/JCSS.sublime-settings:

json

{
    "extensions": ["jcss"],
    "syntax": "Packages/JavaScript/JavaScript.sublime-syntax"
}

Atom

Add to your config.cson:
coffeescript

    "*":
      core:
        customFileTypes:
          "source.js": [
            "jcss"
          ]


Other Editors

Most modern editors allow you to associate file extensions with language modes. Simply configure your editor to treat .jcss files as JavaScript.


✨ Features

Status               Feature             Description

✅ Basic             JS → CSS            Convert plain JS objects to CSS

✅ Vendor            prefixing           Auto-add -webkit-, -moz-, etc.

✅ Keyframe          animations          @keyframes support
                     
✅ Source maps       Debug               generated CSS

✅ Watch             mode                Auto-recompile on file changes

👨‍💻 Contributing

    Contributions are welcome! Feel free to open issues or submit pull requests.

📄 License

MIT © Rommel Caneos