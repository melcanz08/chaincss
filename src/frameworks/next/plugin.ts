// @ts-nocheck
// src/frameworks/next/plugin.ts — Next.js plugin with RSC support
import fs from "fs";
import path from "path";

export interface ChainCSSNextOptions {
  output?: string;
  manifest?: boolean;
  debug?: boolean;
  serverComponents?: boolean;
}

const PLUGIN_NAME = "ChainCSSNextPlugin";

class ChainCSSNextWebpackPlugin {
  options: Required<ChainCSSNextOptions>;

  constructor(options: ChainCSSNextOptions = {}) {
    this.options = {
      output: "./.next/static/css/chaincss.css",
      manifest: true,
      debug: false,
      serverComponents: true,
      ...options,
    };
  }

  apply(compiler: any) {
    const { output, manifest, debug } = this.options;

    compiler.hooks.afterEmit.tapAsync(
      PLUGIN_NAME,
      (compilation: any, callback: any) => {
        try {
          let collectedCSS = "";

          // Collect CSS from chaincss-related assets
          if (compilation.assets) {
            for (const [name, asset] of Object.entries(
              compilation.assets as any,
            )) {
              if (
                name.includes("chaincss") ||
                name.endsWith(".chain.css") ||
                name.includes(".chain.")
              ) {
                collectedCSS += (asset as any).source() + "\n";
              }
            }
          }

          // Also check for .chain.css files emitted by the Vite/Rollup pipeline
          const outputDir = path.dirname(path.resolve(process.cwd(), output));
          // Also check for .chain.css files emitted by the Vite/Rollup pipeline
          if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir);
            for (const file of files) {
              if (file.includes("chaincss") || file.endsWith(".chain.css")) {
                const filePath = path.join(outputDir, file);
                if (filePath !== outputPath) {
                  collectedCSS += fs.readFileSync(filePath, "utf-8") + "\n";
                }
              }
            }
          }

          // Always write output — empty CSS is valid for RSC-only apps
          const outputPath = path.resolve(process.cwd(), output);
          const dir = path.dirname(outputPath);

          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(
            outputPath,
            collectedCSS || "/* ChainCSS — RSC generated */\n",
          );

          if (debug) {
            console.log(
              `[ChainCSS] Wrote ${collectedCSS.length} bytes to ${output}`,
            );
          }

          // Write manifest
          if (manifest) {
            const manifestPath = path.join(dir, "chaincss-manifest.json");
            const manifestData = {
              generatedAt: new Date().toISOString(),
              cssFile: output,
              size: collectedCSS.length,
              serverComponents: this.options.serverComponents,
            };
            fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
          }
        } catch (e) {
          console.error("[ChainCSS] Plugin error:", e);
        }
        callback();
      },
    );
  }
}

export function withChainCSS(nextOptions: ChainCSSNextOptions = {}) {
  return (nextConfig: any = {}) => {
    const originalWebpack = nextConfig.webpack;

    return {
      ...nextConfig,
      webpack(config: any, options: any) {
        const { isServer } = options;

        // Add ChainCSS plugin for all builds
        config.plugins = config.plugins || [];
        config.plugins.push(new ChainCSSNextWebpackPlugin(nextOptions));

        // Don't bundle Node.js modules on client
        if (!isServer) {
          config.resolve = config.resolve || {};
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