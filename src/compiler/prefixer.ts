// chaincss/src/compiler/prefixer.ts
// Dynamic imports for optional dependencies
import type { ProcessOptions, Result } from 'postcss';

// Safe import helper — returns null if module not available
// This prevents Vite from crashing on optional dependencies
async function safeImport(moduleName: string): Promise<any> {
  try {
    // Use Function constructor to hide from Vite's static analyzer
    const importFn = new Function('path', 'return import(path)');
    return await importFn(moduleName);
  } catch {
    return null;
  }
}


// Types for optional dependencies
type PostCSS = any;
type Browserslist = any;
type CaniuseData = any;
type Autoprefixer = any;

// Declare variables for optional dependencies (initially null)
let postcss: PostCSS | null = null;

// Helper to load optional deps without Vite static analysis
function __import__(name: string): Promise<any> {
  return new Function("name", "return import(name)")(name);
}

let browserslist: Browserslist | null = null;
let caniuse: any = null;
let autoprefixer: Autoprefixer | null = null;

// Lazy loading flags
let postcssLoaded = false;
let browserslistLoaded = false;
let caniuseLoaded = false;
let autoprefixerLoaded = false;
let loadingPromises: Map<string, Promise<any>> = new Map();

// Lazy load functions with better error handling
async function loadPostcss() {
  if (postcss) return postcss;
  if (loadingPromises.has('postcss')) return loadingPromises.get('postcss');
  
  const promise = (async () => {
    if (!postcssLoaded) {
      try {
        const module = await import('postcss');
        postcss = module.default || module;
      } catch (err) {
        if (process.env.DEBUG) {
          console.warn('postcss not installed, using lightweight prefixing');
        }
      }
      postcssLoaded = true;
    }
    return postcss;
  })();
  
  loadingPromises.set('postcss', promise);
  return promise;
}

async function loadBrowserslist() {
  if (browserslist) return browserslist;
  if (loadingPromises.has('browserslist')) return loadingPromises.get('browserslist');
  
  const promise = (async () => {
    if (!browserslistLoaded) {
      try {
        const module = __import__('browserslist');
        browserslist = (module as any).default || module;
      } catch (err) {
        browserslist = null;
      }
      browserslistLoaded = true;
    }
    return browserslist;
  })();
  
  loadingPromises.set('browserslist', promise);
  return promise;
}

async function loadCaniuse() {
  if (caniuse) return caniuse;
  if (loadingPromises.has('caniuse')) return loadingPromises.get('caniuse');
  
  const promise = (async () => {
    if (!caniuseLoaded) {
      try {
        // @ts-ignore
        const caniuseModule = await safeImport("caniuse-db/fulldata-json/data-2.0.json");
        caniuse = caniuseModule.default || caniuseModule;
      } catch (err) {
        caniuse = null;
      }
      caniuseLoaded = true;
    }
    return caniuse;
  })();
  
  loadingPromises.set('caniuse', promise);
  return promise;
}

async function loadAutoprefixer() {
  if (autoprefixer) return autoprefixer;
  if (loadingPromises.has('autoprefixer')) return loadingPromises.get('autoprefixer');
  
  const promise = (async () => {
    if (!autoprefixerLoaded) {
      try {
        // @ts-ignore - autoprefixer is optional
        const module = __import__('autoprefixer');
        autoprefixer = (module as any).default || module;
      } catch (err) {
        if (process.env.DEBUG) {
          console.warn('autoprefixer not installed');
        }
      }
      autoprefixerLoaded = true;
    }
    return autoprefixer;
  })();
  
  loadingPromises.set('autoprefixer', promise);
  return promise;
}

// Types
export interface PrefixerConfig {
  browsers?: string[];
  enabled?: boolean;
  mode?: 'auto' | 'full' | 'lightweight';
  sourceMap?: boolean;
  sourceMapInline?: boolean;
  remove?: boolean; // Remove outdated prefixes
  add?: boolean; // Add missing prefixes
  verbose?: boolean;
  flexbox?: boolean | 'no-2009'; // Flexbox support
  grid?: boolean | 'autoplace' | 'no-autoplace'; // Grid support
}

export interface PrefixerResult {
  css: string;
  map: string | null;
  warnings?: string[];
}

export interface ProcessOptionsWithPaths {
  from?: string;
  to?: string;
  map?: boolean | object;
}

export interface CaniuseFeature {
  title: string;
  description: string;
  stats: Record<string, Record<string, string>>;
  spec?: string;
  status?: string;
}

