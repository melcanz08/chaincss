let postcss, browserslist, caniuse, autoprefixer;

// Try to load optional dependencies
try {
  postcss = require('postcss');
  browserslist = require('browserslist');
  caniuse = require('caniuse-db/fulldata-json/data-2.0.json');
} catch (err) {
  // Optional deps not installed - will use lightweight mode
}

// Try to load Autoprefixer (optional)
try {
  autoprefixer = require('autoprefixer');
} catch (err) {
  // Autoprefixer not installed - will use built-in
}

class ChainCSSPrefixer {
  constructor(config = {}) {
    this.config = {
      browsers: config.browsers || ['> 0.5%', 'last 2 versions', 'not dead'],
      enabled: config.enabled !== false,
      mode: config.mode || 'auto',
      sourceMap: config.sourceMap !== false, // Enable source maps by default
      sourceMapInline: config.sourceMapInline || false,
      ...config
    };
    
    // Check what's available
    this.hasBuiltInDeps = !!(postcss && browserslist && caniuse);
    this.hasAutoprefixer = !!autoprefixer;
    
    // Determine which mode to use
    this.prefixerMode = this.determineMode();
    
    // Built-in prefixer data
    this.caniuseData = caniuse ? caniuse.data : null;
    this.commonProperties = this.getCommonProperties();
    this.specialValues = {
      'display': ['flex', 'inline-flex', 'grid', 'inline-grid'],
      'background-clip': ['text'],
      'position': ['sticky']
    };
    
    this.browserPrefixMap = {
      'chrome': 'webkit', 'safari': 'webkit', 'firefox': 'moz',
      'ie': 'ms', 'edge': 'webkit', 'ios_saf': 'webkit',
      'and_chr': 'webkit', 'android': 'webkit', 'opera': 'webkit',
      'op_mob': 'webkit', 'samsung': 'webkit', 'and_ff': 'moz'
    };
    
    this.targetBrowsers = null;
  }


  determineMode() {
    // User explicitly wants full mode but Autoprefixer not installed
    if (this.config.mode === 'full' && !this.hasAutoprefixer) {
      console.warn('⚠️ Full mode requested but autoprefixer not installed. Falling back to lightweight mode.');
      console.warn('   To use full mode: npm install autoprefixer postcss');
      return 'lightweight';
    }
    
    // User explicitly wants lightweight mode
    if (this.config.mode === 'lightweight') {
      return 'lightweight';
    }
    
    // User wants full mode and it's available
    if (this.config.mode === 'full' && this.hasAutoprefixer) {
      return 'full';
    }
    
    // Auto mode: use full if available, otherwise lightweight
    if (this.config.mode === 'auto') {
      return this.hasAutoprefixer ? 'full' : 'lightweight';
    }
    
    return 'lightweight';
  }

  async process(cssString, options = {}) {
    if (!this.config.enabled) {
      return { css: cssString, map: null };
    }

    try {
      // Set up source map options
      const mapOptions = {
        inline: this.config.sourceMapInline,
        annotation: false, // We'll add the comment ourselves
        sourcesContent: true
      };

      if (this.prefixerMode === 'full') {
        return await this.processWithAutoprefixer(cssString, options, mapOptions);
      }
      
      return await this.processWithBuiltIn(cssString, options, mapOptions);
      
    } catch (err) {
      console.error('⚠️ Prefixer error:', err.message);
      return { css: cssString, map: null };
    }
  }

  // 🚀 Full mode with Autoprefixer
   async processWithAutoprefixer(cssString, options, mapOptions) {
    const from = options.from || 'input.css';
    const to = options.to || 'output.css';
    
    const result = await postcss([
      autoprefixer({ overrideBrowserslist: this.config.browsers })
    ]).process(cssString, { 
      from,
      to,
      map: this.config.sourceMap ? mapOptions : false
    });
    
    return {
      css: result.css,
      map: result.map ? result.map.toString() : null
    };
  }

  // 🔧 Lightweight mode with built-in prefixer
  async processWithBuiltIn(cssString, options, mapOptions) {
    if (!this.hasBuiltInDeps) {
      return { css: cssString, map: null };
    }

    this.targetBrowsers = browserslist(this.config.browsers);
    
    const from = options.from || 'input.css';
    const to = options.to || 'output.css';
    
    const result = await postcss([
      this.createBuiltInPlugin()
    ]).process(cssString, { 
      from,
      to,
      map: this.config.sourceMap ? mapOptions : false
    });
    
    return {
      css: result.css,
      map: result.map ? result.map.toString() : null
    };
  }

  createBuiltInPlugin() {
    return (root) => {
      root.walkDecls(decl => {
        this.processBuiltInDeclaration(decl);
      });
    };
  }

