const strVal = {
	userConf: `// ChainCSS Configuration
module.exports = {
  atomic: {
    enabled: false,
    threshold: 3,
    naming: 'hash',
    cache: true,
    cachePath: './.chaincss-cache',
    minify: true
  },
  prefixer: {
    mode: 'full',
    browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
    enabled: true,
    sourceMap: false,
    sourceMapInline: false
  }
};
`,
	cli_opt_guide: `
ChainCSS - JavaScript-powered CSS preprocessor

Usage: 
  chaincss <inputFile> <outputFile> [options]

Options:
  --watch               Watch for changes
  --no-prefix          Disable automatic prefixing
  --prefixer-mode <mode> Set prefixer mode (auto|lightweight|full)
  --browsers <list>    Browser support list (comma-separated)
  --no-source-map      Disable source maps
  --source-map-inline  Use inline source maps

Examples:
  chaincss style.jcss style.css
  chaincss style.jcss style.css --watch
  chaincss style.jcss style.css --browsers ">5%,last 2 versions"
  chaincss style.jcss style.css --no-prefix
    `
}

module.exports = strVal;