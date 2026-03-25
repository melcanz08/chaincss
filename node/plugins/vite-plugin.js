import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import CleanCSS from 'clean-css';
import { $, run, compile as originalCompile, chain } from '../btt.js';

const require = createRequire(import.meta.url);

// Optional: Try to load prefixer
let prefixer;
try {
  const ChainCSSPrefixer = (await import('../prefixer.js')).default;
  prefixer = new ChainCSSPrefixer({ enabled: true });
} catch (err) {
  console.warn('ChainCSS: Prefixer not available, autoprefixing disabled');
  prefixer = { process: async (css) => ({ css }) };
}

// Cache for processed files
const fileCache = new Map();
const compiledCache = new Map();

// Helper to compile script without temp files
const compileScript = (scriptBlock, filename, get) => {
  const dirname = path.dirname(filename);
  
  chain.cssOutput = '';
  
  const fn = new Function(
    '$',
    'run',
    'compile',
    'chain',
    'get',
    '__filename',
    '__dirname',
    scriptBlock
  );
  
  fn($, run, originalCompile, chain, get, filename, dirname);
  
  return chain.cssOutput || '';
};

const processJavascriptBlocks = (content, filename, get) => {
  const blocks = content.split(/<@([\s\S]*?)@>/gm);
  let output = '';
  
  for (let i = 0; i < blocks.length; i++) {
    if (i % 2 === 0) {
      output += blocks[i];
    } else {
      const css = compileScript(blocks[i], filename, get);
      if (css && typeof css === 'string') {
        output += css;
      }
    }
  }
  
  return output.trim();
};

const processJCSSFile = (filePath) => {
  const abs = path.resolve(filePath);
  
  if (fileCache.has(abs)) return fileCache.get(abs);
  
  if (!fs.existsSync(abs)) {
    throw new Error(`ChainCSS: File not found: ${abs}`);
  }
  
  const content = fs.readFileSync(abs, 'utf8');
  const dirname = path.dirname(abs);
  
  const get = (relativePath) => {
    const targetPath = path.resolve(dirname, relativePath);
    return processJCSSFile(targetPath);
  };
  
  const result = processJavascriptBlocks(content, abs, get);
  
  fileCache.set(abs, result);
  return result;
};

const processCSS = async (css, filepath, options = {}) => {
  const { minify = true, prefix = true } = options;
  let processed = css;
  
  if (prefix && prefixer) {
    try {
      const result = await prefixer.process(css, { from: filepath });
      processed = result.css;
    } catch (err) {
      console.warn(`ChainCSS prefixer error in ${filepath}:`, err.message);
    }
  }
  
  if (minify) {
    const minified = new CleanCSS({ level: 2 }).minify(processed);
    if (minified.errors.length) {
      console.warn(`ChainCSS minification errors in ${filepath}:`, minified.errors);
    }
    return minified.styles;
  }
  
  return processed;
};

// Helper to track used selectors for tree shaking
const trackUsedSelectors = (bundle) => {
  const usedSelectors = new Set();
  if (!bundle) return usedSelectors;
  
  const classRegex = /class(?:Name)?=["']([^"']+)["']/g;
  let match;
  while ((match = classRegex.exec(bundle)) !== null) {
    match[1].split(' ').forEach(cls => {
      if (cls && cls !== '') {
        usedSelectors.add(`.${cls}`);
      }
    });
  }
  return usedSelectors;
};