// Built-in prefix map for lightweight mode
const LIGHTWEIGHT_PREFIX_MAP: Record<string, Record<string, string[]>> = {
  // Transform properties
  'transform': {
    'webkit': ['-webkit-transform'],
    'ms': ['-ms-transform']
  },
  'transform-origin': {
    'webkit': ['-webkit-transform-origin'],
    'ms': ['-ms-transform-origin']
  },
  'transform-style': {
    'webkit': ['-webkit-transform-style']
  },
  'perspective': {
    'webkit': ['-webkit-perspective']
  },
  'backface-visibility': {
    'webkit': ['-webkit-backface-visibility']
  },
  
  // Transitions & Animations
  'transition': {
    'webkit': ['-webkit-transition']
  },
  'transition-property': {
    'webkit': ['-webkit-transition-property']
  },
  'transition-duration': {
    'webkit': ['-webkit-transition-duration']
  },
  'transition-timing-function': {
    'webkit': ['-webkit-transition-timing-function']
  },
  'animation': {
    'webkit': ['-webkit-animation']
  },
  'animation-name': {
    'webkit': ['-webkit-animation-name']
  },
  'animation-duration': {
    'webkit': ['-webkit-animation-duration']
  },
  'animation-timing-function': {
    'webkit': ['-webkit-animation-timing-function']
  },
  'animation-delay': {
    'webkit': ['-webkit-animation-delay']
  },
  'animation-iteration-count': {
    'webkit': ['-webkit-animation-iteration-count']
  },
  'animation-direction': {
    'webkit': ['-webkit-animation-direction']
  },
  'animation-fill-mode': {
    'webkit': ['-webkit-animation-fill-mode']
  },
  
  // Filters
  'filter': {
    'webkit': ['-webkit-filter']
  },
  'backdrop-filter': {
    'webkit': ['-webkit-backdrop-filter']
  },
  
  // Box properties
  'box-shadow': {
    'webkit': ['-webkit-box-shadow']
  },
  'box-sizing': {
    'webkit': ['-webkit-box-sizing'],
    'moz': ['-moz-box-sizing']
  },
  'border-radius': {
    'webkit': ['-webkit-border-radius'],
    'moz': ['-moz-border-radius']
  },
  
  // User interface
  'user-select': {
    'webkit': ['-webkit-user-select'],
    'moz': ['-moz-user-select'],
    'ms': ['-ms-user-select']
  },
  'appearance': {
    'webkit': ['-webkit-appearance'],
    'moz': ['-moz-appearance']
  },
  
  // Text
  'text-fill-color': {
    'webkit': ['-webkit-text-fill-color']
  },
  'text-stroke': {
    'webkit': ['-webkit-text-stroke']
  },
  'text-stroke-color': {
    'webkit': ['-webkit-text-stroke-color']
  },
  'text-stroke-width': {
    'webkit': ['-webkit-text-stroke-width']
  },
  'background-clip': {
    'webkit': ['-webkit-background-clip']
  },
  
  // Masks
  'mask-image': {
    'webkit': ['-webkit-mask-image']
  },
  'mask-clip': {
    'webkit': ['-webkit-mask-clip']
  },
  'mask-composite': {
    'webkit': ['-webkit-mask-composite']
  },
  'mask-origin': {
    'webkit': ['-webkit-mask-origin']
  },
  'mask-position': {
    'webkit': ['-webkit-mask-position']
  },
  'mask-repeat': {
    'webkit': ['-webkit-mask-repeat']
  },
  'mask-size': {
    'webkit': ['-webkit-mask-size']
  }
};

// Special value prefixes for lightweight mode
const LIGHTWEIGHT_VALUE_PREFIXES: Record<string, Record<string, string[]>> = {
  'display': {
    'flex': ['-webkit-flex', '-ms-flexbox'],
    'inline-flex': ['-webkit-inline-flex', '-ms-inline-flexbox'],
    'grid': ['-ms-grid'],
    'inline-grid': ['-ms-inline-grid']
  },
  'position': {
    'sticky': ['-webkit-sticky']
  }
};

// Main class
export class ChainCSSPrefixer {
  config: Required<PrefixerConfig>;
  hasBuiltInDeps: boolean;
  hasAutoprefixer: boolean;
  prefixerMode: 'auto' | 'full' | 'lightweight';
  caniuseData: Record<string, CaniuseFeature> | null;
  commonProperties: string[];
  specialValues: Record<string, string[]>;
  browserPrefixMap: Record<string, string>;
  targetBrowsers: string[] | null;
  private warnings: string[] = [];

