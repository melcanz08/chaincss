const strVal = {
  userConf: `// Project Configuration
module.exports = {
  atomic: {
    enabled: true,
    threshold: 3,
    naming: 'hash',
    cache: true,
    cachePath: './.chaincss-cache',
    minify: true
  },
  prefixer: {
    mode: 'auto',
    browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
    enabled: true,
    sourceMap: true,
    sourceMapInline: false
  }
};
`,
  cli_opt_guide: `
ChainCSS - JavaScript-powered CSS preprocessor

Usage: 
  chaincss <inputFile> <outputFile> [options]

Options:
  --watch               Watch for changes and auto-recompile
  --no-prefix          Disable automatic prefixing
  --prefixer-mode <mode> Set prefixer mode (auto|lightweight|full)
  --browsers <list>    Browser support list (comma-separated)
  --no-source-map      Disable source maps
  --source-map-inline  Use inline source maps
  
  # Atomic CSS Optimization
  --atomic              Enable atomic CSS optimization
  --threshold <number>  Minimum usage count for atomic classes (default: 3)
  --atomic-naming <type> Atomic class naming (hash|readable) (default: hash)
  --no-atomic-cache     Disable atomic CSS cache
  
  # Performance & Debug
  --verbose             Enable verbose logging
  --debug               Enable debug mode with detailed output
  --tree-shake          Remove unused CSS classes (dead code elimination)
  
  # Output Control
  --minify              Minify CSS output (default: true in production)
  --no-minify           Disable CSS minification
  --out-dir <dir>       Output directory (default: same as outputFile dir)
  --manifest            Generate build manifest file
  
  # Configuration
  --config <path>       Path to config file (default: chaincss.config.cjs)
  --no-config           Ignore config file, use CLI options only
  
  # Theme Validation
  --validate-themes     Validate theme contracts during build
  
  # Help
  --help, -h            Show this help message
  --version, -v         Show version number

Examples:
  # Basic compilation
  chaincss style.jcss style.css
  
  # Watch mode for development
  chaincss style.jcss style.css --watch
  
  # Atomic CSS optimization
  chaincss style.jcss style.css --atomic
  
  # With custom threshold for atomic classes
  chaincss style.jcss style.css --atomic --threshold 5
  
  # Full production build with all optimizations
  chaincss style.jcss style.css --atomic --minify --tree-shake --source-map
  
  # Custom browser support
  chaincss style.jcss style.css --browsers "> 1%, last 2 versions, not dead"
  
  # Full autoprefixer mode
  chaincss style.jcss style.css --prefixer-mode full
  
  # Validate themes during build
  chaincss style.jcss style.css --validate-themes
  
  # Debug mode with verbose output
  chaincss style.jcss style.css --debug --verbose
  
  # Disable prefixing (for modern browsers only)
  chaincss style.jcss style.css --no-prefix
  
  # With custom config file
  chaincss style.jcss style.css --config ./my-chaincss.config.cjs

Notes:
  - Atomic CSS optimization reduces CSS size by reusing common style patterns
  - Tree shaking removes unused CSS classes from final bundle
  - Theme validation ensures all themes have required tokens
  - Use --watch during development for instant updates
  - Use --atomic --minify --tree-shake for production builds
    `
}

module.exports = strVal;