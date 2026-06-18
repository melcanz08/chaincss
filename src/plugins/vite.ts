import { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

export interface ChainCSSPluginOptions {
  verbose?: boolean;
}

export default function chaincssPlugin(options: ChainCSSPluginOptions = {}): Plugin {
  let cssContent = '';
  let cssPath = '';

  function log(msg: string) {
    if (options.verbose !== false) console.log(`[ChainCSS] ${msg}`);
  }

  return {
    name: 'chaincss',
    enforce: 'pre',

    configResolved(config) {
      cssPath = path.resolve(config.root, 'public/chaincss.css');
    },

    configureServer(server) {
      server.watcher.add(cssPath);
      server.watcher.on('change', (file: string) => {
        if (file === cssPath) {
          try { cssContent = fs.readFileSync(cssPath, 'utf8'); } catch {}
          server.ws.send({ type: 'full-reload' });
        }
      });
      
      try { cssContent = fs.readFileSync(cssPath, 'utf8'); } catch {}

      server.middlewares.use('/__chaincss.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(cssContent);
      });
    },

    transformIndexHtml() {
      return [{
        tag: 'link',
        attrs: { rel: 'stylesheet', href: '/__chaincss.css' },
        injectTo: 'head',
      }];
    },
  };
}