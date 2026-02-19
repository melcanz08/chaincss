# @melcanz85/chaincss

[![npm version](https://badge.fury.io/js/@melcanz85%2Fchaincss.svg)](https://badge.fury.io/js/@melcanz85%2Fchaincss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A simple JavaScript-to-CSS transpiler that converts JS objects into optimized CSS.

## 🚀 Installation

```bash
npm install @melcanz85/chaincss

📦 Usage (Node.js)
Quick Setup

    Install development dependencies:

bash

npm install --save-dev nodemon concurrently

    Update your package.json scripts:

json

"scripts": {
  "start": "concurrently \"nodemon server.js\" \"nodemon --watch chaincss/*.jcss --watch processor.js --exec 'node processor.js'\""
}

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

 //*** This is where the chaining happens all codes here are in javascript syntax, the methods are the css properties but in javascript form it follows the camelCase standard. Example the css property font-family is fontFamily in chaincss and your css selector is the value of the block() method which is always at the end of the chain.

 //*** The property method are the same as the css property but background is an exception because it's a long word so it is shorten to bg only. Example background-color is bgColor() in chaincss etc.

 
//--Chaining File (chaincss/chain.jcss):

// Variables for consistent styling
const bodyBgColor = '#f0f0f0';
const headerBgColor = '#333';
const bodyFontFamily = 'Arial, sans-serif';
const headerAlignItems = 'center';
const logoHeight = '50px';

// Reset browser defaults
const resetDefaultBrowStyle = chain
  .margin('0')
  .padding('0')
  .block('body', 'h1', 'h2', 'h3', 'p', 'ul');

// Body styles
const bodyStyle = chain
  .fontFamily(bodyFontFamily)
  .lineHeight('1.6')
  .bgColor(bodyBgColor)
  .block('body');

// Header styles
const header = chain
  .display('flex')
  .alignItems(headerAlignItems)
  .justifyContent('space-between')
  .bgColor(headerBgColor)
  .color('#fff')
  .padding('10px 20px')
  .block('header');

// Logo
const logoImgHeight = chain
  .height(logoHeight)
  .block('.logo img');

module.exports = {
  resetDefaultBrowStyle,
  bodyStyle,
  header,
  logoImgHeight
};


//--Main File (chaincss/main.jcss):

<@
  // Import chaining definitions
  const style = get('./chain.jcss');

  // Override specific styles
  style.header.bgColor = 'red';
  
  // Compile to CSS
  compile(style);
@>

@media (max-width: 768px) {
<@
  run(
    chain.flexDirection('column').alignItems('flex-start').block('header'),
    chain.order(1).block('.logo'),
    chain.order(2).block('.search-bar'),
    chain.order(3).block('h1'),
    chain.order(5).block('nav'),
    chain.order(4).display('flex').width('100%').justifyContent('flex-end').block('.burgerWrapper')
  );
@>
}


📝 Notes
    
    You can directly put css syntax code on your main file.

    But chainCSS syntax must be wrapped in <@ @> delimiters.

    The get() function imports chaining definitions from other files

    YOU can modify your style in between get() and compile() in the main file it will overwrite the styles in the chainn file.

🎨 Editor Support

Since .jcss files are just JavaScript files with ChainCSS syntax, you can easily enable proper syntax highlighting in your editor:
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
vim

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

🚧 Keyframe          animations          @keyframes support

🚧 Vendor            prefixing           Auto-add -webkit-, -moz-, etc.

🚧 Source maps       Debug               generated CSS

🚧 Watch             mode                Auto-recompile on file changes

✅ = Working, 🚧 = Coming soon


👨‍💻 Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

📄 License

MIT © Rommel Caneos