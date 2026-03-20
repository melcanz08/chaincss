#!/usr/bin/env node
const {NodeVM} = require('vm2');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const CleanCSS = require('clean-css');
const { $, run, compile: originalCompile, chain } = require('./btt');
const ChainCSSPrefixer = require('./prefixer.js');
const strVal = require('./strVal.js');
const { AtomicOptimizer } = require('./atomic-optimizer');
const { CacheManager } = require('./cache-manager');
const fileCache = new Map();
let atomicOptimizer = null;
let config = {
  atomic: {
    enabled: false,
    threshold: 3,
    naming: 'hash',
    cache: true,
    cachePath: './.chaincss-cache',
    minify: true
  },
  prefixer: {
    enabled: true,
    mode: 'auto',
    browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
    sourceMap: true,
    sourceMapInline: false
  }
}; 
let prefixer = new ChainCSSPrefixer(config.prefixer);
function deft_to_userConf(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      result[key] = deft_to_userConf(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}
const ensureConfigExists = () => {
  const configPath = path.join(process.cwd(), 'chaincss.config.cjs');
  const configExists = fs.existsSync(configPath);
  if (!configExists && !process.env.CHAINCSS_SKIP_CONFIG) {
    const defaultConfig = strVal.userConf;
    fs.writeFileSync(configPath, defaultConfig);
    console.log('-- Successfully created config file: ./chaincss.config.cjs\n');
  }
};
const loadUserConfig = () => {
  const configPath = path.join(process.cwd(), 'chaincss.config.cjs');
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = require(configPath);
      config = deft_to_userConf(config, userConfig);
      if (config.prefixer) {
        if (typeof config.prefixer.browsers === 'string') {
          config.prefixer.browsers = config.prefixer.browsers.split(',').map(b => b.trim());
        }
        if (!Array.isArray(config.prefixer.browsers)) {
          config.prefixer.browsers = ['> 0.5%', 'last 2 versions', 'not dead'];
        }
      }
    } catch (err) {
      console.log('-- Error loading config:', err.message, '\n');
    }
  }
};
const initAtomicOptimizer = () => {
  if (config.atomic.enabled) {
    atomicOptimizer = new AtomicOptimizer(config.atomic);
  } else {
    console.log('-- Atomic optimizer disabled\n');
  }
};
const initPrefixer = () => {
  prefixer = new ChainCSSPrefixer(config.prefixer);
};
function parseArgs(args) {
  const result = {
    inputFile: null,
    outputFile: null,
    watchMode: false,
    noPrefix: false,
    browsers: null,
    prefixerMode: null,
    sourceMap: null,
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
      result.browsers = args[i + 1].split(',').map(b => b.trim());
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
const applyCliOptions = (cliOptions) => {
  if (cliOptions.sourceMap !== null) {
    config.prefixer.sourceMap = cliOptions.sourceMap;
  }
  if (cliOptions.sourceMapInline) {
    config.prefixer.sourceMapInline = true;
  }
  if (cliOptions.prefixerMode) {
    config.prefixer.mode = cliOptions.prefixerMode;
  }
  if (cliOptions.noPrefix) {
    config.prefixer.enabled = false;
  }
  if (cliOptions.browsers) {
    config.prefixer.browsers = cliOptions.browsers;
  }
};
function watch(inputFile, outputFile) {
  chokidar.watch(inputFile).on('change', async () => {
    try {
      await processor(inputFile, outputFile);
    } catch (err) {
      console.error('Error during watch processing:', err);
    }
  });
}
const compile = (obj) => {
  originalCompile(obj);
  let css = chain.cssOutput || '';
  if (atomicOptimizer && config.atomic.enabled) {
    css = atomicOptimizer.optimize(obj);
    chain.cssOutput = css;
  }
  return css;
};
const transpilerModule = {
  $,
  run,
  compile: originalCompile,
  chain
};
const processJCSSFile = (filePath) => {
  if (fileCache.has(filePath)) {
    return fileCache.get(filePath);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
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
  const wrappedContent = `
    module.exports = {};
    ${content}
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
const processScript = (scriptBlock, filename) => {
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
      external: true,
      builtin: ['path', 'fs'],
      root: './'
    }
  });
  const jsCode = scriptBlock.trim();
  try {
    const result = vm.run(jsCode, filename);
    const css = vm.sandbox.chain?.cssOutput || '';
    return css;
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
      outputCSS += blocks[i];
    } else {
      const scriptBlock = blocks[i];
      try {
        const blockCSS = processScript(scriptBlock, inputpath);
        if (typeof blockCSS !== 'object' && typeof blockCSS !== 'undefined') {
          outputCSS += blockCSS;
        }
      } catch (err) {
        console.error(`Error processing script block:`, err.stack);
        throw err;
      }
    }
  }
  return outputCSS.trim();
};
const validateCSS = (css) => {
  const openBraces = (css.match(/{/g) || []).length;
  const closeBraces = (css.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    console.error(`CSS syntax error: Unclosed blocks (${openBraces} opening vs ${closeBraces} closing braces)`);
    return false;
  }
  return true;
};
const processAndMinifyCss = async (css, inputFile, outputFile) => {
  if (!validateCSS(css)) {
    throw new Error('Invalid CSS syntax - check for missing braces');
  }
  let processedCss = css;
  let sourceMapFromPrefixer = null;
  if (config.prefixer.enabled) {
    try {
      const result = await prefixer.process(css, {
        from: inputFile,
        to: outputFile,
        map: config.prefixer.sourceMap !== false
      });
      processedCss = result.css;
      sourceMapFromPrefixer = result.map;
    } catch (err) {
      console.error('Prefixer error:', err.message);
      processedCss = css;
    }
  }
  const minifyOptions = {
    sourceMap: config.prefixer.sourceMap === true,
    sourceMapInlineSources: true
  };
  const output = new CleanCSS(minifyOptions).minify(processedCss);
  if (output.errors.length > 0) {
    console.error('CSS Minification Errors:', output.errors);
    return { css: null, map: null };
  }
  let finalCss = output.styles;
  let finalSourceMap = output.sourceMap ? JSON.stringify(output.sourceMap) : sourceMapFromPrefixer;
  if (finalSourceMap && !config.prefixer.sourceMapInline) {
    const mapFileName = path.basename(`${outputFile}.map`);
    finalCss += `\n/*# sourceMappingURL=${mapFileName} */`;
  }
  return { css: finalCss, map: finalSourceMap };
};
const processor = async (inputFile, outputFile) => {
  try {
    const input = path.resolve(inputFile);
    const output = path.resolve(outputFile);
    const content = fs.readFileSync(input, 'utf8');
    const processedCSS = processJavascriptBlocks(content, input);
    if (!validateCSS(processedCSS)) {
      throw new Error('Invalid CSS syntax');
    }
    const stylePath = path.join(output, 'global.css');
    const result = await processAndMinifyCss(processedCSS, input, stylePath);
    if (result.css) {
      fs.writeFileSync(stylePath, result.css, 'utf8');
      if (result.map) {
        const mapFile = `${stylePath}.map`;
        fs.writeFileSync(mapFile, result.map, 'utf8');
      }
    }
  } catch (err) {
    console.error(`Failed to process ${inputFile}:`, err.message);
    throw err;
  }
};
if (require.main === module) {
  ensureConfigExists();
  loadUserConfig();
  const args = process.argv.slice(2);
  const cliOptions = parseArgs(args);
  if (!cliOptions.inputFile || !cliOptions.outputFile) {
    console.log(strVal.cli_opt_guide);
    process.exit(1);
  }
  applyCliOptions(cliOptions);
  initAtomicOptimizer();
  initPrefixer();
  (async () => {
    try {
      await processor(cliOptions.inputFile, cliOptions.outputFile);
      if (cliOptions.watchMode) {
        console.log('-- Watching for changes...\n');
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