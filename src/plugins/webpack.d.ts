// chaincss/src/plugins/webpack.d.ts

declare module 'chaincss/plugin/webpack' {
  import { LoaderDefinition } from 'webpack';

  export interface ChainCSSLoaderOptions {
    mode?: 'build' | 'runtime';
    atomic?: boolean;
    minify?: boolean;
    sourceMap?: boolean;
    outputDir?: string;
    verbose?: boolean;
  }

  const loader: LoaderDefinition<ChainCSSLoaderOptions>;
  export default loader;
}