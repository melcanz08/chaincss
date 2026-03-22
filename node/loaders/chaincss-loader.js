// node/loaders/chaincss-loader.js
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

module.exports = function(source) {
  const callback = this.async();
  const options = this.getOptions() || {};
  
  const mode = options.mode || (process.env.NODE_ENV === 'production' ? 'build' : 'runtime');
  
  if (mode === 'runtime') {
    const code = `
      import { $, compile } from '@melcanz85/chaincss';
      const styles = (() => {
        ${source}
        return { ${extractStyleNames(source)} };
      })();
      export default styles;
    `;
    callback(null, code);
    return;
  }
  
  try {
    const tempFile = path.join(this.context, '.temp.jcss');
    fs.writeFileSync(tempFile, source);
    
    const outputDir = path.join(process.cwd(), '.chaincss-cache');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const cmd = `node ${path.join(__dirname, '../chaincss.js')} ${tempFile} ${outputDir} ${options.atomic ? '--atomic' : ''}`;
    execSync(cmd, { stdio: 'pipe' });
    
    const cssPath = path.join(outputDir, 'global.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    
    fs.unlinkSync(tempFile);
    
    const code = `
      const css = ${JSON.stringify(css)};
      if (typeof document !== 'undefined') {
        const style = document.createElement('style');
        style.setAttribute('data-chaincss', ${JSON.stringify(this.resourcePath)});
        style.textContent = css;
        document.head.appendChild(style);
      }
      export default {};
    `;
    callback(null, code);
  } catch (err) {
    callback(err);
  }
};

function extractStyleNames(source) {
  const matches = source.match(/const\s+(\w+)\s*=\s*\$\(\)/g);
  if (!matches) return '';
  return matches.map(m => m.match(/const\s+(\w+)/)[1]).join(', ');
}