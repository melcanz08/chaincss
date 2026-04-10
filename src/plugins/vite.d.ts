// chaincss/src/plugins/vite.d.ts

import { Plugin } from 'vite';

export interface ChainCSSPluginOptions {
  atomic?: boolean;
  prefix?: boolean;
  outputDir?: string;
  generateTypes?: boolean;
  minify?: boolean;
  verbose?: boolean;
}

export default function chaincssPlugin(options?: ChainCSSPluginOptions): Plugin;