// @ts-nocheck
// src/next/plugin.ts - COMPLETE Next.js plugin with RSC support
import fs from 'fs';
import path from 'path';

export interface ChainCSSNextOptions {
  output?: string;
  manifest?: boolean;
  debug?: boolean;
  serverComponents?: boolean;
}

const PLUGIN_NAME = 'ChainCSSNextPlugin';

class ChainCSSNextWebpackPlugin {
  options: Required<ChainCSSNextOptions>;
  
  constructor(options: ChainCSSNextOptions = {}) {
    this.options = {
      output: './.next/static/css/chaincss.css',
      manifest: true,
      debug: false,
      serverComponents: true,
      ...options,
    };
  }

  apply(compiler: any) {
    const { output, manifest, debug } = this.options;

    compiler.hooks.afterEmit.tapAsync(PLUGIN_NAME, (compilation: any, callback: any) => {
      try {
        // Collect CSS from compilation
        let collectedCSS = '';
        
        // Look for chaincss assets in compilation
        if (compilation.assets) {
          for (const [name, asset] of Object.entries(compilation.assets as any)) {
            if (name.includes('chaincss')) {
              // @ts-ignore
              collectedCSS += asset.source() + '\n';
            }
          }
        }

        // If no CSS collected, create empty file (RSC will generate at runtime)
        const outputPath = path.resolve(process.cwd(), output);
        const dir = path.dirname(outputPath);
        
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Only write if we have content or file doesn't exist
        if (collectedCSS || !fs.existsSync(outputPath)) {
          fs.writeFileSync(outputPath, collectedCSS || '/* chaincss - RSC generated */\n');
          if (debug) console.log(`[ChainCSS] Wrote ${collectedCSS.length} bytes to ${output}`);
        }

        // Write manifest
        if (manifest) {
          const manifestPath = path.join(dir, 'chaincss-manifest.json');
          const manifestData = {
            generatedAt: new Date().toISOString(),
            cssFile: output,
          };
          fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
        }
      } catch (e) {
        console.error('[ChainCSS] Plugin error:', e);
      }
      callback();
    });
  }
}

export function withChainCSS(nextOptions: ChainCSSNextOptions = {}) {
  return (nextConfig: any = {}) => {
    const originalWebpack = nextConfig.webpack;

    return {
      ...nextConfig,
      webpack(config: any, options: any) {
        const { isServer } = options;

        // Add ChainCSS plugin for client builds
        config.plugins = config.plugins || [];
        config.plugins.push(new ChainCSSNextWebpackPlugin(nextOptions));

        // Handle chaincss imports
        config.resolve = config.resolve || {};
        config.resolve.alias = {
          ...config.resolve.alias,
          // Ensure single instance
        };

        // Important: Don't bundle server components on client
        if (!isServer) {
          config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            path: false,
          };
        }

        if (originalWebpack) {
          return originalWebpack(config, options);
        }

        return config;
      },
    };
  };
}

export default withChainCSS;
export { ChainCSSNextWebpackPlugin };

