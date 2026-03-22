// node/plugins/webpack-plugin.js
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

class ChainCSSWebpackPlugin {
  constructor(options = {}) {
    this.options = {
      atomic: process.env.NODE_ENV === 'production',
      input: './src/styles/main.jcss',
      output: './dist',
      ...options
    };
  }

  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync('ChainCSSPlugin', async (params, callback) => {
      try {
        const inputPath = path.resolve(process.cwd(), this.options.input);
        const outputPath = path.resolve(process.cwd(), this.options.output);
        
        if (!fs.existsSync(inputPath)) {
          console.warn('ChainCSS: No main.jcss file found, skipping...');
          callback();
          return;
        }
        
        const cmd = `node ${path.join(__dirname, '../chaincss.js')} ${inputPath} ${outputPath} ${this.options.atomic ? '--atomic' : ''}`;
        execSync(cmd, { stdio: 'inherit' });
        
        console.log('ChainCSS compiled successfully');
        callback();
      } catch (err) {
        console.error('ChainCSS compilation failed:', err.message);
        callback(err);
      }
    });
  }
}

module.exports = ChainCSSWebpackPlugin;