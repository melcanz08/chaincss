// node/plugins/vite-plugin.js
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
  
  // Reset CSS output
  chain.cssOutput = '';
  
  // Create a function from the script - no temp files!
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
  
  // Execute with helpers
  fn($, run, originalCompile, chain, get, filename, dirname);
  
  return chain.cssOutput || '';
};

const processJavascriptBlocks = (content, filename, get) => {
  const blocks = content.split(/<@([\s\S]*?)@>/gm);
  let output = '';
  
  for (let i = 0; i < blocks.length; i++) {
    if (i % 2 === 0) {
      // Static content
      output += blocks[i];
    } else {
      // JavaScript block
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
  
  // Return cached result if available
  if (fileCache.has(abs)) return fileCache.get(abs);
  
  // Check if file exists
  if (!fs.existsSync(abs)) {
    throw new Error(`ChainCSS: File not found: ${abs}`);
  }
  
  const content = fs.readFileSync(abs, 'utf8');
  const dirname = path.dirname(abs);
  
  // Create get function for this file
  const get = (relativePath) => {
    const targetPath = path.resolve(dirname, relativePath);
    return processJCSSFile(targetPath);
  };
  
  // Process the file
  const result = processJavascriptBlocks(content, abs, get);
  
  // Cache the result
  fileCache.set(abs, result);
  return result;
};

// Minify and prefix CSS
const processCSS = async (css, filepath, options = {}) => {
  const { minify = true, prefix = true } = options;
  let processed = css;
  
  // Add prefixing
  if (prefix && prefixer) {
    try {
      const result = await prefixer.process(css, { from: filepath });
      processed = result.css;
    } catch (err) {
      console.warn(`ChainCSS prefixer error in ${filepath}:`, err.message);
    }
  }
  
  // Minify
  if (minify) {
    const minified = new CleanCSS({ level: 2 }).minify(processed);
    if (minified.errors.length) {
      console.warn(`ChainCSS minification errors in ${filepath}:`, minified.errors);
    }
    return minified.styles;
  }
  
  return processed;
};

export default function chaincssVite(opts = {}) {
  const {
    extension = '.jcss',
    minify = process.env.NODE_ENV === 'production',
    prefix = true,
    hmr = true
  } = opts;
  
  return {
    name: 'vite-plugin-chaincss',
    enforce: 'pre',
    
    // Transform .jcss files
    async transform(code, id) {
      if (!id.endsWith(extension)) return null;
      
      try {
        // Create get function for root file
        const dirname = path.dirname(id);
        const get = (relativePath) => {
          const targetPath = path.resolve(dirname, relativePath);
          return processJCSSFile(targetPath);
        };
        
        // Process the file
        let css = processJavascriptBlocks(code, id, get);
        
        // Process CSS (prefix + minify)
        css = await processCSS(css, id, { minify, prefix });
        
        // In development, inject CSS for HMR
        if (process.env.NODE_ENV !== 'production') {
          return {
            code: `
              // ChainCSS HMR
              const id = ${JSON.stringify(id)};
              const css = ${JSON.stringify(css)};
              
              // Add style to head
              let style = document.querySelector(\`style[data-chaincss="\${id}"]\`);
              if (!style) {
                style = document.createElement('style');
                style.setAttribute('data-chaincss', id);
                document.head.appendChild(style);
              }
              style.textContent = css;
              
              // HMR handling
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
        
        // Production: just export CSS
        return {
          code: `export default ${JSON.stringify(css)};`,
          map: null
        };
        
      } catch (err) {
        this.error(`ChainCSS error in ${id}: ${err.message}`);
        return null;
      }
    },
    
    // Handle HMR updates
    handleHotUpdate({ file, server }) {
      if (file.endsWith(extension)) {
        // Invalidate cache for changed file
        fileCache.delete(file);
        // Trigger reload
        server.ws.send({
          type: 'full-reload',
          path: '*'
        });
      }
    }
  };
}