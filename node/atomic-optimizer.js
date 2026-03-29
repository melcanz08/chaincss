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
    // Ensure arrays are arrays (fix for config merging issues)
    if (options.alwaysAtomic && !Array.isArray(options.alwaysAtomic)) {
      options.alwaysAtomic = Object.values(options.alwaysAtomic);
    }
    if (options.neverAtomic && !Array.isArray(options.neverAtomic)) {
      options.neverAtomic = Object.values(options.neverAtomic);
    }
    
    this.options = {
      enabled: true,
      threshold: 3,
      naming: 'hash',
      cache: true,
      cachePath: './.chaincss-cache',
      minify: true,
      mode: 'hybrid',
      outputStrategy: 'component-first',
      alwaysAtomic: [],
      neverAtomic: [
        'content', 'animation', 'transition', 'keyframes',
        'counterIncrement', 'counterReset'
      ],
      frameworkOutput: {
        react: false,
        vue: false,
        vanilla: true
      },
      preserveSelectors: false,
      verbose: false,
      ...options
    };
    
    this.usageCount = new Map();
    this.atomicClasses = new Map();
    this.componentClassMap = new Map();
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
      
      if (data.version !== '1.0.0') {
        //if (this.options.verbose) console.log('Cache version mismatch, creating new cache');
        return;
      }
      
      if (data.config?.threshold !== this.options.threshold) {
        //if (this.options.verbose) console.log(`Cache threshold (${data.config?.threshold}) differs from current (${this.options.threshold})`);
        return;
      }
      
      this.atomicClasses = new Map(data.atomicClasses || []);
      this.componentClassMap = new Map(data.componentClassMap || []);
      this.stats = data.stats || this.stats;
      
      const cacheTime = new Date(data.timestamp).toLocaleString();
      
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
      
      const cache = {
        version: '1.0.0',
        timestamp: Date.now(),
        atomicClasses: Array.from(this.atomicClasses.entries()),
        componentClassMap: Array.from(this.componentClassMap.entries()),
        stats: this.stats,
        config: {
          threshold: this.options.threshold,
          naming: this.options.naming,
          mode: this.options.mode,
          outputStrategy: this.options.outputStrategy
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
        if (prop === 'selectors' || prop === 'atRules') continue;
        
        if (prop === 'hover' && typeof value === 'object') {
          for (const [hoverProp, hoverValue] of Object.entries(value)) {
            this.incrementUsage(hoverProp, hoverValue);
          }
        } else {
          this.incrementUsage(prop, value);
        }
      }
    }
    
    this.stats.uniqueProperties = this.usageCount.size;
  }
  
  incrementUsage(prop, value) {
    const key = `${prop}:${value}`;
    const count = (this.usageCount.get(key) || 0) + 1;
    this.usageCount.set(key, count);
    this.stats.totalStyles++;
    
    if (this.atomicClasses.has(key)) {
      this.atomicClasses.get(key).usageCount = count;
    }
  }
  
  shouldBeAtomic(prop, value) {
    if (this.options.mode === 'standard') return false;
    if (this.options.mode === 'atomic') return true;
    
    if (this.options.neverAtomic.includes(prop)) return false;
    if (this.options.alwaysAtomic.includes(prop)) return true;
    
    const criticalProps = ['position', 'display', 'flex', 'grid', 'zIndex', 'top', 'left', 'right', 'bottom'];
    const isCritical = criticalProps.includes(prop);
    
    const key = `${prop}:${value}`;
    const usage = this.usageCount.get(key) || 0;
    
    if (isCritical && usage < this.options.threshold * 2) return false;
    return usage >= this.options.threshold;
  }
  
  generateClassName(prop, value) {
    const key = `${prop}:${value}`;
    
    if (this.options.naming === 'hash') {
      return `c_${hashKey(key)}`;
    }
    
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
  
  getKeyFromClassName(className) {
    for (const [key, atomic] of this.atomicClasses) {
      if (atomic.className === className) return key;
    }
    return null;
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
      if (this.options.minify) {
        css += `.${atomic.className}{${kebabProp}:${atomic.value}}`;
      } else {
        css += `.${atomic.className} {\n  ${kebabProp}: ${atomic.value};\n}\n`;
      }
    }
    
    // Debug: Log atomic CSS generation
    if (this.options.verbose && css) {
      //console.log(` Generated ${this.atomicClasses.size} atomic classes (${css.length} bytes)`);
      if (css.length > 0) {
        //console.log(`First atomic class: ${css.substring(0, 50)}...`);
      }
    }
    
    return css;
  }
  
  generateComponentCSS(style, selectors) {
    const atomicClasses = [];
    const hoverAtomicClasses = [];
    
    // Track which properties become atomic
    for (const [prop, value] of Object.entries(style)) {
      if (prop === 'selectors' || prop === 'atRules') continue;
      
      if (prop === 'hover' && typeof value === 'object') {
        for (const [hoverProp, hoverValue] of Object.entries(value)) {
          if (this.shouldBeAtomic(hoverProp, hoverValue)) {
            hoverAtomicClasses.push(this.getOrCreateAtomic(hoverProp, hoverValue));
          }
        }
      } else if (this.shouldBeAtomic(prop, value)) {
        atomicClasses.push(this.getOrCreateAtomic(prop, value));
      }
    }
    
    let componentCSS = '';
    const selectorStr = selectors.join(', ');
    
    // COMPONENT-FIRST STRATEGY (Default)
    if (this.options.outputStrategy === 'component-first') {
      // Include ALL properties in component CSS
      const allStyles = {};
      
      // Add all properties (both atomic and non-atomic)
      for (const [prop, value] of Object.entries(style)) {
        if (prop !== 'selectors' && prop !== 'atRules' && prop !== 'hover') {
          allStyles[prop] = value;
        }
      }
      
      // Generate CSS with ALL properties
      if (Object.keys(allStyles).length > 0) {
        if (this.options.minify) {
          componentCSS += `${selectorStr}{`;
          for (const [prop, value] of Object.entries(allStyles)) {
            const kebabProp = kebab(prop);
            componentCSS += `${kebabProp}:${value};`;
          }
          componentCSS += `}`;
        } else {
          componentCSS += `${selectorStr} {\n`;
          for (const [prop, value] of Object.entries(allStyles)) {
            const kebabProp = kebab(prop);
            componentCSS += `  ${kebabProp}: ${value};\n`;
          }
          componentCSS += `}\n`;
        }
      }
      
      // Add hover styles (all hover properties)
      if (style.hover && typeof style.hover === 'object') {
        const allHoverStyles = {};
        for (const [prop, value] of Object.entries(style.hover)) {
          allHoverStyles[prop] = value;
        }
        
        if (Object.keys(allHoverStyles).length > 0) {
          if (this.options.minify) {
            componentCSS += `${selectorStr}:hover{`;
            for (const [prop, value] of Object.entries(allHoverStyles)) {
              const kebabProp = kebab(prop);
              componentCSS += `${kebabProp}:${value};`;
            }
            componentCSS += `}`;
          } else {
            componentCSS += `${selectorStr}:hover {\n`;
            for (const [prop, value] of Object.entries(allHoverStyles)) {
              const kebabProp = kebab(prop);
              componentCSS += `  ${kebabProp}: ${value};\n`;
            }
            componentCSS += `}\n`;
          }
        }
      }
    }
    
    // UTILITY-FIRST STRATEGY (Advanced)
    else {
      const standardStyles = {};
      const hoverStandardStyles = {};
      
      for (const [prop, value] of Object.entries(style)) {
        if (prop === 'selectors' || prop === 'atRules') continue;
        
        if (prop === 'hover' && typeof value === 'object') {
          for (const [hoverProp, hoverValue] of Object.entries(value)) {
            if (!this.shouldBeAtomic(hoverProp, hoverValue)) {
              hoverStandardStyles[hoverProp] = hoverValue;
            }
          }
        } else if (!this.shouldBeAtomic(prop, value)) {
          standardStyles[prop] = value;
        }
      }
      
      if (Object.keys(standardStyles).length > 0) {
        if (this.options.minify) {
          componentCSS += `${selectorStr}{`;
          for (const [prop, value] of Object.entries(standardStyles)) {
            const kebabProp = kebab(prop);
            componentCSS += `${kebabProp}:${value};`;
          }
          componentCSS += `}`;
        } else {
          componentCSS += `${selectorStr} {\n`;
          for (const [prop, value] of Object.entries(standardStyles)) {
            const kebabProp = kebab(prop);
            componentCSS += `  ${kebabProp}: ${value};\n`;
          }
          componentCSS += `}\n`;
        }
      }
      
      if (Object.keys(hoverStandardStyles).length > 0) {
        if (this.options.minify) {
          componentCSS += `${selectorStr}:hover{`;
          for (const [prop, value] of Object.entries(hoverStandardStyles)) {
            const kebabProp = kebab(prop);
            componentCSS += `${kebabProp}:${value};`;
          }
          componentCSS += `}`;
        } else {
          componentCSS += `${selectorStr}:hover {\n`;
          for (const [prop, value] of Object.entries(hoverStandardStyles)) {
            const kebabProp = kebab(prop);
            componentCSS += `  ${kebabProp}: ${value};\n`;
          }
          componentCSS += `}\n`;
        }
      }
    }
    
    return {
      css: componentCSS,
      atomicClasses,
      hoverAtomicClasses
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
    
    // Reset stats
    this.stats = {
      totalStyles: 0,
      atomicStyles: 0,
      standardStyles: 0,
      uniqueProperties: 0,
      savings: 0
    };
    this.usageCount.clear();
    this.componentClassMap.clear();
    
    // Normalize input
    let styleArray = [];
    if (Array.isArray(stylesInput)) {
      styleArray = stylesInput;
    } else if (typeof stylesInput === 'object') {
      styleArray = Object.values(stylesInput).filter(v => v && typeof v === 'object');
    }
    
    if (styleArray.length === 0) {
      return { css: '', map: {}, stats: this.getStats(), atomicCSS: '', componentCSS: '' };
    }
    
    // FIRST: Track usage counts
    this.trackStyles(styleArray);
    
    // SECOND: Generate component CSS (this populates atomicClasses via getOrCreateAtomic)
    let componentCSS = '';
    const classMap = {};
    
    for (const style of styleArray) {
      if (!style || !style.selectors) continue;
      
      const selectors = style.selectors;
      const selectorKey = selectors.join(', ');
      const { css, atomicClasses, hoverAtomicClasses } = this.generateComponentCSS(style, selectors);
      componentCSS += css;
      
      if (this.options.outputStrategy === 'utility-first') {
        if (atomicClasses.length > 0) {
          classMap[selectorKey] = atomicClasses.join(' ');
        }
        if (hoverAtomicClasses.length > 0) {
          classMap[`${selectorKey}:hover`] = hoverAtomicClasses.join(' ');
        }
      }
      
      this.componentClassMap.set(selectorKey, {
        atomicClasses,
        hoverAtomicClasses,
        selectors
      });
    }
    
    // THIRD: Generate atomic CSS (now atomicClasses is populated!)
    const atomicCSS = this.generateAtomicCSS();
    
    // Combine CSS
    const finalCSS = atomicCSS + componentCSS;
    
    // Log stats if verbose
    if (this.options.verbose) {
      const stats = this.getStats();
      //console.log(` Atomic Optimization Stats:`);
      //console.log(`   Output strategy: ${this.options.outputStrategy}`);
      //console.log(`   Total styles tracked: ${stats.totalStyles}`);
      //console.log(`   Atomic classes created: ${this.atomicClasses.size}`);
      //console.log(`   Atomic CSS length: ${atomicCSS.length} bytes`);
      //console.log(`   Component CSS length: ${componentCSS.length} bytes`);
      //console.log(`   Total CSS length: ${finalCSS.length} bytes`);
      //console.log(`   Savings: ${stats.savings}`);
      
      if (atomicCSS.length === 0 && this.atomicClasses.size > 0) {
        //console.log(`    WARNING: ${this.atomicClasses.size} atomic classes exist but generated CSS is empty!`);
      }
    }
    
    // Save cache
    if (this.options.cache) {
      this.saveCache();
    }
    
    return {
      css: finalCSS,
      map: classMap,
      stats: this.getStats(),
      atomicCSS: atomicCSS,
      componentCSS: componentCSS,
      componentMap: this.componentClassMap
    };
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
  
  getAtomicClass(prop, value) {
    const key = `${prop}:${value}`;
    const atomic = this.atomicClasses.get(key);
    return atomic ? atomic.className : null;
  }
  
  getAllAtomicClasses() {
    return Array.from(this.atomicClasses.values());
  }
  
  clearCache() {
    this.atomicClasses.clear();
    this.componentClassMap.clear();
    this.usageCount.clear();
    if (this.options.cache && fs.existsSync(this.options.cachePath)) {
      fs.unlinkSync(this.options.cachePath);
    }
    //console.log('Atomic optimizer cache cleared');
  }
}

module.exports = { AtomicOptimizer };