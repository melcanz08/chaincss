#!/usr/bin/env node

const {NodeVM} = require('vm2');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const CleanCSS = require('clean-css');
const ChainCSSPrefixer = require('./prefixer.js');
const fileCache = new Map();

let prefixerConfig = {
  enabled: true,
  browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
  mode: 'auto' // 'auto', 'lightweight', or 'full'
};
const prefixer = new ChainCSSPrefixer(prefixerConfig);

// IMPORT THE CORE FROM TRANSPILER - use aliasing
const { $, run, compile: originalCompile, chain } = require('./transpiler');

// Import atomic optimizer
const { AtomicOptimizer } = require('./atomic-optimizer');
const { CacheManager } = require('./cache-manager');

// Atomic optimizer instance
let atomicOptimizer = null;

// Configuration
let config = {
  atomic: {
    enabled: false,  // Default off for backward compatibility
    threshold: 3,
    naming: 'hash',
    cache: true,
    minify: true
  }
};

try {
  // Try .cjs first (for ES Module projects)
  let configPath = path.join(process.cwd(), 'chaincss.config.cjs');
  
  if (fs.existsSync(configPath)) {
    const userConfig = require(configPath);
    config = { ...config, ...userConfig };
  } else {
    // Fall back to .js
    configPath = path.join(process.cwd(), 'chaincss.config.js');
    
    if (fs.existsSync(configPath)) {
      const userConfig = require(configPath);
      config = { ...config, ...userConfig };
    } else {
      console.log('No config file found');
    }
  }
  
} catch (err) {
  console.log('Error loading config:', err.message);
}

// Initialize atomic optimizer if enabled
if (config.atomic.enabled) {
  atomicOptimizer = new AtomicOptimizer(config.atomic);
} else {
  console.log('Atomic optimizer disabled (config.atomic.enabled =', config.atomic.enabled, ')');
}


// Create the wrapped compile function
const compile = (obj) => {
  // First, do standard compilation to get styles
  originalCompile(obj);
  
  // If atomic is enabled, optimize
  if (atomicOptimizer && config.atomic.enabled) {
    const optimized = atomicOptimizer.optimize(obj);
    chain.cssOutput = optimized;
    return optimized;
  }
  return chain.cssOutput;
};

// Create a combined module for VM sandbox
const transpilerModule = {
  $,
  run,
  compile,
  chain
};


// Recursive file processing function
const processJCSSFile = (filePath) => {
  // Check cache first
  if (fileCache.has(filePath)) {
    return fileCache.get(filePath);
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Create a new VM instance for this file
  const vm = new NodeVM({
    console: 'inherit',
    timeout: 5000,
    sandbox: {
      ...transpilerModule,
      get: (relativePath) => {
        const baseDir = path.dirname(filePath);
        const targetPath = path.resolve(baseDir, relativePath);
        return processJCSSFile(targetPath);
      },
      __filename: filePath,
      __dirname: path.dirname(filePath),
      module: { exports: {} },
      exports: {}       
    },
    require: {
      external: true,
      builtin: ['path', 'fs'],
      root: './'
    }
  });
  
  // Wrap the content - DON'T redeclare module!
  const wrappedContent = `
    // Clear any existing exports
    module.exports = {};
    
    // Run the actual file content
    ${content}
    
    // Return the exports
    module.exports;
  `;
  
  try {
    const exports = vm.run(wrappedContent, filePath);
    fileCache.set(filePath, exports);
    return exports;
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
    throw err;
  }
};

const processScript = (scriptBlock,filename) => {

  const vm = new NodeVM({
    console: 'inherit',
    timeout: 5000,
    sandbox: {
        ...transpilerModule,
        get: (relativePath) => {
          const baseDir = path.dirname(filename);
          const targetPath = path.resolve(baseDir, relativePath);
          return processJCSSFile(targetPath);
        },
        __filename: filename,
        __dirname: path.dirname(filename),
        module: { exports: {} },
        require: (path) => require(path)
    },
    require: {
        external: true, // Allow some external modules
        builtin: ['path', 'fs'], // Allow specific Node built-ins
        root: './' // Restrict to project root
    }
  });

  const jsCode = scriptBlock.trim();

  try {
      const result = vm.run(jsCode, filename);
      return transpilerModule.chain.cssOutput;
  } catch (err) {
      console.error(`Error processing script in ${filename}:`, err.message);
      throw err;
  }
};

const processJavascriptBlocks = (content, inputpath) => {
  const blocks = content.split(/<@([\s\S]*?)@>/gm);
  let outputCSS = '';
  for (let i = 0; i < blocks.length; i++) {
    if (i % 2 === 0) {
      outputCSS += blocks[i]; // Write the existing CSS as is
    } else {
      const scriptBlock = blocks[i];
      try {
        const outputProcessScript = processScript(scriptBlock,inputpath);

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

// Validate CSS (check for unclosed blocks)
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
    const processedCSS = processJavascriptBlocks(content, input);
    // STEP 2: Validate the CSS
    if (!validateCSS(processedCSS)) {
      throw new Error('Invalid CSS syntax');
    }

    // STEP 3: Apply prefixer and minify with source maps
    const stylePath = output + '/global.css';
    const result = await processAndMinifyCss(processedCSS, input, stylePath);
    if (result.css) {
      fs.writeFileSync(stylePath, result.css, 'utf8');

      //Write source map if generated
      if (result.map) {
        const mapFile = `${stylePath}.map`;
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
  chokidar.watch(inputFile).on('change', async () => {
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
    sourceMap: true, 
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

module.exports = { 
  processor, 
  watch,
  $,
  run,
  compile,
  chain,
  atomicOptimizer,
  config 
};