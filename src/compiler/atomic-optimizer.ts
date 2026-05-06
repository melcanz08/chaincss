// chaincss/src/compiler/atomic-optimizer.ts
import { ChainCSSConfig } from '../cli/types.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Types
export interface AtomicClass {
  className: string;
  prop: string;
  value: any;
  usageCount: number;
  rules?: string;
  createdAt?: number;
  hash?: string;
}

export interface AtomicOptimizerStats {
  totalStyles: number;
  atomicStyles: number;
  standardStyles: number;
  uniqueProperties: number;
  savings: string;
  cacheHitRate?: number;
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
  componentClassName?: string;
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
  private config: ChainCSSConfig; 
  options: Required<AtomicOptimizerOptions>;
  private usageCount: Map<string, number>;
  private atomicClasses: Map<string, AtomicClass>;
  public atomicMap: Record<string, string> = {};
  componentClassMap: Map<string, ComponentClassMapEntry>;
  stats: {
    totalStyles: number;
    atomicStyles: number;
    standardStyles: number;
    uniqueProperties: number;
    savings: number;
    cacheHits: number;
    cacheMisses: number;
  };

  constructor(config: any) {
    this.config = config;
    const atomicOptions = config.atomic || {};
    
    this.options = {
      enabled: atomicOptions.enabled !== false,
      threshold: atomicOptions.threshold ?? 2,
      naming: atomicOptions.naming ?? (process.env.NODE_ENV === 'production' ? 'hash' : 'readable'),
      cache: atomicOptions.cache !== false,
      cachePath: atomicOptions.cachePath || './.chaincss-cache/atomic-cache.json',
      minify: config.output?.minify ?? true,
      mode: atomicOptions.mode || 'hybrid',
      outputStrategy: atomicOptions.outputStrategy || 'component-first',
      alwaysAtomic: atomicOptions.alwaysAtomic || [],
      neverAtomic: atomicOptions.neverAtomic || [
        'content', 'animation', 'transition', 'keyframes',
        'animation-name', 'animation-duration', 'animation-timing-function',
        'transition-property', 'transition-duration'
      ],
      frameworkOutput: { react: false, vue: false, vanilla: true },
      preserveSelectors: atomicOptions.preserveSelectors || false,
      verbose: config.verbose || false,
    };
    
    this.usageCount = new Map();
    this.atomicClasses = new Map();
    this.componentClassMap = new Map();
    this.stats = {
      totalStyles: 0,
      atomicStyles: 0,
      standardStyles: 0,
      uniqueProperties: 0,
      savings: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    if (this.options.cache) {
      this.loadCache();
    }
  }

  public componentMap = new Map<string, ComponentClassMapEntry>();

  /**
   * Get usage count for a specific property-value pair
   */
  public getUsageCount(prop: string, value: string, context: string = ''): number {
    const key = context ? `${context}|${prop}:${value}` : `${prop}:${value}`;
    return this.usageCount.get(key) || 0;
  }

  /**
   * Increment usage count for a specific property-value pair
   */
  public incrementUsageCount(prop: string, value: string, context: string = ''): void {
    const key = context ? `${context}|${prop}:${value}` : `${prop}:${value}`;
    const current = this.usageCount.get(key) || 0;
    this.usageCount.set(key, current + 1);
    this.stats.totalStyles++;
  }

  /**
   * Get the usage count map for debugging
   */
  public getUsageCountMap(): Map<string, number> {
    return new Map(this.usageCount);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================
  
  private loadCache(): void {
    try {
      const cacheDir = path.dirname(this.options.cachePath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      if (!fs.existsSync(this.options.cachePath)) return;
      
      const data = JSON.parse(fs.readFileSync(this.options.cachePath, 'utf8'));
      
      if (data.version !== '2.0.0') {
        if (this.options.verbose) {
          console.log('Cache version mismatch, rebuilding...');
        }
        return;
      }
      
      if (data.config?.threshold !== this.options.threshold) {
        if (this.options.verbose) {
          console.log('Threshold changed, rebuilding cache...');
        }
        return;
      }
      
      // Restore atomic classes
      if (data.atomicClasses) {
        for (const [key, value] of data.atomicClasses) {
          this.atomicClasses.set(key, value);
          // Also rebuild atomicMap
          const atomic = value;
          this.atomicMap[`${atomic.prop}:${atomic.value}`] = atomic.className;
        }
      }
      
      if (data.componentClassMap) {
        for (const [key, value] of data.componentClassMap) {
          this.componentClassMap.set(key, value);
        }
      }
      
      if (data.stats) {
        this.stats = { ...this.stats, ...data.stats };
      }
      
      if (this.options.verbose) {
        console.log(`✅ Cache loaded: ${this.atomicClasses.size} atomic classes`);
      }
      
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
        version: '2.0.0',
        timestamp: Date.now(),
        atomicClasses: Array.from(this.atomicClasses.entries()),
        componentClassMap: Array.from(this.componentClassMap.entries()),
        stats: {
          totalStyles: this.stats.totalStyles,
          atomicStyles: this.stats.atomicStyles,
          standardStyles: this.stats.standardStyles,
          uniqueProperties: this.stats.uniqueProperties
        },
        config: {
          threshold: this.options.threshold,
          naming: this.options.naming,
          mode: this.options.mode,
          outputStrategy: this.options.outputStrategy
        }
      };
      
      fs.writeFileSync(this.options.cachePath, JSON.stringify(cache, null, 2), 'utf8');
      
      if (this.options.verbose) {
        console.log(`💾 Cache saved: ${this.atomicClasses.size} atomic classes`);
      }
    } catch (err) {
      if (this.options.verbose) {
        console.log('Could not save cache:', (err as Error).message);
      }
    }
  }

  // ============================================================================
  // Style Tracking
  // ============================================================================
  
  public trackStyles(styles: any[]): void {
    if (!Array.isArray(styles)) return;
    
    for (const styleDef of styles) {
      if (!styleDef || typeof styleDef !== 'object') continue;
      
      for (const [prop, value] of Object.entries(styleDef)) {
        if (prop === 'selectors' || prop === 'path' || prop === 'atRules' || prop === 'nestedRules') continue;
        if (prop.startsWith('_')) continue;
        
        if (typeof value === 'string' || typeof value === 'number') {
          this.incrementUsageCount(prop, String(value));
        }
      }
      
      // Handle hover states
      if (styleDef.hover && typeof styleDef.hover === 'object') {
        for (const [hProp, hValue] of Object.entries(styleDef.hover)) {
          this.incrementUsageCount(hProp, String(hValue), 'hover');
        }
      }
      
      // Handle nested rules
      if (styleDef.nestedRules && Array.isArray(styleDef.nestedRules)) {
        for (const nested of styleDef.nestedRules) {
          if (nested.styles) {
            this.trackStyles([nested.styles]);
          }
        }
      }
    }
  }

  // ============================================================================
  // String-Based Scanning
  // ============================================================================
  
  public process(styleChain: string): void {
    try {
      const styleObj: Record<string, any> = {};
      // Better regex for parsing chain methods
      const methodRegex = /\.([a-zA-Z0-9]+)\s*\(\s*(['"]?)([^'")]+)\2\s*\)/g;
      let match;
      
      while ((match = methodRegex.exec(styleChain)) !== null) {
        const [, prop, , value] = match;
        if (prop && value) {
          styleObj[prop] = value;
        }
      }

      if (Object.keys(styleObj).length > 0) {
        this.trackStyles([styleObj]);
        
        for (const [prop, value] of Object.entries(styleObj)) {
          const className = this.getOrCreateAtomic(prop, value as string);
          this.atomicMap[`${prop}:${value}`] = className;
        }
      }
    } catch (e) {
      // Silent fail for malformed chains
      if (this.options.verbose) {
        console.log('Failed to process style chain:', e);
      }
    }
  }

  private processStyleObject(style: any, context: string = 'base'): void {
    if (!style) return;

    for (const [prop, value] of Object.entries(style)) {
      if (['selectors', 'atRules', 'nestedRules', 'hover'].includes(prop)) continue;
      if (prop.startsWith('_')) continue;
      
      this.incrementUsage(prop, value as string, context);
    }

    if (style.hover) {
      for (const [hProp, hVal] of Object.entries(style.hover)) {
        this.incrementUsage(hProp, hVal as string, `${context}:hover`);
      }
    }

    if (style.nestedRules) {
      style.nestedRules.forEach((nested: any) => 
        this.processStyleObject(nested.styles, context)
      );
    }

    if (style.atRules) {
      style.atRules.forEach((rule: any) => {
        if (rule.styles) this.processStyleObject(rule.styles, rule.query || context);
      });
    }
  }

  // Fixed: Class name generation with proper prefixes
  private generateClassName(prop: string, value: string, type: string): string {
    const hash = crypto.createHash('md5')
      .update(`${prop}${value}`)
      .digest('hex')
      .slice(0, 6);
    
    const propKebab = kebab(prop);
    
    // For atomic utilities, use 'a-' prefix
    if (type === 'atomic') {
      return `a-${propKebab}-${hash}`;
    }
    
    // For components, use single 'c-' prefix
    return `c-${propKebab}-${hash}`;
  }
    
  private incrementUsage(prop: string, value: string, context: string = 'base'): void {
    const key = `${context}|${prop}:${value}`;
    const count = (this.usageCount.get(key) || 0) + 1;
    this.usageCount.set(key, count);
    this.stats.totalStyles++;
    
    if (this.atomicClasses.has(key)) {
      const atomic = this.atomicClasses.get(key)!;
      atomic.usageCount = count;
    }
  }
  
  private shouldBeAtomic(prop: string, value: string, context: string = 'base'): boolean {
    if (this.options.mode === 'standard') return false;
    if (this.options.mode === 'atomic') return true;

    const kebabProp = kebab(prop);

    if (this.options.neverAtomic.includes(kebabProp)) return false;
    if (this.options.alwaysAtomic.includes(kebabProp)) return true;

    const key = `${context}|${prop}:${value}`;
    const usage = this.usageCount.get(key) || 0;
    
    return usage >= this.options.threshold;
  }
  
  private getOrCreateAtomic(prop: string, value: string, context: string = 'base'): string {
    const key = `${context}|${prop}:${value}`;
    
    // Check cache hit
    if (this.atomicClasses.has(key)) {
      this.stats.cacheHits++;
      return this.atomicClasses.get(key)!.className;
    }
    
    this.stats.cacheMisses++;
    
    const className = this.generateClassName(prop, value, 'atomic');
    const propKebab = kebab(prop);
    
    this.atomicClasses.set(key, {
      className,
      prop,
      value,
      rules: `${propKebab}: ${value};`,
      usageCount: this.usageCount.get(key) || 0,
      createdAt: Date.now(),
      hash: crypto.createHash('md5').update(key).digest('hex').slice(0, 8)
    });
    
    this.stats.atomicStyles++;
    this.stats.uniqueProperties++;
    
    return className;
  }
  
  public getKeyFromClassName(className: string): string | null {
    for (const [key, atomic] of this.atomicClasses) {
      if (atomic.className === className) return key;
    }
    return null;
  }

  // ============================================================================
  // CSS Generation
  // ============================================================================
  
  public generateAtomicCSS(): string {
    let css = "/* ChainCSS Atomic Bundle */\n";
    
    // Sort atomic classes for consistent output
    const sorted = Array.from(this.atomicClasses.values()).sort((a, b) => 
      a.className.localeCompare(b.className)
    );
    
    for (const data of sorted) {
      css += `.${data.className} { ${data.rules} }\n`;
    }
    
    return css;
  }
  
  public generateComponentCSS(style: any, selectors: string[], context: string = 'base'): {
    css: string;
    atomicClasses: string[];
  } {
    const atomicClasses: string[] = [];
    let standardRules = '';
    const selectorStr = selectors.join(', ');

    for (const [prop, value] of Object.entries(style)) {
      if (['selectors', 'atRules', 'nestedRules', 'hover'].includes(prop) || prop.startsWith('_')) continue;
      if (typeof value === 'object') continue;

      if (this.shouldBeAtomic(prop, value as string, context)) {
        const atomicClass = this.getOrCreateAtomic(prop, value as string, context);
        atomicClasses.push(atomicClass);
      } else {
        standardRules += `  ${kebab(prop)}: ${value};\n`;
      }
    }

    let css = standardRules ? `${selectorStr} {\n${standardRules}}\n` : '';

    if (style.nestedRules) {
      style.nestedRules.forEach((nested: any) => {
        const nestedSelector = nested.selector.replace('&', selectorStr);
        const nestedResult = this.generateComponentCSS(nested.styles, [nestedSelector], context);
        css += nestedResult.css;
        atomicClasses.push(...nestedResult.atomicClasses);
      });
    }

    if (style.atRules) {
      style.atRules.forEach((rule: any) => {
        if (rule.styles) {
          const ruleResult = this.generateComponentCSS(rule.styles, selectors, rule.query || context);
          css += `@${rule.type} ${rule.query} {\n${ruleResult.css}}\n`;
          atomicClasses.push(...ruleResult.atomicClasses);
        }
      });
    }

    return { css, atomicClasses };
  }

  /**
   * Generate a clean component name without any prefixes
   */
  private getCleanComponentName(rawName: string, componentId: string): string {
    // Remove leading dot
    let clean = rawName.replace(/^\./, '');
    
    // Remove any existing 'c-' or 'c-c-' prefixes
    clean = clean.replace(/^c-+/, '');
    
    // Replace special characters with hyphens
    clean = clean.replace(/[^a-zA-Z0-9_-]/g, '-');
    
    // Ensure it's not empty
    if (!clean || clean === '&') {
      clean = componentId.replace(/^c-+/, '');
    }
    
    // Remove componentId prefix if it's duplicated
    const componentIdClean = componentId.replace(/^c-+/, '');
    if (clean === componentIdClean || clean === `c-${componentIdClean}`) {
      clean = componentIdClean;
    }
    
    return clean;
  }

  // Helper method to generate pseudo-class CSS
  private generatePseudoCSS(
    pseudoClass: string, 
    styles: Record<string, any>, 
    selector: string
  ): string {
    let css = '';
    const pseudoSelector = `${selector}:${pseudoClass}`;
    let rules = '';

    for (const [prop, value] of Object.entries(styles)) {
      if (prop === 'selectors' || prop.startsWith('_')) continue;
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      rules += `  ${kebabProp}: ${value};\n`;
    }

    if (rules) {
      css = `${pseudoSelector} {\n${rules}}\n`;
    }

    return css;
  }

  // ============================================================================
  // ✅ MAIN OPTIMIZE METHOD - FULLY FIXED
  // ============================================================================
  
  public optimize(styles: Record<string, any>): OptimizeResult {
    const componentId = Object.keys(styles)[0];
    let styleDef = styles[componentId];
    let atomicClasses: string[] = [];

    if (!styleDef || typeof styleDef !== 'object') {
      return { 
        css: '', 
        map: {}, 
        stats: this.getStats(), 
        atomicCSS: '', 
        componentCSS: '',
        componentMap: this.componentMap
      };
    }

    // 1. Selector & Class Name Generation
    let rawName = Array.isArray(styleDef.selectors) ? styleDef.selectors[0] : styleDef.selectors;
    if (!rawName || rawName === '&') {
      rawName = componentId;
    }

    let cleanName = rawName.replace(/^\./, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    if (!cleanName || cleanName.length > 50) {
      cleanName = 'component';
    }

    const componentHash = crypto.createHash('md5')
      .update(cleanName + componentId)
      .digest('hex')
      .slice(0, 6);
    
    const componentClassName = `c-${cleanName}-${componentHash}`;
    const selector = `.${componentClassName}`;

    if (this.options.verbose) {
      console.log(`[AtomicOptimizer] Optimizing component: ${componentId} -> ${componentClassName}`);
    }

    let classList: string[] = [componentClassName];
    let localRules = "";
    let pseudoRules = "";

    // 2. Process each style property
    for (const [prop, value] of Object.entries(styleDef)) {
      // Skip metadata
      if (prop === 'selectors' || prop === 'path' || prop.startsWith('_')) continue;
      
      // Handle Pseudo-classes (hover, focus, active, etc.)
      if (typeof value === 'object' && value !== null) {
        if (['hover', 'focus', 'active', 'visited', 'disabled', 'checked'].includes(prop)) {
          pseudoRules += this.generatePseudoCSS(prop, value as Record<string, any>, selector);
        }
        continue;
      }
      
      if (value === null || value === undefined) continue;
      
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      const stringValue = String(value);

      // 3. ATOMIC CHECK
      if (this.shouldBeAtomic(prop, stringValue)) {
        // Get or Create the global rule
        const atomicClass = this.getOrCreateAtomic(prop, stringValue);
        classList.push(atomicClass);
        atomicClasses.push(atomicClass);

        // POPULATE THE MAP: Fixes the empty atomicMap issue
        this.atomicMap[`${prop}:${stringValue}`] = atomicClass;
        
        // Update stats
        this.stats.atomicStyles++;
        
        if (this.options.verbose) {
          console.log(`  [Atomic] ${kebabProp}: ${stringValue} -> .${atomicClass}`);
        }
      } else {
        // It stays local to the component
        localRules += `  ${kebabProp}: ${stringValue};\n`;
        this.stats.standardStyles++;
        
        if (this.options.verbose) {
          console.log(`  [Standard] ${kebabProp}: ${stringValue}`);
        }
      }
    }

    // Store component mapping
    this.componentMap.set(componentId, {
      atomicClasses: atomicClasses,
      hoverAtomicClasses: [], // Will be populated if hover styles exist
      selectors: [selector],
      componentClassName: componentClassName
    });

    this.componentClassMap.set(componentId, {
      atomicClasses: atomicClasses,
      hoverAtomicClasses: [],
      selectors: [selector]
    });

    // 4. Build final CSS Output
    let componentCSS = '';
    if (localRules) {
      componentCSS = `${selector} {\n${localRules}}\n`;
    }
    
    if (pseudoRules) {
      componentCSS += pseudoRules;
    }

    const finalClassName = classList.join(' ');
    
    // Save cache for future builds
    this.saveCache();
    
    // 5. Return the full result for the compiler to write to disk
    return {
      css: componentCSS,
      map: { 
        [componentId]: finalClassName 
      },
      stats: this.getStats(),
      atomicCSS: this.generateAtomicCSS(),
      componentCSS: componentCSS,
      componentMap: this.componentMap
    };
  }

  // Helper to process pseudo-states
  private processPseudoState(
    state: string,
    styles: Record<string, any>,
    selector: string
  ): string {
    let css = '';
    const pseudoSelector = `${selector}:${state}`;
    let rules = '';

    for (const [prop, value] of Object.entries(styles)) {
      if (prop === 'selectors' || prop.startsWith('_')) continue;
      const kebabProp = kebab(prop);
      rules += `  ${kebabProp}: ${value};\n`;
    }

    if (rules) {
      css = `${pseudoSelector} {\n${rules}}\n`;
    }

    return css;
  }
  
  public reset(): void {
    this.usageCount.clear();
    this.atomicClasses.clear();
    this.componentClassMap.clear();
    this.componentMap.clear();
    this.atomicMap = {};
    this.stats = {
      totalStyles: 0,
      atomicStyles: 0,
      standardStyles: 0,
      uniqueProperties: 0,
      savings: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    if (this.options.verbose) {
      console.log('AtomicOptimizer reset');
    }
  }

  getStats(): AtomicOptimizerStats {
    const total = this.stats.totalStyles;
    const generatedRules = this.stats.uniqueProperties + this.stats.standardStyles;
    
    // Calculate real savings
    let savingsValue = 0;
    if (total > 0) {
      savingsValue = ((total - generatedRules) / total) * 100;
    }
    
    const totalCacheRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (this.stats.cacheHits / totalCacheRequests) : 0;

    return {
      totalStyles: total,
      atomicStyles: this.atomicClasses.size,
      standardStyles: this.stats.standardStyles,
      uniqueProperties: this.stats.uniqueProperties,
      savings: `${savingsValue.toFixed(1)}%`,
      cacheHitRate: cacheHitRate
    };
  }
  
  getAtomicClass(prop: string, value: string, context: string = ''): string | null {
    const key = context ? `${context}|${prop}:${value}` : `${prop}:${value}`;
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
    this.atomicMap = {};
    if (this.options.cache && fs.existsSync(this.options.cachePath)) {
      fs.unlinkSync(this.options.cachePath);
      if (this.options.verbose) {
        console.log('Cache cleared');
      }
    }
  }

  public getComponentMapEntry(name: string): ComponentClassMapEntry | undefined {
    return this.componentClassMap.get(name);
  }
  
  public getAtomicMap(): Record<string, string> {
    return this.atomicMap;
  }
}

export { AtomicOptimizer as default };