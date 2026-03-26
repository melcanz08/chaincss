#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const Module = require('module');
const chokidar = require('chokidar');
const CleanCSS = require('clean-css');
const { $, run, compile: originalCompile, chain } = require('./btt');
const ChainCSSPrefixer = require('./prefixer.js');
const strVal = require('./strVal.js');
const { AtomicOptimizer } = require('./atomic-optimizer');
const { CacheManager } = require('./cache-manager');

const fileCache = new Map();
const compiledCache = new Map();
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
    sourceMapInline: false,
    atomic: false
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
    } else if (arg === '--atomic') {
      result.atomic = true;
    } else if (!result.inputFile) {
      result.inputFile = arg;
    } else if (!result.outputFile) {
      result.outputFile = arg;
    }else if (arg === '--validate-themes') {
      result.validateThemes = true;
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
  if (cliOptions.atomic) {
    config.atomic.enabled = true;
  }
  /*if (cliOptions.validateThemes) {
    const configPath = path.join(process.cwd(), 'chaincss.config.cjs');
    if (fs.existsSync(configPath)) {
        await import('./theme-validator.js').then(module => {
        module.validateThemeFiles(configPath);
      });
    }
  }*/
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
    const result = atomicOptimizer.optimize(obj);
    css = result.css;
    chain.cssOutput = css;
    chain.classMap = result.map;
    chain.atomicStats = result.stats;
  }
  return css;
};

const transpilerModule = {
  $,
  run,
  compile: originalCompile,
  chain
};

// Native module-based JCSS file processor (replaces vm2)
const processJCSSFile = (filePath) => {
  const abs = path.resolve(filePath);
  
  if (fileCache.has(abs)) return fileCache.get(abs);
  
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }
  
  const content = fs.readFileSync(abs, 'utf8');
  const dirname = path.dirname(abs);
  
  const m = new Module(abs, module.parent);
  m.filename = abs;
  m.paths = Module._nodeModulePaths(dirname);
  
  const get = (relativePath) => processJCSSFile(path.resolve(dirname, relativePath));
  
  let compiledFn = compiledCache.get(abs);
  if (!compiledFn) {
    compiledFn = new Function(
      'exports',
      'require',
      'module',
      '__filename',
      '__dirname',
      '$',
      'run',
      'compile',
      'chain',
      'get',
      content
    );
    compiledCache.set(abs, compiledFn);
  }
  
  try {
    compiledFn(
      m.exports,
      require,
      m,
      abs,
      dirname,
      $,
      run,
      originalCompile,
      chain,
      get
    );
  } catch (err) {
    console.error(`Error processing ${abs}:`, err.message);
    throw err;
  }
  
  fileCache.set(abs, m.exports);
  return m.exports;
};

const processScript = (scriptBlock, filename) => {
  const dirname = path.dirname(filename);
  const get = (relativePath) => processJCSSFile(path.resolve(dirname, relativePath));
  
  chain.cssOutput = '';
  
  let compiledFn = compiledCache.get(`script:${filename}`);
  if (!compiledFn) {
    compiledFn = new Function(
      '$',
      'run',
      'compile',
      'chain',
      'get',
      '__filename',
      '__dirname',
      scriptBlock
    );
    compiledCache.set(`script:${filename}`, compiledFn);
  }
  
  try {
    compiledFn($, run, originalCompile, chain, get, filename, dirname);
  } catch (err) {
    console.error(`Error processing script in ${filename}:`, err.message);
    throw err;
  }
  
  return chain.cssOutput || '';
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
    const outputDir = path.resolve(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const content = fs.readFileSync(input, 'utf8');
    const processedCSS = processJavascriptBlocks(content, input);
    if (!validateCSS(processedCSS)) {
      throw new Error('Invalid CSS syntax');
    }
    const stylePath = path.join(outputDir, 'global.css');
    const result = await processAndMinifyCss(processedCSS, input, stylePath);
    if (result.css) {
      fs.writeFileSync(stylePath, result.css, 'utf8');
      if (result.map) {
        const mapFile = `${stylePath}.map`;
        fs.writeFileSync(mapFile, result.map, 'utf8');
      }
      
      // ========== ATOMIC CLASS MAP GENERATION ==========
      if (atomicOptimizer && config.atomic.enabled && chain.classMap && Object.keys(chain.classMap).length > 0) {
        // Write map.json (selector → atomic class string)
        const mapJsonPath = path.join(outputDir, 'global.map.json');
        const mapData = {
          version: '1.0.0',
          generated: new Date().toISOString(),
          input: inputFile,
          output: stylePath,
          atomicEnabled: true,
          threshold: config.atomic.threshold,
          classMap: chain.classMap,
          stats: chain.atomicStats
        };
        fs.writeFileSync(mapJsonPath, JSON.stringify(mapData, null, 2), 'utf8');
        console.log(` Class map: ${mapJsonPath}`);
        
        // Write JS module for easy import
        const jsPath = path.join(outputDir, 'global.classes.js');
        const jsContent = `/**
 * ChainCSS Atomic Class Map
 * Generated: ${new Date().toISOString()}
 * Threshold: ${config.atomic.threshold}
 */

export const classMap = ${JSON.stringify(chain.classMap, null, 2)};

export const getClass = (selector) => classMap[selector] || '';

export default classMap;
`;
        fs.writeFileSync(jsPath, jsContent, 'utf8');
        console.log(` JS module: ${jsPath}`);
        
        // Write TypeScript definitions
        const dtsPath = path.join(outputDir, 'global.classes.d.ts');
        const dtsContent = `/**
 * ChainCSS Atomic Class Map Type Definitions
 * Generated: ${new Date().toISOString()}
 */

export const classMap: Record<string, string>;
export const getClass: (selector: string) => string;
declare const _default: Record<string, string>;
export default _default;
`;
        fs.writeFileSync(dtsPath, dtsContent, 'utf8');
        console.log(` TypeScript definitions: ${dtsPath}`);
        
        // Update manifest
        const manifestPath = path.join(outputDir, 'chaincss-manifest.json');
        let manifest = {};
        if (fs.existsSync(manifestPath)) {
          try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          } catch (e) {}
        }
        
        manifest[path.basename(stylePath)] = {
          css: path.basename(stylePath),
          map: path.basename(mapJsonPath),
          js: path.basename(jsPath),
          dts: path.basename(dtsPath),
          generated: new Date().toISOString(),
          input: inputFile,
          threshold: config.atomic.threshold,
          stats: chain.atomicStats
        };
        
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        console.log(` Manifest: ${manifestPath}`);
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