  constructor(config: PrefixerConfig = {}) {
    this.config = {
      browsers: config.browsers || ['> 0.5%', 'last 2 versions', 'not dead'],
      enabled: config.enabled !== false,
      mode: config.mode || 'auto',
      sourceMap: config.sourceMap !== false,
      sourceMapInline: config.sourceMapInline || false,
      remove: config.remove !== false,
      add: config.add !== false,
      verbose: config.verbose || false,
      flexbox: config.flexbox !== false,
      grid: config.grid || 'autoplace'
    };
    
    this.hasBuiltInDeps = false;
    this.hasAutoprefixer = false;
    this.prefixerMode = config.mode || 'auto';
    this.caniuseData = null;
    this.commonProperties = this.getCommonProperties();
    this.specialValues = {
      'display': ['flex', 'inline-flex', 'grid', 'inline-grid'],
      'background-clip': ['text'],
      'position': ['sticky']
    };
    this.browserPrefixMap = {
      'chrome': 'webkit', 
      'safari': 'webkit', 
      'firefox': 'moz',
      'ie': 'ms', 
      'edge': 'webkit', 
      'ios_saf': 'webkit',
      'and_chr': 'webkit', 
      'android': 'webkit', 
      'opera': 'webkit',
      'op_mob': 'webkit', 
      'samsung': 'webkit', 
      'and_ff': 'moz'
    };
    this.targetBrowsers = null;
  }

  async determineMode(): Promise<'auto' | 'full' | 'lightweight'> {
    if (this.config.mode === 'full') {
      const hasAutoprefixer = !!(await loadAutoprefixer());
      if (!hasAutoprefixer && this.config.verbose) {
        console.warn('⚠️ Full mode requested but autoprefixer not installed. Falling back to lightweight mode.');
        console.warn('   To use full mode: npm install autoprefixer postcss caniuse-db browserslist\n');
      }
      return hasAutoprefixer ? 'full' : 'lightweight';
    }
    if (this.config.mode === 'lightweight') {
      return 'lightweight';
    }
    if (this.config.mode === 'auto') {
      const hasAutoprefixer = !!(await loadAutoprefixer());
      if (this.config.verbose) {
        console.log(`🔧 Prefixer mode: ${hasAutoprefixer ? 'full' : 'lightweight'}`);
      }
      return hasAutoprefixer ? 'full' : 'lightweight';
    }
    return 'lightweight';
  }

  async process(cssString: string, options: ProcessOptionsWithPaths = {}): Promise<PrefixerResult> {
    this.warnings = [];
    
    if (!this.config.enabled) {
      return { css: cssString, map: null, warnings: [] };
    }
    
    try {
      const mode = await this.determineMode();
      
      if (mode === 'full') {
        return await this.processWithAutoprefixer(cssString, options);
      }
      
      return await this.processWithBuiltIn(cssString, options);
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.warnings.push(`Prefixer error: ${errorMsg}`);
      if (this.config.verbose) {
        console.error('Prefixer error:', errorMsg);
      }
      return { css: cssString, map: null, warnings: this.warnings };
    }
  }

  private async processWithAutoprefixer(
    cssString: string,
    options: ProcessOptionsWithPaths
  ): Promise<PrefixerResult> {
    const autoprefixerModule = await loadAutoprefixer();
    const postcssModule = await loadPostcss();
    
    if (!autoprefixerModule || !postcssModule) {
      this.warnings.push('Autoprefixer or PostCSS not available, falling back to lightweight mode');
      return await this.processWithBuiltIn(cssString, options);
    }
    
    const from = options.from || 'input.css';
    const to = options.to || 'output.css';
    
    try {
      const result = await postcssModule([
        autoprefixerModule({
          overrideBrowserslist: this.config.browsers,
          remove: this.config.remove,
          add: this.config.add,
          flexbox: this.config.flexbox,
          grid: this.config.grid
        })
      ]).process(cssString, {
        from,
        to,
        map: this.config.sourceMap ? {
          inline: this.config.sourceMapInline,
          annotation: false,
          sourcesContent: true
        } : false
      });
      
      if (result.warnings && this.config.verbose) {
        result.warnings().forEach((warning: any) => {
          this.warnings.push(warning.toString());
        });
      }
      
      return {
        css: result.css,
        map: result.map ? result.map.toString() : null,
        warnings: this.warnings
      };
    } catch (err) {
      this.warnings.push(`Autoprefixer processing error: ${(err as Error).message}`);
      return { css: cssString, map: null, warnings: this.warnings };
    }
  }

  private async processWithBuiltIn(
    cssString: string,
    options: ProcessOptionsWithPaths
  ): Promise<PrefixerResult> {
    // Use lightweight prefixing
    const prefixed = this.lightweightPrefix(cssString);
    
    return {
      css: prefixed,
      map: null,
      warnings: this.warnings
    };
  }

