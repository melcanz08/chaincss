const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

function hashKey(key) {
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 6);
}

function kebab(s) {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}

class AtomicOptimizer {
  constructor(options = {}) {
    this.options = {
      enabled: true,
      threshold: 3,                    // Default threshold
      naming: 'hash',                  // 'hash' | 'readable'
      cache: true,
      cachePath: './.chaincss-cache',
      minify: true,
      alwaysAtomic: [],                // Force these props to be atomic
      neverAtomic: [                   // Never make these atomic
        'content', 'animation', 'transition', 'keyframes',
        'counterIncrement', 'counterReset'
      ],
      ...options
    };
    
    this.usageCount = new Map();        // prop:value -> count
    this.atomicClasses = new Map();     // prop:value -> { className, prop, value, usageCount }
    this.stats = {
      totalStyles: 0,
      atomicStyles: 0,
      standardStyles: 0,
      uniqueProperties: 0,
      savings: 0
    };
    
    if (this.options.cache) {
      this.loadCache();
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================
  
  loadCache() {
    try {
      if (!fs.existsSync(this.options.cachePath)) return;
      
      const data = JSON.parse(fs.readFileSync(this.options.cachePath, 'utf8'));
      
      // Version check
      if (data.version !== '1.0.0') {
        console.log('Cache version mismatch, creating new cache');
        return;
      }
      
      // Check if config changed
      if (data.config?.threshold !== this.options.threshold) {
        console.log(`Cache threshold (${data.config?.threshold}) differs from current (${this.options.threshold})`);
        return;
      }
      
      this.atomicClasses = new Map(data.atomicClasses || []);
      this.stats = data.stats || this.stats;
      
      const cacheTime = new Date(data.timestamp).toLocaleString();
      console.log(`✅ Loaded ${this.atomicClasses.size} atomic classes from cache (${cacheTime})`);
      
    } catch (err) {
      console.log('Could not load cache:', err.message);
    }
  }
  
  saveCache() {
    if (!this.options.cache) return;
    
    try {
      const cacheDir = path.dirname(this.options.cachePath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      // Clean up old cache files (keep last 5)
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir)
          .filter(f => f.startsWith('.chaincss-cache'))
          .map(f => ({
            name: f,
            time: fs.statSync(path.join(cacheDir, f)).mtime.getTime()
          }))
          .sort((a, b) => b.time - a.time);
        
        // Keep only the 5 most recent cache files
        files.slice(5).forEach(f => {
          try { fs.unlinkSync(path.join(cacheDir, f.name)); } catch {}
        });
      }
      
      const cache = {
        version: '1.0.0',
        timestamp: Date.now(),
        atomicClasses: Array.from(this.atomicClasses.entries()),
        stats: this.stats,
        config: {
          threshold: this.options.threshold,
          naming: this.options.naming
        }
      };
      
      fs.writeFileSync(this.options.cachePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (err) {
      console.log('Could not save cache:', err.message);
    }
  }

  // ============================================================================
  // Style Tracking
  // ============================================================================
  
  trackStyles(styles) {
    const styleArray = Array.isArray(styles) ? styles : Object.values(styles);
    
    for (const style of styleArray) {
      if (!style || !style.selectors) continue;
      
      for (const [prop, value] of Object.entries(style)) {
        if (prop === 'selectors' || prop === 'atRules' || prop === 'hover') continue;
        
        const key = `${prop}:${value}`;
        this.usageCount.set(key, (this.usageCount.get(key) || 0) + 1);
        this.stats.totalStyles++;
      }
    }
    
    this.stats.uniqueProperties = this.usageCount.size;
  }
  
  shouldBeAtomic(prop, value) {
    // Never atomic
    if (this.options.neverAtomic.includes(prop)) return false;
    
    // Always atomic
    if (this.options.alwaysAtomic.includes(prop)) return true;
    
    // Critical props that need higher threshold
    const criticalProps = ['position', 'display', 'flex', 'grid', 'zIndex', 'top', 'left', 'right', 'bottom'];
    const isCritical = criticalProps.includes(prop);
    
    const key = `${prop}:${value}`;
    const usage = this.usageCount.get(key) || 0;
    
    // Critical props need double threshold to be atomic
    if (isCritical && usage < this.options.threshold * 2) {
      return false;
    }
    
    return usage >= this.options.threshold;
  }
  
  generateClassName(prop, value) {
    const key = `${prop}:${value}`;
    
    if (this.options.naming === 'hash') {
      return `c_${hashKey(key)}`;
    }
    
    // Readable naming
    const kebabProp = kebab(prop);
    const safeValue = String(value).replace(/[^a-z0-9_-]/gi, '-').slice(0, 30);
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

  // ============================================================================
  // CSS Generation
  // ============================================================================
  
  generateAtomicCSS() {
    let css = '';
    const sortedClasses = Array.from(this.atomicClasses.values())
      .sort((a, b) => b.usageCount - a.usageCount);
    
    for (const atomic of sortedClasses) {
      const kebabProp = kebab(atomic.prop);
      css += `.${atomic.className}{${kebabProp}:${atomic.value}${this.options.minify ? '' : ';'}}\n`;
    }
    
    return css;
  }
  
  generateComponentCSS(componentName, style, selectors) {
    const atomicClasses = [];
    const standardStyles = {};
    const hoverStyles = {};
    
    // Separate styles
    for (const [prop, value] of Object.entries(style)) {
      if (prop === 'selectors' || prop === 'atRules') continue;
      
      if (prop === 'hover' && typeof value === 'object') {
        // Handle hover styles
        for (const [hoverProp, hoverValue] of Object.entries(value)) {
          if (this.shouldBeAtomic(hoverProp, hoverValue)) {
            atomicClasses.push(this.getOrCreateAtomic(hoverProp, hoverValue));
          } else {
            hoverStyles[hoverProp] = hoverValue;
          }
        }
      } else if (this.shouldBeAtomic(prop, value)) {
        atomicClasses.push(this.getOrCreateAtomic(prop, value));
      } else {
        standardStyles[prop] = value;
      }
    }
    
    // Generate CSS
    let componentCSS = '';
    const selectorStr = selectors.join(', ');
    
    if (atomicClasses.length > 0 || Object.keys(standardStyles).length > 0) {
      componentCSS += `${selectorStr} {\n`;
      
      // Atomic classes (inlined for specificity)
      for (const className of atomicClasses) {
        const atomic = this.findAtomicByClassName(className);
        if (atomic) {
          const kebabProp = kebab(atomic.prop);
          componentCSS += `  ${kebabProp}: ${atomic.value};\n`;
        }
      }
      
      // Standard styles
      for (const [prop, value] of Object.entries(standardStyles)) {
        const kebabProp = kebab(prop);
        componentCSS += `  ${kebabProp}: ${value};\n`;
      }
      
      componentCSS += `}\n`;
    }
    
    // Hover styles
    if (Object.keys(hoverStyles).length > 0) {
      componentCSS += `${selectorStr}:hover {\n`;
      for (const [prop, value] of Object.entries(hoverStyles)) {
        const kebabProp = kebab(prop);
        componentCSS += `  ${kebabProp}: ${value};\n`;
      }
      componentCSS += `}\n`;
    }
    
    return componentCSS;
  }
  
  findAtomicByClassName(className) {
    for (const atomic of this.atomicClasses.values()) {
      if (atomic.className === className) return atomic;
    }
    return null;
  }
  
  validateStyleOrder(originalStyles, atomicStyles) {
    const originalProps = new Set();
    const atomicProps = new Set();
    
    const styleArray = Array.isArray(originalStyles) ? originalStyles : Object.values(originalStyles);
    for (const style of styleArray) {
      if (!style) continue;
      for (const prop of Object.keys(style)) {
        if (prop !== 'selectors' && prop !== 'atRules' && prop !== 'hover') {
          originalProps.add(prop);
        }
      }
    }
    
    for (const atomic of this.atomicClasses.values()) {
      atomicProps.add(atomic.prop);
    }
    
    const missingProps = [...originalProps].filter(p => !atomicProps.has(p));
    if (missingProps.length > 0) {
      console.warn('⚠️ Missing atomic classes for:', missingProps.slice(0, 10));
    }
  }
  
  getStats() {
    const savings = this.stats.totalStyles > 0 
      ? ((this.stats.totalStyles - this.stats.atomicStyles) / this.stats.totalStyles * 100).toFixed(1)
      : 0;
    
    return {
      totalStyles: this.stats.totalStyles,
      atomicStyles: this.stats.atomicStyles,
      standardStyles: this.stats.standardStyles,
      uniqueProperties: this.stats.uniqueProperties,
      savings: `${savings}%`
    };
  }

  // ============================================================================
  // Main Optimize Method
  // ============================================================================
  
  optimize(stylesInput) {
    if (!this.options.enabled) {
      return { 
        css: '', 
        map: {}, 
        stats: this.getStats(),
        atomicCSS: ''
      };
    }
    
    // Normalize input to array
    const styleArray = Array.isArray(stylesInput) 
      ? stylesInput 
      : typeof stylesInput === 'object' 
        ? Object.values(stylesInput) 
        : [];
    
    // Track usage counts
    this.trackStyles(styleArray);
    
    // Generate CSS
    let atomicCSS = this.generateAtomicCSS();
    let componentCSS = '';
    const classMap = {};
    
    for (const style of styleArray) {
      if (!style || !style.selectors) continue;
      
      const selectors = style.selectors;
      const selectorKey = selectors.join(', ');
      
      // Generate component CSS
      componentCSS += this.generateComponentCSS(style.name || 'component', style, selectors);
      
      // Build class map for users
      const atomicClassesForSelector = [];
      for (const [prop, value] of Object.entries(style)) {
        if (prop === 'selectors' || prop === 'atRules' || prop === 'hover') continue;
        if (this.shouldBeAtomic(prop, value)) {
          atomicClassesForSelector.push(this.getOrCreateAtomic(prop, value));
        }
      }
      classMap[selectorKey] = atomicClassesForSelector.join(' ');
    }
    
    // Validation
    this.validateStyleOrder(styleArray);
    
    // Save cache
    if (this.options.cache) {
      this.saveCache();
    }
    
    // Calculate savings
    const savings = this.stats.totalStyles > 0 
      ? ((this.stats.totalStyles - this.atomicClasses.size) / this.stats.totalStyles * 100).toFixed(1)
      : 0;
    
    return {
      css: (atomicCSS + componentCSS).trim(),
      map: classMap,
      stats: this.getStats(),
      atomicCSS: atomicCSS.trim(),
      componentCSS: componentCSS.trim()
    };
  }
}

module.exports = { AtomicOptimizer };