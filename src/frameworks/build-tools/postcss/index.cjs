// @ts-nocheck
// src/postcss/index.js — PostCSS plugin for ChainCSS
// Uses real StyleCollector + compileToCSS instead of regex parsing.
// Works with Vite, Webpack, Next.js, Parcel, Turbopack, etc.

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Import real compiler and collector
let compileToCSS = null;
let chainFn = null;

try {
  compileToCSS = require('../core/style-compiler.js').compileToCSS;
} catch {
  try {
    compileToCSS = require('../../dist/core/style-compiler.cjs').compileToCSS;
  } catch {
    console.warn('[ChainCSS PostCSS] style-compiler not found. Styles will not be generated.');
  }
}

try {
  const collector = require('../core/style-collector.js');
  chainFn = collector.chain || collector.default;
} catch {
  try {
    const collector = require('../../dist/core/style-collector.cjs');
    chainFn = collector.chain;
  } catch {
    console.warn('[ChainCSS PostCSS] style-collector not found. Styles will not be generated.');
  }
}

/**
 * Compile a .chain.ts file and return its CSS + class names.
 */
function compileChainFile(filePath) {
  let css = '';

  try {
    // Clear require cache for hot reload support
    delete require.cache[require.resolve(filePath)];

    const mod = require(filePath);

    for (const [name, exportValue] of Object.entries(mod)) {
      if (!exportValue || typeof exportValue !== 'object') continue;

      // Determine class name and selectors
      let className;
      let styleObj = exportValue;

      // Case 1: Object has selectors (from $el('name') or build(['.name']))
      if (exportValue.selectors) {
        className =
          exportValue.className ||
          (Array.isArray(exportValue.selectors)
            ? exportValue.selectors[0]?.replace(/^\./, '')
            : String(exportValue.selectors).replace(/^\./, '')) ||
          name;
      }
      // Case 2: Object has className but no selectors (from buildRuntimeResult)
      else if (exportValue.className) {
        className = exportValue.className;
        styleObj = { ...exportValue, selectors: [`.${className}`] };
      }
      // Case 3: Raw style object with CSS properties but no selectors/className
      // (from $el() without arguments in Node.js — returns raw build() output)
      else {
        // Generate class name from export key
        className = `chain-${name.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        styleObj = { ...exportValue, selectors: [`.${className}`] };
      }

      if (compileToCSS && className) {
        try {
          css += compileToCSS(styleObj, { scopeSelector: `.${className}`, minify: false }) + '\n';
        } catch (e) {
          if (process.env.DEBUG) console.warn(`[ChainCSS PostCSS] Failed to compile ${name}:`, e.message);
        }
      }
    }
  } catch (e) {
    if (process.env.DEBUG) console.warn(`[ChainCSS PostCSS] Failed to load ${filePath}:`, e.message);
  }

  return css;
}

/**
 * Scan files for chain styles and compile them to CSS.
 */
function collectChainStyles(files) {
  let css = '';
  const chainFiles = files.filter(
    (f) => f.endsWith('.chain.ts') || f.endsWith('.chain.js') || f.endsWith('.chain.tsx') || f.endsWith('.chain.jsx')
  );

  for (const file of chainFiles) {
    css += compileChainFile(file);
  }

  return css;
}

/**
 * ChainCSS PostCSS Plugin
 *
 * Usage in postcss.config.js:
 *   module.exports = {
 *     plugins: [
 *       require('chaincss/postcss')({
 *         content: ['./src/**\/*.chain.{ts,js,tsx,jsx}']
 *       })
 *     ]
 *   }
 *
 * In your CSS file:
 *   @chaincss;
 *   @chaincss base;
 *   @chaincss utilities;
 */
module.exports = (opts = {}) => {
  const options = {
    content: opts.content || ['./src/**/*.chain.{ts,js,tsx,jsx}'],
    output: opts.output || null,
    debug: opts.debug || false,
    ...opts,
  };

  return {
    postcssPlugin: 'chaincss',

    Once(root, { result }) {
      let hasDirective = false;
      let generatedCSS = '';

      // Check for @chaincss directive
      root.walkAtRules('chaincss', (atRule) => {
        hasDirective = true;
        const params = atRule.params || 'base';

        if (options.debug) {
          console.log(`[ChainCSS PostCSS] Found @chaincss ${params}`);
        }

        // Scan files and generate CSS (only once)
        if (!generatedCSS) {
          const files = [];
          for (const pattern of options.content) {
            try {
              const matches = glob.sync(pattern, { absolute: true });
              files.push(...matches);
            } catch (e) {
              if (options.debug) console.warn(`[ChainCSS PostCSS] Glob failed for ${pattern}:`, e.message);
            }
          }

          if (options.debug) {
            console.log(`[ChainCSS PostCSS] Scanning ${files.length} files:`, files.map(f => path.basename(f)));
          }

          generatedCSS = collectChainStyles(files);

          if (options.debug) {
            console.log(`[ChainCSS PostCSS] Generated ${generatedCSS.length} bytes of CSS`);
          }
        }

        // Replace @chaincss directive with generated CSS
        if (generatedCSS) {
          if (params.includes('base') || params === '' || params.includes('utilities')) {
            atRule.replaceWith(generatedCSS);
          }
        } else {
          atRule.replaceWith('/* ChainCSS: No styles found */');
        }
      });

      // No directive found — inject at the beginning if we have generated CSS
      if (!hasDirective && generatedCSS) {
        root.prepend(generatedCSS);
      }

      // Write to file if output specified
      if (options.output && generatedCSS) {
        try {
          const outPath = path.resolve(process.cwd(), options.output);
          const dir = path.dirname(outPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(outPath, generatedCSS);
          if (options.debug) {
            console.log(`[ChainCSS PostCSS] Wrote ${generatedCSS.length} bytes to ${options.output}`);
          }
        } catch (e) {
          console.error('[ChainCSS PostCSS] Failed to write output:', e.message);
        }
      }

      // Expose for other plugins
      if (generatedCSS) {
        result.messages.push({
          type: 'chaincss',
          plugin: 'chaincss',
          css: generatedCSS,
        });
      }
    },
  };
};

module.exports.postcss = true;
module.exports.default = module.exports;