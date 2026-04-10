// chaincss/src/compiler/prefixer.ts

// Dynamic imports for optional dependencies
import type { ProcessOptions, Result } from 'postcss';

// Types for optional dependencies
type PostCSS = any;
type Browserslist = any;
type CaniuseData = any;
type Autoprefixer = any;

// Declare variables for optional dependencies (initially null)
let postcss: PostCSS | null = null;
let browserslist: Browserslist | null = null;
let caniuse: any = null;
let autoprefixer: Autoprefixer | null = null;

// Lazy loading flags
let postcssLoaded = false;
let browserslistLoaded = false;
let caniuseLoaded = false;
let autoprefixerLoaded = false;

// Lazy load functions
async function loadPostcss() {
  if (!postcssLoaded) {
    try {
      postcss = await import('postcss').then(m => m.default);
    } catch (err) {
      // postcss not installed - will use lightweight mode
    }
    postcssLoaded = true;
  }
  return postcss;
}

async function loadBrowserslist() {
  if (!browserslistLoaded) {
    try {
      browserslist = await import('browserslist').then(m => m.default);
    } catch (err) {
      // browserslist not installed
    }
    browserslistLoaded = true;
  }
  return browserslist;
}

async function loadCaniuse() {
  if (!caniuseLoaded) {
    try {
      // @ts-ignore
      const caniuseModule = await import('caniuse-db/fulldata-json/data-2.0.json');
      caniuse = caniuseModule.default || caniuseModule;
    } catch (err) {
      console.warn('caniuse-db not installed, lightweight prefixing will be limited');
    }
    caniuseLoaded = true;
  }
  return caniuse;
}

async function loadAutoprefixer() {
  if (!autoprefixerLoaded) {
    try {
      autoprefixer = await import('autoprefixer').then(m => m.default);
    } catch (err) {
      // autoprefixer not installed
    }
    autoprefixerLoaded = true;
  }
  return autoprefixer;
}

// Types
export interface PrefixerConfig {
  browsers?: string[];
  enabled?: boolean;
  mode?: 'auto' | 'full' | 'lightweight';
  sourceMap?: boolean;
  sourceMapInline?: boolean;
}

export interface PrefixerResult {
  css: string;
  map: string | null;
}

export interface ProcessOptionsWithPaths {
  from?: string;
  to?: string;
}

export interface CaniuseFeature {
  stats: Record<string, Record<string, string>>;
}

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

  constructor(config: PrefixerConfig = {}) {
    this.config = {
      browsers: config.browsers || ['> 0.5%', 'last 2 versions', 'not dead'],
      enabled: config.enabled !== false,
      mode: config.mode || 'auto',
      sourceMap: config.sourceMap !== false,
      sourceMapInline: config.sourceMapInline || false,
    };
    
    this.hasBuiltInDeps = false; // Will be determined lazily
    this.hasAutoprefixer = false; // Will be determined lazily
    this.prefixerMode = config.mode || 'auto';
    this.caniuseData = null;
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

  async determineMode(): Promise<'auto' | 'full' | 'lightweight'> {
    if (this.config.mode === 'full') {
      const hasAutoprefixer = !!(await loadAutoprefixer());
      if (!hasAutoprefixer) {
        console.warn('Full mode requested but autoprefixer not installed. Falling back to lightweight mode.');
        console.warn('   To use full mode: npm install autoprefixer postcss caniuse-db browserslist\n');
        return 'lightweight';
      }
      return 'full';
    }
    if (this.config.mode === 'lightweight') {
      return 'lightweight';
    }
    if (this.config.mode === 'auto') {
      const hasAutoprefixer = !!(await loadAutoprefixer());
      return hasAutoprefixer ? 'full' : 'lightweight';
    }
    return 'lightweight';
  }

  async process(cssString: string, options: ProcessOptionsWithPaths = {}): Promise<PrefixerResult> {
    if (!this.config.enabled) {
      return { css: cssString, map: null };
    }
    
    try {
      const mapOptions = {
        inline: this.config.sourceMapInline,
        annotation: false,
        sourcesContent: true
      };
      
      const mode = await this.determineMode();
      
      if (mode === 'full') {
        return await this.processWithAutoprefixer(cssString, options, mapOptions);
      }
      
      return await this.processWithBuiltIn(cssString, options, mapOptions);
    } catch (err) {
      console.error('Prefixer error:', (err as Error).message);
      return { css: cssString, map: null };
    }
  }

  private async processWithAutoprefixer(
    cssString: string,
    options: ProcessOptionsWithPaths,
    mapOptions: any
  ): Promise<PrefixerResult> {
    const autoprefixerModule = await loadAutoprefixer();
    const postcssModule = await loadPostcss();
    
    if (!autoprefixerModule || !postcssModule) {
      console.warn('Autoprefixer or PostCSS not available, falling back to lightweight mode');
      return await this.processWithBuiltIn(cssString, options, mapOptions);
    }
    
    const from = options.from || 'input.css';
    const to = options.to || 'output.css';
    
    const result = await postcssModule([
      autoprefixerModule({ overrideBrowserslist: this.config.browsers })
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

  private async processWithBuiltIn(
    cssString: string,
    options: ProcessOptionsWithPaths,
    mapOptions: any
  ): Promise<PrefixerResult> {
    const postcssModule = await loadPostcss();
    const browserslistModule = await loadBrowserslist();
    const caniuseData = await loadCaniuse();
    
    if (!postcssModule || !browserslistModule || !caniuseData) {
      return { css: cssString, map: null };
    }
    
    this.targetBrowsers = browserslistModule(this.config.browsers);
    this.caniuseData = caniuseData.data || caniuseData;
    this.hasBuiltInDeps = true;
    
    const from = options.from || 'input.css';
    const to = options.to || 'output.css';
    
    const result = await postcssModule([
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

  private createBuiltInPlugin(): (root: any) => void {
    return (root: any) => {
      root.walkDecls((decl: any) => {
        this.processBuiltInDeclaration(decl);
      });
    };
  }

  private processBuiltInDeclaration(decl: any): void {
    const { prop, value } = decl;
    
    if (this.commonProperties.includes(prop)) {
      this.addPrefixesFromCaniuse(decl);
    }
    
    if (this.specialValues[prop]?.includes(value)) {
      this.addSpecialValuePrefixes(decl);
    }
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
      'grid', 'grid-template', 'grid-column', 'grid-row'
    ];
  }
}

// ESM Export
export { ChainCSSPrefixer as default };