// @ts-nocheck
// src/postcss/index.js - PostCSS plugin for ChainCSS
// One plugin = works in Vite, Webpack, Next.js, Parcel, Turbopack, etc.

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Try to load real compiler
let compileToCSS = null;
try {
  compileToCSS = require('../core/style-compiler.js').compileToCSS;
} catch {
  try {
    compileToCSS = require('../../dist/core/style-compiler.cjs').compileToCSS;
  } catch {}
}

// Simple fallback parser for chain() calls in JS/TS files
function extractChainStyles(content) {
  const styles = [];
  // Match chain().bg('red').p(4) patterns
  const chainRegex = /chain\(\)\.([a-zA-Z0-9_.\(\)'"`,\s-]+?)(?:\.\$el\(\)|\.toClassName\(\)|\$el|;|\n)/g;
  let match;
  while ((match = chainRegex.exec(content)) !== null) {
    const chainStr = match[1];
    // Parse bg('red') -> { background: 'red' }
    const style = {};
    const methodRegex = /(\w+)\((?:['"`]([^'"`]+)['"`]|(\d+))?\)/g;
    let m;
    while ((m = methodRegex.exec(chainStr)) !== null) {
      const method = m[1];
      const value = m[2] || m[3];
      const map = {
        bg: 'background', p: 'padding', m: 'margin',
        w: 'width', h: 'height', rounded: 'borderRadius',
        flex: 'display', text: 'color',
      };
      const prop = map[method] || method;
      if (method === 'flex') style[prop] = 'flex';
      else if (value) style[prop] = isNaN(value) ? value : `${value}px`;
    }
    if (Object.keys(style).length > 0) styles.push(style);
  }
  return styles;
}

function fallbackCompile(styles, className) {
  let css = '';
  for (const [k, v] of Object.entries(styles)) {
    if (v == null || typeof v === 'object') continue;
    const kebab = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
    css += `${kebab}:${v};`;
  }
  return `.${className}{${css}}`;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `c-${Math.abs(h).toString(36).slice(0, 6)}`;
}

/**
 * ChainCSS PostCSS Plugin
 * 
 * Usage:
 * postcss.config.js:
 *   module.exports = {
 *     plugins: [
 *       require('chaincss/postcss')({
 *         content: ['./src/**\/*.{js,ts,jsx,tsx}']
 *       })
 *     ]
 *   }
 * 
 * CSS:
 *   @chaincss;  // or @chaincss base;
 *   @chaincss utilities;
 */
module.exports = (opts = {}) => {
  const options = {
    content: opts.content || ['./src/**/*.{js,jsx,ts,tsx,vue,svelte}'],
    output: opts.output || null,
    debug: opts.debug || false,
    ...opts,
  };

  return {
    postcssPlugin: 'chaincss',

    Once(root, { result }) {
      let hasDirective = false;
      let generatedCSS = '';
      const collectedStyles = new Map();

      // Check for @chaincss directive
      root.walkAtRules('chaincss', atRule => {
        hasDirective = true;
        const params = atRule.params || 'base';
        
        if (options.debug) {
          console.log(`[ChainCSS PostCSS] Found @chaincss ${params}`);
        }

        // If no content yet, scan files
        if (collectedStyles.size === 0) {
          const files = [];
          for (const pattern of options.content) {
            try {
              const matches = glob.sync(pattern, { absolute: true });
              files.push(...matches);
            } catch (e) {
              if (options.debug) console.warn(`[ChainCSS] Glob failed for ${pattern}`, e);
            }
          }

          if (options.debug) {
            console.log(`[ChainCSS] Scanning ${files.length} files`);
          }

          for (const file of files) {
            try {
              const content = fs.readFileSync(file, 'utf-8');
              const styles = extractChainStyles(content);
              for (const style of styles) {
                const id = hash(JSON.stringify(style));
                if (!collectedStyles.has(id)) {
                  collectedStyles.set(id, style);
                }
              }
            } catch (e) {
              // ignore unreadable files
            }
          }
        }

        // Generate CSS from collected styles
        for (const [id, style] of collectedStyles) {
          let css;
          if (compileToCSS) {
            try {
              css = compileToCSS(style, { scopeSelector: `.${id}` });
            } catch {
              css = fallbackCompile(style, id);
            }
          } else {
            css = fallbackCompile(style, id);
          }
          generatedCSS += css + '\n';
        }

        // Replace @chaincss with generated CSS
        if (params.includes('base') || params === '' || params.includes('utilities')) {
          atRule.replaceWith(generatedCSS);
        } else {
          atRule.remove();
        }
      });

      // If no directive but content exists, inject at top (auto-inject mode)
      if (!hasDirective && collectedStyles.size === 0 && options.content) {
        // Don't auto-inject unless explicitly requested
        // This keeps it compatible with existing setups
      }

      // Write to file if output specified
      if (options.output && generatedCSS) {
        try {
          const outPath = path.resolve(process.cwd(), options.output);
          const dir = path.dirname(outPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(outPath, generatedCSS);
          if (options.debug) {
            console.log(`[ChainCSS] Wrote ${generatedCSS.length} bytes to ${options.output}`);
          }
        } catch (e) {
          console.error('[ChainCSS PostCSS] Failed to write output:', e);
        }
      }

      // Also expose for other plugins
      result.messages.push({
        type: 'chaincss',
        plugin: 'chaincss',
        css: generatedCSS,
        count: collectedStyles.size,
      });
    },
  };
};

module.exports.postcss = true;

// ESM wrapper
module.exports.default = module.exports;

