#!/usr/bin/env node

// INCLUDE SEVERAL NODEJS MODULES
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const CleanCSS = require('clean-css');
const transpilerModule = require('./transpiler.js');

// FUNCTION TO PROCESS CHUNKS OF SCRIPTS FROM THE INPUT FILE USING THE VM MODULE
const processScript = (scriptBlock) => {
  const context = vm.createContext({ 
    ...transpilerModule 
  });
  const jsCode = scriptBlock.trim(); 
  const chainScript = new vm.Script(jsCode);
  chainScript.runInContext(context);
  return context.chain.cssOutput; 
};

// CSS Minification Function
const minifyCss = (css) => {
  const output = new CleanCSS().minify(css);
  if (output.errors.length > 0) {
    console.error('CSS Minification Errors:', output.errors);
    return null;
  }
  return output.styles;
};

// FUNCTION TO CONVERT JS CODES TO CSS CODE
const processor = (inputFile, outputFile) => {
  const allowedExtensions = ['.jcss'];
  const fileExt = path.extname(inputFile).toLowerCase();
  
  if (!allowedExtensions.includes(fileExt)) {
    throw new Error(`Invalid file extension: ${fileExt}. Only .jcss files are allowed.`);
  }
  const input = path.resolve(inputFile);
  const content = fs.readFileSync(input, 'utf8');
  const blocks = content.split(/<@([\s\S]*?)@>/gm);
  let outputCSS = '';

  for (let i = 0; i < blocks.length; i++) {
    if (i % 2 === 0) {
      outputCSS += blocks[i]; // Write the existing CSS as is
    } else {
      const scriptBlock = blocks[i];
      try {
        const outputProcessScript = processScript(scriptBlock);
        if (typeof outputProcessScript !== 'object' && typeof outputProcessScript !== 'undefined') {
          outputCSS += outputProcessScript;
        }
      } catch (err) {
        console.error(`Error processing script block in ${inputFile}:`, err.stack);
        throw err; // Stop the process by re-throwing the error
      }
    }
  }
  const outputDir = path.resolve(outputFile);
  const trimmedCSS = outputCSS.trim();
  const minCSS = minifyCss(trimmedCSS);
  fs.writeFileSync(outputDir, minCSS, 'utf8'); 
};

// Watch function
function watch(inputFile, outputFile) {
  console.log(`Watching for changes in ${inputFile}...`);
  chokidar.watch(inputFile).on('change', () => {
    console.log(`File changed: ${inputFile}`);
    processor(inputFile, outputFile);
  });
}

// Main CLI logic
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputFile = args[0];
  const outputFile = args[1];
  const watchMode = args.includes('--watch');

  if (!inputFile || !outputFile) {
    console.error('Usage: chaincss <inputFile> <outputFile> [--watch]');
    process.exit(1);
  }

  processor(inputFile, outputFile);

  if (watchMode) {
    watch(inputFile, outputFile);
  }
}

module.exports = { processor, watch }; 