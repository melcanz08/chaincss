import { defineConfig } from 'chaincss/plugin/vite';

export default defineConfig({
  atomic: { enabled: true, mode: 'hybrid' },
  output: { minify: false },
  sourceComments: true,
});
