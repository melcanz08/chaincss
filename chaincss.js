#!/usr/bin/env node

// INCLUDE SEVERAL NODEJS MODULES
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const CleanCSS = require('clean-css');
const transpilerModule = require('./transpiler.js');
const ChainCSSPrefixer = require('./prefixer.js');

let prefixerConfig = {
  enabled: true,
  browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
  mode: 'auto' // 'auto', 'lightweight', or 'full'
};

const prefixer = new ChainCSSPrefixer(prefixerConfig);

const processScript = (scriptBlock) => {
  const context = vm.createContext({ 
    ...transpilerModule
  });

  const jsCode = scriptBlock.trim();
  const chainScript = new vm.Script(jsCode);
  chainScript.runInContext(context);
  return context.chain.cssOutput;
};

// FUNCTION TO CONVERT JS CODES TO CSS CODE (FIRST STEP)
const processJavascriptBlocks = (content) => {
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
        console.error(`Error processing script block:`, err.stack);
        throw err;
      }
    }
  }
  
  return outputCSS.trim();
};

// NEW: Validate CSS (check for unclosed blocks)
const validateCSS = (css) => {
  const openBraces = (css.match(/{/g) || []).length;
  const closeBraces = (css.match(/}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    console.error(`CSS syntax error: Unclosed blocks (${openBraces} opening vs ${closeBraces} closing braces)`);
    return false;
  }
  return true;
};

// Modified minification function with source map support

const processAndMinifyCss = async (css, inputFile, outputFile) => {
  // First validate the CSS
  if (!validateCSS(css)) {
    throw new Error('Invalid CSS syntax - check for missing braces');
  }
  
  // Step 1: Apply prefixer (if enabled)
  let processedCss = css;
  let sourceMap = null;
  
  if (prefixerConfig.enabled) {
    try {
      const result = await prefixer.process(css, {
        from: inputFile,
        to: outputFile,
        map: prefixerConfig.sourceMap !== false
      });
      
      processedCss = result.css;
      sourceMap = result.map;
      
    } catch (err) {
      console.error('⚠Prefixer error:', err.message);
      processedCss = css;
    }
  }
  
  // Step 2: Minify
  const output = new CleanCSS().minify(processedCss);
  if (output.errors.length > 0) {
    console.error('CSS Minification Errors:', output.errors);
    return { css: null, map: null };
  }
  
  let finalCss = output.styles;
  
  if (sourceMap && !prefixerConfig.sourceMapInline) {
    const mapFileName = path.basename(`${outputFile}.map`);
    finalCss += `\n/*# sourceMappingURL=${mapFileName} */`;
  }
  
  return { css: finalCss, map: sourceMap };
};

// Main processor function - FIXED ORDER

const processor = async (inputFile, outputFile) => {
  try {
    const input = path.resolve(inputFile);
    const output = path.resolve(outputFile);
    const content = fs.readFileSync(input, 'utf8');
    
    // STEP 1: Process JavaScript blocks first
    const processedCSS = processJavascriptBlocks(content);
    
    // STEP 2: Validate the CSS
    if (!validateCSS(processedCSS)) {
      throw new Error('Invalid CSS syntax');
    }
    
    // STEP 3: Apply prefixer and minify with source maps
   
    const result = await processAndMinifyCss(processedCSS, input, output);
    if (result.css) {
      fs.writeFileSync(output, result.css, 'utf8');
      
      //Write source map if generated
      if (result.map) {
        const mapFile = `${output}.map`;
        fs.writeFileSync(mapFile, result.map, 'utf8');
      }
      
      if (prefixerConfig.enabled) {
        console.log(`   Prefixer: ${prefixerConfig.mode} mode (${prefixerConfig.browsers.join(', ')})`);
      }
      //Show source map status
      if (result.map) {
        console.log(`   Source maps: enabled`);
      }
    }
  } catch (err) {
    console.error(`Failed to process ${inputFile}:`, err.message);
    throw err;
  }
};

// Watch function
function watch(inputFile, outputFile) {
  console.log(`Watching for changes in ${inputFile}...`);
  chokidar.watch(inputFile).on('change', async () => {
    console.log(`File changed: ${inputFile}`);
    try {
      await processor(inputFile, outputFile);
    } catch (err) {
      console.error('Error during watch processing:', err);
    }
  });
}

// Parse CLI arguments

function parseArgs(args) {
  const result = {
    inputFile: null,
    outputFile: null,
    watchMode: false,
    noPrefix: false,
    browsers: null,
    prefixerMode: 'auto',
    // NEW: Add these
    sourceMap: true, // Enable source maps by default
    sourceMapInline: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--watch') {
      result.watchMode = true;
    } else if (arg === '--no-prefix') {
      result.noPrefix = true;
    } else if (arg === '--prefixer-mode' && args[i + 1]) {
      result.prefixerMode = args[i + 1];
      i++;
    } else if (arg === '--browsers' && args[i + 1]) {
      result.browsers = args[i + 1].split(',');
      i++;
    // NEW: Add these two
    } else if (arg === '--no-source-map') {
      result.sourceMap = false;
    } else if (arg === '--source-map-inline') {
      result.sourceMapInline = true;
    } else if (!result.inputFile) {
      result.inputFile = arg;
    } else if (!result.outputFile) {
      result.outputFile = arg;
    }
  }
  
  return result;
}

// Main CLI logic
if (require.main === module) {
  const args = process.argv.slice(2);
  const cliOptions = parseArgs(args);
  
  if (!cliOptions.inputFile || !cliOptions.outputFile) {
    console.log(`
ChainCSS - JavaScript-powered CSS preprocessor

Usage: 
  chaincss <inputFile> <outputFile> [options]

Options:
  --watch               Watch for changes
  --no-prefix          Disable automatic prefixing
  --browsers <list>    Browser support list (comma-separated)
                       Example: --browsers ">1%,last 2 versions,not IE 11"

Examples:
  chaincss style.jcss style.css
  chaincss style.jcss style.css --watch
  chaincss style.jcss style.css --browsers ">5%,last 2 safari versions"
  chaincss style.jcss style.css --no-prefix
    `);
    process.exit(1);
  }

  // sourceMap
  if (cliOptions.sourceMap !== undefined) {
    prefixerConfig.sourceMap = cliOptions.sourceMap;
  }
  if (cliOptions.sourceMapInline) {
    prefixerConfig.sourceMapInline = true;
  }

  // Then apply to prefixer:
  if (cliOptions.prefixerMode) {
    prefixerConfig.mode = cliOptions.prefixerMode;
  }

  // Apply CLI options
  if (cliOptions.noPrefix) {
    prefixerConfig.enabled = false;
  }
  
  if (cliOptions.browsers) {
    prefixerConfig.browsers = cliOptions.browsers;
    // Re-initialize prefixer with new config
    Object.assign(prefixer, new ChainCSSPrefixer(prefixerConfig));
  }

  // Run processor
  (async () => {
    try {
      await processor(cliOptions.inputFile, cliOptions.outputFile);
      
      if (cliOptions.watchMode) {
        watch(cliOptions.inputFile, cliOptions.outputFile);
      }
    } catch (err) {
      console.error('Fatal error:', err);
      process.exit(1);
    }
  })();
}

module.exports = { processor, watch };