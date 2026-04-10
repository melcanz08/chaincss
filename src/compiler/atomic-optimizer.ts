// chaincss/src/compiler/atomic-optimizer.ts

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Types
export interface AtomicClass {
  className: string;
  prop: string;
  value: string;
  usageCount: number;
}

export interface AtomicOptimizerStats {
  totalStyles: number;
  atomicStyles: number;
  standardStyles: number;
  uniqueProperties: number;
  savings: string;
}

export interface AtomicOptimizerOptions {
  enabled?: boolean;
  threshold?: number;
  naming?: 'hash' | 'readable';
  cache?: boolean;
  cachePath?: string;
  minify?: boolean;
  mode?: 'standard' | 'atomic' | 'hybrid';
  outputStrategy?: 'component-first' | 'utility-first';
  alwaysAtomic?: string[];
  neverAtomic?: string[];
  frameworkOutput?: {
    react?: boolean;
    vue?: boolean;
    vanilla?: boolean;
  };
  preserveSelectors?: boolean;
  verbose?: boolean;
}

export interface ComponentClassMapEntry {
  atomicClasses: string[];
  hoverAtomicClasses: string[];
  selectors: string[];
}

export interface OptimizeResult {
  css: string;
  map: Record<string, string>;
  stats: AtomicOptimizerStats;
  atomicCSS: string;
  componentCSS: string;
  componentMap?: Map<string, ComponentClassMapEntry>;
}

// Utility functions
function hashKey(key: string): string {
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 6);
}

