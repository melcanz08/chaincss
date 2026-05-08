// chaincss/src/plugins/vite.ts

import { Plugin, HmrContext, ViteDevServer } from 'vite';
import { ChainCSSCompiler } from '../core/compiler.js';
import path from 'path';
import fs from 'fs';

export interface ChainCSSPluginOptions {
  atomic?: boolean;
  minify?: boolean;
  verbose?: boolean;
  hmr?: boolean;
  injectGlobal?: boolean;
  cssOutput?: string;
  manifestOutput?: string;
  include?: string[];
  exclude?: string[];
}

export default function chaincssPlugin(options: ChainCSSPluginOptions = {}): Plugin {
  const compiler = new ChainCSSCompiler({
    atomic: { enabled: options.atomic !== false },
    output: { minify: options.minify || false },
    verbose: options.verbose || false
  });
  
  const virtualCssId = 'virtual:chaincss.css';
  const resolvedCssId = '\0' + virtualCssId;
  
  const virtualManifestId = 'virtual:chaincss-manifest';
  const resolvedManifestId = '\0' + virtualManifestId;

  // Store generated data
  let generatedCSS = '';
  let generatedManifest: Record<string, any> = {};
  let processedFiles = new Set<string>();
  let lastHmrUpdate = 0;
  let hmrTimeout: NodeJS.Timeout | null = null;
  let server: ViteDevServer | null = null;

  // Helper for verbose logging
  function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    if (!options.verbose && level === 'info') return;
    const prefix = '[ChainCSS]';
    switch (level) {
      case 'warn':
        console.warn(`${prefix} ⚠️ ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ❌ ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  // Helper to check if file should be processed
  function shouldProcess(id: string): boolean {
    if (id.startsWith('\0') || id.includes('virtual:')) return false;
    if (id.includes('node_modules')) return false;
    
    // Check exclude patterns
    if (options.exclude) {
      for (const pattern of options.exclude) {
        if (id.includes(pattern)) return false;
      }
    }
    
    // Check include patterns
    if (options.include) {
      for (const pattern of options.include) {
        if (id.includes(pattern)) return true;
      }
      return false;
    }
    
    // Default: process source files
    const isUserFile = id.includes('/src/') || id.includes('/components/');
    const isComponent = /\.(t|j)sx?$/.test(id);
    
    return isUserFile && isComponent;
  }

  // Get CSS from compiler safely
  function updateCSS(): string {
    try {
      const freshCSS = compiler.getCombinedCSS();
      if (freshCSS && freshCSS !== generatedCSS) {
        generatedCSS = freshCSS;
        if (options.verbose) {
          log(`CSS updated: ${generatedCSS.length} bytes`);
        }
      }
      return generatedCSS;
    } catch (error) {
      log(`Failed to get CSS: ${(error as Error).message}`, 'error');
      return generatedCSS;
    }
  }

  // Get manifest from compiler
  function updateManifest(): Record<string, any> {
    try {
      const freshManifest = compiler.getAtomicMap();
      if (JSON.stringify(freshManifest) !== JSON.stringify(generatedManifest)) {
        generatedManifest = freshManifest;
        if (options.verbose) {
          log(`Manifest updated: ${Object.keys(generatedManifest).length} entries`);
        }
      }
      return generatedManifest;
    } catch (error) {
      log(`Failed to get manifest: ${(error as Error).message}`, 'error');
      return generatedManifest;
    }
  }

  // Send HMR update
  function sendHMRUpdate() {
    if (!server || !options.hmr !== false) return;
    
    // Debounce HMR updates
    if (hmrTimeout) clearTimeout(hmrTimeout);
    hmrTimeout = setTimeout(() => {
      const now = Date.now();
      if (now - lastHmrUpdate < 100) return;
      lastHmrUpdate = now;
      
      const css = updateCSS();
      const manifest = updateManifest();
      
      server!.ws.send({
        type: 'custom',
        event: 'chaincss:update',
        data: { 
          css, 
          map: manifest,
          timestamp: now
        }
      });
      
      if (options.verbose) {
        log(`HMR update sent: ${css.length} bytes`);
      }
      
      hmrTimeout = null;
    }, 50);
  }

  // Generate bootstrap code with proper CSS injection
  function generateBootstrapCode(css: string): string {
    const shouldInjectGlobal = options.injectGlobal !== false;
    
    if (!shouldInjectGlobal) {
      return `
        // ChainCSS Runtime Bootstrap (No CSS Injection)
        import manifest from "virtual:chaincss-manifest";
        import { setManifest } from "chaincss/runtime";
        
        try {
          setManifest(manifest);
          console.log("[ChainCSS] ✅ Runtime initialized");
        } catch (err) {
          console.error("[ChainCSS] Failed to initialize:", err);
        }
      `;
    }
    
    // Escape CSS for injection
    const escapedCSS = css
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
    
    return `
      // ChainCSS Runtime Bootstrap
      import manifest from "virtual:chaincss-manifest";
      import { setManifest } from "chaincss/runtime";
      
      // Initialize ChainCSS
      try {
        setManifest(manifest);
        console.log("[ChainCSS] ✅ Runtime initialized");
      } catch (err) {
        console.error("[ChainCSS] Failed to initialize:", err);
      }
      
      // Inject CSS
      (function() {
        const css = \`${escapedCSS}\`;
        const styleId = 'chaincss-injected-styles';
        
        if (css && css.trim()) {
          let styleTag = document.getElementById(styleId);
          if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleId;
            styleTag.setAttribute('data-chaincss', 'true');
            document.head.appendChild(styleTag);
          }
          styleTag.textContent = css;
          console.log("[ChainCSS] ✅ Injected", css.length, "bytes of CSS");
        } else if (document.getElementById(styleId)) {
          // Remove empty style tag
          const existing = document.getElementById(styleId);
          if (existing) existing.remove();
        }
      })();
      
      // HMR Support
      if (import.meta.hot) {
        import.meta.hot.on('chaincss:update', (data) => {
          if (data.map) setManifest({ atomicMap: data.map });
          if (data.css) {
            const styleTag = document.getElementById('chaincss-injected-styles');
            if (styleTag) {
              styleTag.textContent = data.css;
              console.log("[ChainCSS] 🔄 HMR update:", data.css.length, "bytes");
            }
          }
        });
        
        // Accept self for HMR
        import.meta.hot.accept();
      }
    `;
  }

  return {
    name: 'chaincss',
    enforce: 'pre' as const,

    config(config) {
      // Prevent Vite from trying to optimize Node.js built-ins
      if (!config.optimizeDeps) config.optimizeDeps = {};
      if (!config.optimizeDeps.exclude) config.optimizeDeps.exclude = [];
      const exclude = config.optimizeDeps.exclude as string[];
      if (!exclude.includes('url')) exclude.push('url');
      if (!exclude.includes('fs')) exclude.push('fs');
      if (!exclude.includes('path')) exclude.push('path');
    },

    configureServer(_server: ViteDevServer) {
      server = _server;
      log('Vite plugin initialized');
      
      // Watch for config changes
      _server.watcher.on('change', (filePath) => {
        if (filePath.includes('chaincss.config')) {
          log('Config changed, clearing cache...');
          compiler.clearCSS();
          processedFiles.clear();
          updateCSS();
          updateManifest();
          sendHMRUpdate();
        }
      });
    },

    resolveId(id: string) {
      if (id === virtualCssId) return resolvedCssId;
      if (id === virtualManifestId) return resolvedManifestId;
      return null;
    },

    load(id: string) {
      if (id === resolvedManifestId) {
        const manifest = updateManifest();
        const manifestData = {
          atomicMap: manifest,
          version: '2.0.0',
          timestamp: Date.now()
        };
        return `export default ${JSON.stringify(manifestData)};`;
      }
      
      if (id === resolvedCssId) {
        const css = updateCSS();
        // Return JS that injects the CSS into the DOM
        if (css && css.trim()) {
          return `const style = document.createElement('style');
style.setAttribute('data-chaincss', 'build');
style.textContent = ${JSON.stringify(css)};
document.head.appendChild(style);
export default {};`;
        }
        return 'export default {};';
      }
      
      return null;
    },

    async transform(source: string, id: string) {
      if (!shouldProcess(id)) return null;
      
      const fileName = path.basename(id);
      
      try {
        // Skip if already processed (with cache)
        if (processedFiles.has(id) && !source.includes('chain(')) {
          return null;
        }
        
        log(`Processing: ${fileName}`);
        processedFiles.add(id);
        
        // Compile the source
        await compiler.compileSource(source, id);
        
        // Update stored data
        updateCSS();
        updateManifest();
        
        // Send HMR update if needed
        if (server && options.hmr !== false) {
          sendHMRUpdate();
        }
        
        // Check if this is an entry file
        const isEntryFile = /(main|index|App|entry)\.(t|j)sx?$/.test(id);
        
        if (isEntryFile && !source.includes('virtual:chaincss.css')) {
          const bootstrapCode = generateBootstrapCode(generatedCSS);
          log(`Bootstrapping entry file: ${fileName} (${generatedCSS.length} bytes)`);
          
          return {
            code: `${bootstrapCode}\n${source}`,
            map: null
          };
        }
        
        return null;
      } catch (error) {
        log(`Failed to process ${fileName}: ${(error as Error).message}`, 'error');
        return null;
      }
    },
    
    handleHotUpdate({ file, server: hotServer, modules }: HmrContext) {
      if (!shouldProcess(file)) return modules;
      
      log(`HMR update: ${path.basename(file)}`);
      
      // Clear processed flag to force reprocessing
      processedFiles.delete(file);
      
      // Clear compiler cache for this file
      compiler.clearCSS();
      
      // Update data
      const css = updateCSS();
      const manifest = updateManifest();
      
      // Send HMR update
      if (options.hmr !== false) {
        hotServer.ws.send({
          type: 'custom',
          event: 'chaincss:update',
          data: { 
            css, 
            map: manifest,
            file: path.basename(file),
            timestamp: Date.now()
          }
        });
      }
      
      // Return modules to invalidate
      const cssModule = [...modules].find(m => m.id === resolvedCssId);
      if (cssModule) {
        return [...modules, cssModule];
      }
      
      return modules;
    },
    
    buildStart() {
      log('Build started');
      processedFiles.clear();
      generatedCSS = '';
      generatedManifest = {};
      compiler.clearCSS();
    },
    
    buildEnd() {
      const finalCSS = updateCSS();
      log(`Build complete - Final CSS: ${finalCSS.length} bytes`);
      
      // Write CSS to file if output specified
      if (options.cssOutput) {
        try {
          const outputPath = path.resolve(process.cwd(), options.cssOutput);
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          fs.writeFileSync(outputPath, finalCSS, 'utf8');
          log(`CSS written to: ${outputPath}`);
        } catch (error) {
          log(`Failed to write CSS: ${(error as Error).message}`, 'error');
        }
      }
      
      // Write manifest if output specified
      if (options.manifestOutput) {
        try {
          const manifestPath = path.resolve(process.cwd(), options.manifestOutput);
          const manifestDir = path.dirname(manifestPath);
          if (!fs.existsSync(manifestDir)) {
            fs.mkdirSync(manifestDir, { recursive: true });
          }
          fs.writeFileSync(manifestPath, JSON.stringify(generatedManifest, null, 2), 'utf8');
          log(`Manifest written to: ${manifestPath}`);
        } catch (error) {
          log(`Failed to write manifest: ${(error as Error).message}`, 'error');
        }
      }
    },
    
    generateBundle(_options, bundle) {
      // Ensure CSS is included in the bundle
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && generatedCSS) {
          // @ts-ignore
          if (!chunk.source || (chunk.source && chunk.source.length === 0)) {
            // @ts-ignore
            chunk.source = generatedCSS;
            log(`Wrote ${generatedCSS.length} bytes to ${fileName}`);
          }
        }
      }
    },
    
    // Clean up on close
    closeBundle() {
      if (hmrTimeout) {
        clearTimeout(hmrTimeout);
      }
      log('Plugin closed');
    }
  };
}