const path = require('path');
const fs = require('fs');

class AtomicOptimizer {
  constructor(options = {}) {
    this.options = {
      enabled: true,
      threshold: 3,
      naming: 'hash',
      cache: true,
      cachePath: './.chaincss-cache',
      minify: true,
      ...options
    };
    
    this.usageCount = new Map();
    this.atomicClasses = new Map();
    this.stats = {
      totalStyles: 0,
      atomicStyles: 0,
      standardStyles: 0,
      uniqueProperties: 0
    };
    
    this.cache = null;
    if (this.options.cache) {
      this.loadCache();
    }
  }

  loadCache() {
    try {
      if (fs.existsSync(this.options.cachePath)) {
        const data = fs.readFileSync(this.options.cachePath, 'utf8');
        const cache = JSON.parse(data);
        
        // Check version compatibility
        if (cache.version === '1.0.0') {
          this.atomicClasses = new Map(cache.atomicClasses || []);
          this.stats = cache.stats || this.stats;
          
          const cacheTime = new Date(cache.timestamp).toLocaleString();
          console.log(`--Loaded ${this.atomicClasses.size} atomic classes from cache (${cacheTime})\n`);
          
          // Verify config matches
          if (cache.config) {
            if (cache.config.threshold !== this.options.threshold) {
              console.log(`Cache threshold (${cache.config.threshold}) differs from current (${this.options.threshold})`);
            }
          }
        } else {
          console.log('Cache version mismatch, creating new cache');
        }
      }
    } catch (err) {
      console.log('Could not load cache:', err.message);
    }
  }

  saveCache() {
    try {
      const cache = {
        version: '1.0.0',
        timestamp: Date.now(),
        atomicClasses: Array.from(this.atomicClasses.entries()),
        stats: this.stats
      };
      
      // Keep only last 5 cache files for rollback
      const cacheDir = path.dirname(this.options.cachePath);
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir)
          .filter(f => f.startsWith('.chaincss-cache'))
          .map(f => ({
            name: f,
            time: fs.statSync(path.join(cacheDir, f)).mtime.getTime()
          }))
          .sort((a, b) => b.time - a.time);
        
        files.slice(4).forEach(f => {
          fs.unlinkSync(path.join(cacheDir, f.name));
        });
      }
      
      fs.writeFileSync(this.options.cachePath, JSON.stringify(cache, null, 2), 'utf8');
      
    } catch (err) {
      console.log('Could not save cache:', err.message);
    }
  }

  trackStyles(styles) {
    Object.values(styles).forEach(style => {
      Object.entries(style).forEach(([prop, value]) => {
        if (prop === 'selectors') return;
        const key = `${prop}:${value}`;
        this.usageCount.set(key, (this.usageCount.get(key) || 0) + 1);
        this.stats.totalStyles++;
      });
    });
    this.stats.uniqueProperties = this.usageCount.size;
  }

  shouldBeAtomic(prop, value) {
    const key = `${prop}:${value}`;
    const usage = this.usageCount.get(key) || 0;
    
    // Don't atomic-ify important layout properties that affect order
    const criticalProps = ['position', 'display', 'flex', 'grid', 'z-index'];
    const isCritical = criticalProps.some(p => prop.includes(p));
    
    if (isCritical && usage < this.options.threshold * 2) {
      return false; // Keep critical styles in place
    }
    
    return usage >= this.options.threshold;
  }

  generateClassName(prop, value) {
    const key = `${prop}:${value}`;
    
    if (this.options.naming === 'hash') {
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash |= 0;
      }
      return `_${Math.abs(hash).toString(36).substring(0, 6)}`;
    }
    
    const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    const safeValue = value.replace(/[^a-zA-Z0-9-]/g, '-');
    return `${kebabProp}-${safeValue}`;
  }

  getOrCreateAtomic(prop, value) {
    const key = `${prop}:${value}`;
    
    if (!this.atomicClasses.has(key)) {
      const className = this.generateClassName(prop, value);
      this.atomicClasses.set(key, {
        className,
        prop,
        value,
        usageCount: this.usageCount.get(key) || 0
      });
      this.stats.atomicStyles++;
    }
    
    return this.atomicClasses.get(key).className;
  }

  findKeyByClassName(className) {
    for (let [key, value] of this.atomicClasses.entries()) {
      if (value.className === className) return key;
    }
    return null;
  }

  generateAtomicCSS() {
    let css = '';
    
    const sortedClasses = Array.from(this.atomicClasses.values())
      .sort((a, b) => b.usageCount - a.usageCount);
    
    sortedClasses.forEach(atomic => {
      const kebabProp = atomic.prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      css += `.${atomic.className} { ${kebabProp}: ${atomic.value}; }\n`;
    });
    
    return css;
  }

  generateComponentCSS(componentName, style, selectors) {
    const atomicClasses = [];
    const standardStyles = {};
    
    // Separate atomic and standard styles
    Object.entries(style).forEach(([prop, value]) => {
      if (prop === 'selectors') return;
      
      if (this.shouldBeAtomic(prop, value)) {
        const className = this.getOrCreateAtomic(prop, value);
        atomicClasses.push(className);
      } else {
        standardStyles[prop] = value;
      }
    });
    
    let componentCSS = '';
    
    if (atomicClasses.length > 0 || Object.keys(standardStyles).length > 0) {
      componentCSS += `${selectors.join(', ')} {\n`;
      
      // EXPAND atomic classes into actual properties
      atomicClasses.forEach(className => {
        const key = this.findKeyByClassName(className);
        if (key) {
          const atomic = this.atomicClasses.get(key);
          const kebabProp = atomic.prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          componentCSS += `  ${kebabProp}: ${atomic.value};\n`;
        }
      });
      
      // Add standard styles (these will override atomic if needed)
      Object.entries(standardStyles).forEach(([prop, value]) => {
        const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        componentCSS += `  ${kebabProp}: ${value};\n`;
      });
      
      componentCSS += `}\n`;
    }
    
    return componentCSS;
  }

  validateStyleOrder(originalStyles, atomicStyles) {
    // Compare original vs atomic to ensure no missing styles
    const originalProps = new Set();
    const atomicProps = new Set();
    
    Object.values(originalStyles).forEach(style => {
      Object.keys(style).forEach(prop => {
        if (prop !== 'selectors') originalProps.add(prop);
      });
    });
    
    // Check atomic classes for missing props
    this.atomicClasses.forEach(atomic => {
      atomicProps.add(atomic.prop);
    });
    
    const missingProps = [...originalProps].filter(p => !atomicProps.has(p));
    if (missingProps.length > 0) {
      console.warn('Missing atomic classes for:', missingProps);
    }
  }

  optimize(styles) {
    // Track usage first
    this.trackStyles(styles);
    
    // Generate atomic CSS 
    let atomicCSS = this.generateAtomicCSS();
    
    // Generate component CSS with expanded styles
    let componentCSS = '';
    
    // Process components in original order to maintain specificity
    Object.entries(styles).forEach(([name, style]) => {
      const selectors = style.selectors || [`.${name}`];
      componentCSS += this.generateComponentCSS(name, style, selectors);
    });
    
    // Calculate savings
    const savings = ((this.stats.totalStyles - this.atomicClasses.size) / this.stats.totalStyles * 100).toFixed(1);
    
    // Save cache if enabled
    if (this.options.cache) {
      this.saveCache();
    }
    
    // Return atomic CSS first, then component CSS
    // This ensures atomic classes are defined before they're used
    return atomicCSS + componentCSS;
  }
}

module.exports = { AtomicOptimizer };