function kebab(s: string): string {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export class AtomicOptimizer {
  options: Required<AtomicOptimizerOptions>;
  usageCount: Map<string, number>;
  atomicClasses: Map<string, AtomicClass>;
  componentClassMap: Map<string, ComponentClassMapEntry>;
  stats: {
    totalStyles: number;
    atomicStyles: number;
    standardStyles: number;
    uniqueProperties: number;
    savings: number;
  };

  constructor(options: AtomicOptimizerOptions = {}) {
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
  
  private loadCache(): void {
    try {
      if (!fs.existsSync(this.options.cachePath)) return;
      
      const data = JSON.parse(fs.readFileSync(this.options.cachePath, 'utf8'));
      
      if (data.version !== '1.0.0') {
        return;
      }
      
      if (data.config?.threshold !== this.options.threshold) {
        return;
      }
      
      this.atomicClasses = new Map(data.atomicClasses || []);
      this.componentClassMap = new Map(data.componentClassMap || []);
      this.stats = data.stats || this.stats;
      
    } catch (err) {
      if (this.options.verbose) {
        console.log('Could not load cache:', (err as Error).message);
      }
    }
  }
  
  private saveCache(): void {
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
      if (this.options.verbose) {
        console.log('Could not save cache:', (err as Error).message);
      }
    }
  }

  // ============================================================================
  // Style Tracking
  // ============================================================================
  
  private trackStyles(styles: any[] | Record<string, any>): void {
    const styleArray = Array.isArray(styles) ? styles : Object.values(styles);
    
    for (const style of styleArray) {
      if (!style || !style.selectors) continue;
      
      for (const [prop, value] of Object.entries(style)) {
        if (prop === 'selectors' || prop === 'atRules') continue;
        
        if (prop === 'hover' && value && typeof value === 'object') {
          for (const [hoverProp, hoverValue] of Object.entries(value)) {
            this.incrementUsage(hoverProp, hoverValue as string);
          }
        } else {
          this.incrementUsage(prop, value as string);
        }
      }
    }
    
    this.stats.uniqueProperties = this.usageCount.size;
  }
  
  private incrementUsage(prop: string, value: string): void {
    const key = `${prop}:${value}`;
    const count = (this.usageCount.get(key) || 0) + 1;
    this.usageCount.set(key, count);
    this.stats.totalStyles++;
    
    if (this.atomicClasses.has(key)) {
      const atomic = this.atomicClasses.get(key)!;
      atomic.usageCount = count;
    }
  }
  
  private shouldBeAtomic(prop: string, value: string): boolean {
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
  
  private generateClassName(prop: string, value: string): string {
    const key = `${prop}:${value}`;
    
    if (this.options.naming === 'hash') {
      return `c_${hashKey(key)}`;
    }
    
    const kebabProp = kebab(prop);
    const safeValue = String(value).replace(/[^a-z0-9_-]/gi, '-').slice(0, 30);
    return `${kebabProp}-${safeValue}`;
  }
  
  private getOrCreateAtomic(prop: string, value: string): string {
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
    
    return this.atomicClasses.get(key)!.className;
  }
  
  private getKeyFromClassName(className: string): string | null {
    for (const [key, atomic] of this.atomicClasses) {
      if (atomic.className === className) return key;
    }
    return null;
  }

  // ============================================================================
  // CSS Generation
  // ============================================================================
  
  private generateAtomicCSS(): string {
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
    
    return css;
  }
  
  private generateComponentCSS(style: Record<string, any>, selectors: string[]): {
    css: string;
    atomicClasses: string[];
    hoverAtomicClasses: string[];
  } {
    const atomicClasses: string[] = [];
    const hoverAtomicClasses: string[] = [];
    
    // Track which properties become atomic
    for (const [prop, value] of Object.entries(style)) {
      if (prop === 'selectors' || prop === 'atRules') continue;
      
      if (prop === 'hover' && typeof value === 'object') {
        for (const [hoverProp, hoverValue] of Object.entries(value)) {
          if (this.shouldBeAtomic(hoverProp, hoverValue as string)) {
            hoverAtomicClasses.push(this.getOrCreateAtomic(hoverProp, hoverValue as string));
          }
        }
      } else if (this.shouldBeAtomic(prop, value as string)) {
        atomicClasses.push(this.getOrCreateAtomic(prop, value as string));
      }
    }
    
    let componentCSS = '';
    const selectorStr = selectors.join(', ');
    
    // COMPONENT-FIRST STRATEGY (Default)
    if (this.options.outputStrategy === 'component-first') {
      // Include ALL properties in component CSS
      const allStyles: Record<string, any> = {};
      
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
        const allHoverStyles: Record<string, any> = {};
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
      const standardStyles: Record<string, any> = {};
      const hoverStandardStyles: Record<string, any> = {};
      
      for (const [prop, value] of Object.entries(style)) {
        if (prop === 'selectors' || prop === 'atRules') continue;
        
        if (prop === 'hover' && typeof value === 'object') {
          for (const [hoverProp, hoverValue] of Object.entries(value)) {
            if (!this.shouldBeAtomic(hoverProp, hoverValue as string)) {
              hoverStandardStyles[hoverProp] = hoverValue;
            }
          }
        } else if (!this.shouldBeAtomic(prop, value as string)) {
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
  
  optimize(stylesInput: any[] | Record<string, any>): OptimizeResult {
    if (!this.options.enabled) {
      return { 
        css: '', 
        map: {}, 
        stats: this.getStats(),
        atomicCSS: '',
        componentCSS: ''
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
    let styleArray: any[] = [];
    if (Array.isArray(stylesInput)) {
      styleArray = stylesInput;
    } else if (typeof stylesInput === 'object') {
      styleArray = Object.values(stylesInput).filter(v => v && typeof v === 'object');
    }
    
    if (styleArray.length === 0) {
      return { 
        css: '', 
        map: {}, 
        stats: this.getStats(), 
        atomicCSS: '', 
        componentCSS: '' 
      };
    }
    
    // FIRST: Track usage counts
    this.trackStyles(styleArray);
    
    // SECOND: Generate component CSS (this populates atomicClasses via getOrCreateAtomic)
    let componentCSS = '';
    const classMap: Record<string, string> = {};
    
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
  
  getStats(): AtomicOptimizerStats {
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
  
  getAtomicClass(prop: string, value: string): string | null {
    const key = `${prop}:${value}`;
    const atomic = this.atomicClasses.get(key);
    return atomic ? atomic.className : null;
  }
  
  getAllAtomicClasses(): AtomicClass[] {
    return Array.from(this.atomicClasses.values());
  }
  
  clearCache(): void {
    this.atomicClasses.clear();
    this.componentClassMap.clear();
    this.usageCount.clear();
    if (this.options.cache && fs.existsSync(this.options.cachePath)) {
      fs.unlinkSync(this.options.cachePath);
    }
  }
}

// ESM Export
export { AtomicOptimizer as default };