import { defineConfig } from 'chaincss';

export default defineConfig({
  inputs: ['src/**/*.chain.{ts,tsx}'],
  output: {
    cssFile: 'dist/styles.css'
  }
});
