// chaincss/src/plugins/vite.ts

import type { Plugin } from 'vite';
import { ChainCSSCompiler } from '../core/compiler.js';
import path from 'path';

export interface ChainCSSPluginOptions {
  atomic?: boolean;
  prefix?: boolean;
  outputDir?: string;
  generateTypes?: boolean;
  minify?: boolean;
  verbose?: boolean;
}

export default function chaincssPlugin(options: ChainCSSPluginOptions = {}): Plugin {
  const compiler = new ChainCSSCompiler({
    atomic: { enabled: options.atomic !== false },
    prefixer: { enabled: options.prefix !== false },
    output: { minify: options.minify ?? process.env.NODE_ENV === 'production' },
    verbose: options.verbose || false
  });

  const compiledCache = new Map<string, any>();

  return {
    name: 'chaincss',
    enforce: 'pre',

    async transform(source: string, id: string) {
      if (!id.endsWith('.chain.js') && !id.endsWith('.chain.ts')) {
        return null;
      }

      try {
        const startTime = Date.now();
        const result = await compiler.compileFile(id);

        compiledCache.set(id, result);

        const exportCode = generateExports(result);

        if (options.verbose) {
          console.log(`[chaincss] Compiled ${path.basename(id)} in ${Date.now() - startTime}ms`);
        }

        return {
          code: exportCode,
          map: null,
          moduleSideEffects: false
        };
      } catch (err: unknown) {
        console.error(`[chaincss] Error compiling ${id}:`, err instanceof Error ? err.message : err);
        return null;
      }
    },

    // ✅ Place handleHotUpdate here, after transform
    handleHotUpdate({ file, server }: { file: string; server: any }) {
      if (file.endsWith('.chain.js') || file.endsWith('.chain.ts')) {
        const result = compiledCache.get(file);
        if (result) {
          server.ws.send({
            type: 'custom',
            event: 'chaincss:update',
            data: { file, classes: result.classMap }
          });
        }
      }
    },

    async generateBundle() {
      let allCSS = '';
      const classMaps: Record<string, any> = {};

      for (const [file, result] of compiledCache) {
        if (result.css) {
          allCSS += `/* ${path.basename(file)} */\n${result.css}\n`;
        }
        Object.assign(classMaps, result.classMap);
      }

      if (allCSS) {
        this.emitFile({
          type: 'asset',
          fileName: 'chaincss.css',
          source: allCSS
        });
      }

      if (Object.keys(classMaps).length > 0) {
        this.emitFile({
          type: 'asset',
          fileName: 'chaincss-classes.json',
          source: JSON.stringify(classMaps, null, 2)
        });
      }
    }
  };
}

function generateExports(result: any): string {
  const exports: string[] = [];

  for (const [styleId, compiled] of result.styles) {
    exports.push(`export const ${styleId} = '${compiled.className}';`);
  }

  for (const [recipeId, recipeResult] of result.recipes) {
    const variantMap = JSON.stringify(recipeResult.variantClassMap);
    const defaultVariants = JSON.stringify(recipeResult.defaultVariants);

    exports.push(`
export function ${recipeId}(options = {}) {
  const opts = { ...${defaultVariants}, ...options };
  const variantKey = Object.entries(opts)
    .map(([k, v]) => \`\${k}-\${v}\`)
    .join('_');
  const classMap = ${variantMap};
  return classMap[variantKey]?.className || '';
}
${recipeId}.variants = ${JSON.stringify(recipeResult.variants)};
${recipeId}.defaultVariants = ${defaultVariants};
`);
  }

  return exports.join('\n');
}