  processBuiltInDeclaration(decl) {
    const { prop, value } = decl;
    
    if (this.commonProperties.includes(prop)) {
      this.addPrefixesFromCaniuse(decl);
    }
    
    if (this.specialValues[prop]?.includes(value)) {
      this.addSpecialValuePrefixes(decl);
    }
  }

  addPrefixesFromCaniuse(decl) {
    if (!this.caniuseData) return;
    
    const feature = this.findFeature(decl.prop);
    if (!feature) return;
    
    const prefixes = new Set();
    
    this.targetBrowsers.forEach(browser => {
      const [id, versionStr] = browser.split(' ');
      const version = parseFloat(versionStr.split('-')[0]);
      const stats = feature.stats[id];
      
      if (stats) {
        const versions = Object.keys(stats)
          .map(v => parseFloat(v.split('-')[0]))
          .filter(v => !isNaN(v))
          .sort((a, b) => a - b);
        
        const closestVersion = versions.find(v => v <= version) || versions[0];
        
        if (closestVersion) {
          const support = stats[closestVersion.toString()];
          if (support && support.includes('x')) {
            const prefix = this.browserPrefixMap[id.split('-')[0]];
            if (prefix) prefixes.add(prefix);
          }
        }
      }
    });
    
    prefixes.forEach(prefix => {
      decl.cloneBefore({
        prop: `-${prefix}-${decl.prop}`,
        value: decl.value
      });
    });
  }

  addSpecialValuePrefixes(decl) {
    const { prop, value } = decl;
    
    if (prop === 'display') {
      if (value === 'flex' || value === 'inline-flex') {
        decl.cloneBefore({ prop: 'display', value: `-webkit-${value}` });
        decl.cloneBefore({ 
          prop: 'display', 
          value: value === 'flex' ? '-ms-flexbox' : '-ms-inline-flexbox'
        });
      }
      if (value === 'grid' || value === 'inline-grid') {
        decl.cloneBefore({ 
          prop: 'display', 
          value: value === 'grid' ? '-ms-grid' : '-ms-inline-grid' 
        });
      }
    }
    
    if (prop === 'background-clip' && value === 'text') {
      decl.cloneBefore({ prop: '-webkit-background-clip', value: 'text' });
    }
    
    if (prop === 'position' && value === 'sticky') {
      decl.cloneBefore({ prop: 'position', value: '-webkit-sticky' });
    }
  }

  findFeature(property) {
    if (!this.caniuseData) return null;
    
    const featureMap = {
      'transform': 'transforms2d',
      'transform-origin': 'transforms2d',
      'transform-style': 'transforms3d',
      'perspective': 'transforms3d',
      'backface-visibility': 'transforms3d',
      'transition': 'css-transitions',
      'animation': 'css-animation',
      'backdrop-filter': 'backdrop-filter',
      'filter': 'css-filters',
      'user-select': 'user-select-none',
      'appearance': 'css-appearance',
      'mask-image': 'css-masks',
      'box-shadow': 'css-boxshadow',
      'border-radius': 'border-radius',
      'text-fill-color': 'text-stroke',
      'text-stroke': 'text-stroke',
      'background-clip': 'background-img-opts',
      'flex': 'flexbox',
      'flex-grow': 'flexbox',
      'flex-shrink': 'flexbox',
      'flex-basis': 'flexbox',
      'justify-content': 'flexbox',
      'align-items': 'flexbox',
      'grid': 'css-grid',
      'grid-template': 'css-grid',
      'grid-column': 'css-grid',
      'grid-row': 'css-grid'
    };
    
    const featureId = featureMap[property];
    return featureId ? this.caniuseData[featureId] : null;
  }

  getCommonProperties() {
    return [
      'transform', 'transform-origin', 'transform-style',
      'transition', 'transition-property', 'transition-duration', 'transition-timing-function',
      'animation', 'animation-name', 'animation-duration', 'animation-timing-function',
      'animation-delay', 'animation-iteration-count', 'animation-direction',
      'animation-fill-mode', 'animation-play-state',
      'backdrop-filter', 'filter',
      'user-select', 'appearance',
      'text-fill-color', 'text-stroke', 'text-stroke-color', 'text-stroke-width',
      'background-clip',
      'mask-image', 'mask-clip', 'mask-composite', 'mask-origin',
      'mask-position', 'mask-repeat', 'mask-size',
      'box-shadow', 'border-radius', 'box-sizing',
      'display', 'flex', 'flex-grow', 'flex-shrink', 'flex-basis',
      'justify-content', 'align-items', 'align-self', 'align-content',
      'grid', 'grid-template', 'grid-column', 'grid-row'
    ];
  }
}

module.exports = ChainCSSPrefixer;