  private lightweightPrefix(cssString: string): string {
    let result = cssString;
    
    // Process declarations
    const declRegex = /([\w-]+)\s*:\s*([^;]+);/g;
    let match;
    
    while ((match = declRegex.exec(cssString)) !== null) {
      const [fullMatch, prop, value] = match;
      const trimmedProp = prop.trim();
      const trimmedValue = value.trim();
      
      // Check if property needs prefixing
      const prefixes = LIGHTWEIGHT_PREFIX_MAP[trimmedProp];
      if (prefixes && this.config.add) {
        for (const [prefix, prefixedProps] of Object.entries(prefixes)) {
          for (const prefixedProp of prefixedProps) {
            const prefixedDecl = `${prefixedProp}: ${trimmedValue};`;
            result = result.replace(fullMatch, `${prefixedDecl}\n${fullMatch}`);
          }
        }
      }
      
      // Check if value needs special prefixing
      const valuePrefixes = LIGHTWEIGHT_VALUE_PREFIXES[trimmedProp];
      if (valuePrefixes && valuePrefixes[trimmedValue] && this.config.add) {
        for (const prefixedValue of valuePrefixes[trimmedValue]) {
          const prefixedDecl = `${trimmedProp}: ${prefixedValue};`;
          result = result.replace(fullMatch, `${prefixedDecl}\n${fullMatch}`);
        }
      }
    }
    
    // Handle keyframes with prefixes
    const keyframesRegex = /@keyframes\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = keyframesRegex.exec(cssString)) !== null) {
      const [fullMatch, name, frames] = match;
      const webkitKeyframes = `@-webkit-keyframes ${name} {${frames}}`;
      result = result.replace(fullMatch, `${webkitKeyframes}\n${fullMatch}`);
    }
    
    return result;
  }

  private createBuiltInPlugin(): (root: any) => void {
    return (root: any) => {
      root.walkDecls((decl: any) => {
        this.processBuiltInDeclaration(decl);
      });
    };
  }

  private processBuiltInDeclaration(decl: any): void {
    const { prop, value } = decl;
    
    if (this.commonProperties.includes(prop) && this.config.add) {
      this.addPrefixesFromCaniuse(decl);
    }
    
    if (this.specialValues[prop]?.includes(value) && this.config.add) {
      this.addSpecialValuePrefixes(decl);
    }
    
    if (!this.config.remove) return;
    
    // Remove outdated prefixed versions
    const unprefixedProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
    if (unprefixedProp !== prop && this.commonProperties.includes(unprefixedProp)) {
      // Check if we should keep this prefix
      const shouldKeep = this.shouldKeepPrefix(prop, unprefixedProp);
      if (!shouldKeep) {
        decl.remove();
      }
    }
  }

  private shouldKeepPrefix(prop: string, unprefixed: string): boolean {
    // Check if browser still needs this prefix
    if (!this.targetBrowsers) return true;
    
    const prefix = prop.match(/^-(webkit|moz|ms|o)-/)?.[1];
    if (!prefix) return true;
    
    // For modern browsers, many prefixes are no longer needed
    const modernBrowsers = ['chrome >= 80', 'firefox >= 80', 'safari >= 13', 'edge >= 80'];
    const needsPrefix = this.targetBrowsers.some(browser => {
      return modernBrowsers.includes(browser);
    });
    
    return !needsPrefix;
  }

  private addPrefixesFromCaniuse(decl: any): void {
    if (!this.caniuseData) return;
    
    const feature = this.findFeature(decl.prop);
    if (!feature) return;
    
    const prefixes = new Set<string>();
    
    this.targetBrowsers?.forEach(browser => {
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

  private addSpecialValuePrefixes(decl: any): void {
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

  private findFeature(property: string): CaniuseFeature | null {
    if (!this.caniuseData) return null;
    
    const featureMap: Record<string, string> = {
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
    return featureId ? (this.caniuseData[featureId] as CaniuseFeature) : null;
  }

  private getCommonProperties(): string[] {
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
      'grid', 'grid-template', 'grid-column', 'grid-row', 'gap',
      'column-gap', 'row-gap'
    ];
  }

  // Utility method to check if a browser needs a specific prefix
  needsPrefix(property: string, browser: string, version: number): boolean {
    const feature = this.findFeature(property);
    if (!feature) return false;
    
    const stats = feature.stats[browser];
    if (!stats) return false;
    
    const support = stats[version.toString()];
    return support ? support.includes('x') : false;
  }

  // Get all available prefixes for a property
  getAvailablePrefixes(property: string): string[] {
    const prefixes = LIGHTWEIGHT_PREFIX_MAP[property];
    if (!prefixes) return [];
    
    return Object.keys(prefixes);
  }

  // Reset the prefixer state
  reset(): void {
    this.warnings = [];
    this.targetBrowsers = null;
    this.hasAutoprefixer = false;
    this.hasBuiltInDeps = false;
  }
}

// ESM Export
export { ChainCSSPrefixer as default };