// Helper to filter unused CSS
function filterUsedCSS(css, usedSelectors) {
  const lines = css.split('\n');
  const filteredLines = [];
  let inRule = false;
  
  for (const line of lines) {
    const selectorMatch = line.match(/^([^{]+){/);
    if (selectorMatch) {
      const selectors = selectorMatch[1].split(',').map(s => s.trim());
      const isUsed = selectors.some(selector => {
        const baseSelector = selector.split(':')[0];
        return usedSelectors.has(baseSelector);
      });
      
      if (isUsed) {
        filteredLines.push(line);
        inRule = true;
      } else {
        inRule = false;
      }
    } else if (inRule) {
      filteredLines.push(line);
      if (line.includes('}')) {
        inRule = false;
      }
    } else if (!line.includes('}')) {
      filteredLines.push(line);
    }
  }
  
  return filteredLines.join('\n');
}

export default function chaincssVite(opts = {}) {
  const {
    extension = '.jcss',
    minify = process.env.NODE_ENV === 'production',
    prefix = true,
    hmr = true,
    debug = process.env.NODE_ENV === 'development',
    treeShake = process.env.NODE_ENV === 'production'
  } = opts;
  
  let generatedCSS = '';
  let generatedClassMap = {};
  
  return {
    name: 'vite-plugin-chaincss',
    enforce: 'pre',
    
    async transform(code, id) {
      if (!id.endsWith(extension)) return null;
      
      try {
        const dirname = path.dirname(id);
        const get = (relativePath) => {
          const targetPath = path.resolve(dirname, relativePath);
          return processJCSSFile(targetPath);
        };
        
        let css = processJavascriptBlocks(code, id, get);
        
        generatedCSS = css;
        if (chain.classMap) {
          generatedClassMap = chain.classMap;
        }
        
        css = await processCSS(css, id, { minify, prefix });
        
        // Development with Debug Mode
        if (process.env.NODE_ENV !== 'production' && debug) {
          const classMapStr = JSON.stringify(generatedClassMap);
          return {
            code: `
              // ChainCSS with Debug Mode
              const id = ${JSON.stringify(id)};
              const css = ${JSON.stringify(css)};
              const classMap = ${classMapStr};
              
              let style = document.querySelector(\`style[data-chaincss="\${id}"]\`);
              if (!style) {
                style = document.createElement('style');
                style.setAttribute('data-chaincss', id);
                document.head.appendChild(style);
              }
              style.textContent = css;
              
              // Debug Mode: Add inspector attributes
              if (typeof window !== 'undefined' && window.__CHAINCSS_DEBUG__ !== false) {
                // Mark elements with their chaincss classes
                const observer = new MutationObserver(() => {
                  document.querySelectorAll('[class*="chain-"]').forEach(el => {
                    const classes = Array.from(el.classList).filter(c => c.includes('chain-')).join(' ');
                    if (classes && !el.hasAttribute('data-chaincss-class')) {
                      el.setAttribute('data-chaincss-class', classes);
                    }
                  });
                });
                observer.observe(document.body, { childList: true, subtree: true });
                
                console.log('🔍 ChainCSS Debug Mode Active');
                console.log('📊 Class Map:', classMap);
              }
              
              if (import.meta.hot) {
                import.meta.hot.accept((newModule) => {
                  if (newModule?.default) {
                    style.textContent = newModule.default;
                  }
                });
                import.meta.hot.dispose(() => {
                  style.remove();
                });
              }
              
              export default css;
            `,
            map: null
          };
        }
        
        // Development without Debug
        if (process.env.NODE_ENV !== 'production') {
          return {
            code: `
              const id = ${JSON.stringify(id)};
              const css = ${JSON.stringify(css)};
              
              let style = document.querySelector(\`style[data-chaincss="\${id}"]\`);
              if (!style) {
                style = document.createElement('style');
                style.setAttribute('data-chaincss', id);
                document.head.appendChild(style);
              }
              style.textContent = css;
              
              if (import.meta.hot) {
                import.meta.hot.accept((newModule) => {
                  if (newModule?.default) {
                    style.textContent = newModule.default;
                  }
                });
                import.meta.hot.dispose(() => {
                  style.remove();
                });
              }
              
              export default css;
            `,
            map: null
          };
        }
        
        // Production with Tree Shaking tracking
        return {
          code: `export default ${JSON.stringify(css)};`,
          map: null
        };
        
      } catch (err) {
        this.error(`ChainCSS error in ${id}: ${err.message}`);
        return null;
      }
    },
    
    // Add debug styles to HTML
    transformIndexHtml(html) {
      if (debug && process.env.NODE_ENV !== 'production') {
        return {
          html,
          tags: [
            {
              tag: 'script',
              injectTo: 'head',
              children: `
                window.__CHAINCSS_DEBUG__ = true;
                console.log('🔍 ChainCSS Debug Mode: Hover over elements to see their atomic classes');
              `
            },
            {
              tag: 'style',
              injectTo: 'head',
              children: `
                [data-chaincss-class]:hover::after {
                  content: attr(data-chaincss-class);
                  position: absolute;
                  background: #667eea;
                  color: white;
                  padding: 2px 8px;
                  font-size: 11px;
                  border-radius: 4px;
                  font-family: monospace;
                  z-index: 9999;
                  pointer-events: none;
                  white-space: nowrap;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
              `
            }
          ]
        };
      }
      return html;
    },
    
    // Tree Shaking: Remove unused CSS
    generateBundle(options, bundle) {
      if (!treeShake) return;
      
      const jsBundle = Object.values(bundle).find(
        file => file.type === 'chunk' && file.isEntry
      );
      
      if (!jsBundle) return;
      
      const usedSelectors = trackUsedSelectors(jsBundle.code);
      
      const totalSelectors = Object.keys(generatedClassMap).length;
      const usedCount = usedSelectors.size;
      const deadCount = totalSelectors - usedCount;
      const savings = totalSelectors > 0 ? (deadCount / totalSelectors * 100).toFixed(1) : 0;
      
      if (deadCount > 0) {
        console.log(`\n ChainCSS Tree Shaking Results:`);
        console.log(`Total styles: ${totalSelectors}`);
        console.log(`Used styles: ${usedCount}`);
        console.log(`Dead code eliminated: ${deadCount} (${savings}% savings)`);
      }
      
      const cssFile = Object.values(bundle).find(
        file => file.type === 'asset' && file.fileName.endsWith('.css')
      );
      
      if (cssFile && typeof cssFile.source === 'string') {
        const originalCSS = cssFile.source;
        const filteredCSS = filterUsedCSS(originalCSS, usedSelectors);
        
        if (filteredCSS.length < originalCSS.length) {
          cssFile.source = filteredCSS;
          const cssSavings = ((originalCSS.length - filteredCSS.length) / originalCSS.length * 100).toFixed(1);
          console.log(`   🎨 CSS size reduced by ${cssSavings}%`);
        }
      }
    },
    
    handleHotUpdate({ file, server }) {
      if (file.endsWith(extension)) {
        fileCache.delete(file);
        server.ws.send({
          type: 'full-reload',
          path: '*'
        });
      }
    }
  };
}