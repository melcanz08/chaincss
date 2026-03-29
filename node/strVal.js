const strVal = {
  userConf: `// ChainCSS Configuration
// Generated: ${new Date().toISOString()}

module.exports = {
  atomic: {
    enabled: true,          // Enable atomic CSS optimization
    threshold: 3,            // Minimum usage count for atomic conversion
    naming: 'hash',          // 'hash' (c_3b82f6) or 'readable' (bg-blue-500)
    cache: true,             // Cache atomic classes between builds
    cachePath: './.chaincss-cache',
    minify: true,            // Minify CSS output
    mode: 'hybrid',          // 'atomic' | 'standard' | 'hybrid'
    alwaysAtomic: [],        // Force these properties to be atomic
    neverAtomic: [           // Never make these properties atomic
      'content', 'animation', 'transition', 'keyframes',
      'counterIncrement', 'counterReset'
    ],
    outputStrategy: 'component-first',
    frameworkOutput: {
      react: false,          // Generate React hooks
      vue: false,            // Generate Vue composables
      vanilla: true          // Generate vanilla JS class map
    },
    preserveSelectors: false, // Keep original selector names in comments
    verbose: true            // Show detailed atomic optimization stats
  },
  prefixer: {
    enabled: true,
    mode: 'auto',            // 'auto' | 'always' | 'never'
    browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
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
  --atomic-mode <mode>  Atomic mode: atomic, standard, hybrid (default: hybrid)
  --atomic-naming <scheme> Naming scheme: hash, readable (default: hash)
  --atomic-verbose      Show detailed atomic optimization stats
  --preserve-selectors  Keep original selector names in comments
  --no-atomic-cache     Disable atomic CSS cache
  
  # Output Control
  --no-minify           Disable CSS minification
  
  # Help
  --help, -h            Show this help message
  --version, -v         Show version number

Examples:
  # Basic compilation
  chaincss style.jcss dist/
  
  # Watch mode for development
  chaincss style.jcss dist/ --watch
  
  # Atomic CSS optimization
  chaincss style.jcss dist/ --atomic
  
  # With custom naming scheme
  chaincss style.jcss dist/ --atomic --atomic-naming readable
  
  # Verbose output for debugging
  chaincss style.jcss dist/ --atomic --atomic-verbose
  
  # Custom browser support
  chaincss style.jcss dist/ --browsers "> 1%, last 2 versions, not dead"

Notes:
  - Atomic CSS optimization reduces CSS size by reusing common style patterns
  - Use --watch during development for instant updates
  - Use --atomic for production builds to optimize CSS bundle size
    `
}

module.exports = strVal;