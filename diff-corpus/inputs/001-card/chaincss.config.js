import { defineConfig } from 'chaincss';

export default defineConfig({
  namespace: 'chain-',
  inputs: ['src/**/*.chain.{ts,tsx}'],
  output: {
    cssFile: 'dist/styles.css'
  },
  atomic: {
    enabled: true
  },
  tokens: {
    relationships: [
      {
        type: 'derived',
        source: 'colors.primary.500',
        target: 'colors.primary.100',
        method: 'mix-white 80%'
      },
      {
        type: 'contrast',
        foreground: 'colors.text.onPrimary',
        background: 'colors.primary.500',
        target: 4.5,
        autoFix: 'auto'
      }
    ]
  }
});
