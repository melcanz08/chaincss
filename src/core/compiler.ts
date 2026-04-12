// chaincss/src/core/compiler.ts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  DEFAULT_CONFIG, 
  NEVER_ATOMIC_PROPERTIES,
  ALWAYS_ATOMIC_PROPERTIES,
  ERROR_MESSAGES,
  VERSION
} from './constants.js';
import { hashString, kebabCase, generateClassName, formatCSS, writeFile, getBaseName } from './utils.js';
import type { ChainCSSConfig, CompileResult, StyleDefinition, AtomicClass } from './types.js';

// Import your existing compiler modules
import { $, run, compile as bttCompile, chain, recipe, createTokens, configureAtomic, setAtomicOptimizer, setBreakpoints, setSourceComments } from '../compiler/btt.js';
import { AtomicOptimizer } from '../compiler/atomic-optimizer.js';
import ChainCSSPrefixer from '../compiler/prefixer.js';
import { tokens } from '../compiler/tokens.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type StyleDef = {
  selectors?: string[];
  [key: string]: any;
};

export class ChainCSSCompiler {
  private config: Required<ChainCSSConfig>;
  private atomicOptimizer: AtomicOptimizer | null = null;
  private prefixer: ChainCSSPrefixer | null = null;
  private styleCache = new Map<string, CompileResult>();
  private classMap = new Map<string, string>();

  constructor(config: ChainCSSConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      atomic: {
        ...DEFAULT_CONFIG.atomic,
        ...config.atomic,
        neverAtomic: [...NEVER_ATOMIC_PROPERTIES, ...(config.atomic?.neverAtomic || [])],
        alwaysAtomic: [...ALWAYS_ATOMIC_PROPERTIES, ...(config.atomic?.alwaysAtomic || [])]
      }
    } as Required<ChainCSSConfig>;

    // Set source comments from config
    setSourceComments(this.config.sourceComments !== false);

    // Set breakpoints from config
    if (this.config.breakpoints) {
      setBreakpoints(this.config.breakpoints);
    }

    this.initOptimizer();
    this.initPrefixer();
  }

  private initOptimizer(): void {
    if (this.config.atomic.enabled) {
      this.atomicOptimizer = new AtomicOptimizer(this.config.atomic);
      setAtomicOptimizer(this.atomicOptimizer);
    }
  }

  private initPrefixer(): void {
    if (this.config.prefixer.enabled) {
      this.prefixer = new ChainCSSPrefixer(this.config.prefixer);
    }
  }

  private generateCSS(styleId: string, styleDef: StyleDefinition): string {
    chain.cssOutput = '';
    const compiled: Record<string, StyleDefinition> = {};
    compiled[styleId] = styleDef;
    bttCompile(compiled);
    let css = chain.cssOutput;
    
    if (this.atomicOptimizer && this.config.atomic.enabled) {
      const result = this.atomicOptimizer.optimize({ [styleId]: styleDef });
      if (result.css) css = result.css;
    }
    return css;
  }

  compileStyle(styleId: string, styleDef: StyleDefinition): CompileResult {
    const cacheKey = `${styleId}:${JSON.stringify(styleDef)}`;
    if (this.styleCache.has(cacheKey)) {
      return this.styleCache.get(cacheKey)!;
    }

    const className = generateClassName(styleId, this.config.atomic.naming);
    this.classMap.set(styleId, className);
    let css = this.generateCSS(styleId, styleDef);
    css = formatCSS(css, this.config.output.minify);

    const result: CompileResult = {
      css,
      classMap: { [styleId]: className },
      atomicClasses: [],
      stats: { totalStyles: 1, atomicStyles: 0, uniqueProperties: 0, savings: '0%' }
    };

    if (this.atomicOptimizer) {
      const stats = this.atomicOptimizer.getStats();
      result.stats = {
        totalStyles: stats.totalStyles,
        atomicStyles: stats.atomicStyles,
        uniqueProperties: stats.uniqueProperties,
        savings: stats.savings
      };
    }

    this.styleCache.set(cacheKey, result);
    return result;
  }

  compileRecipe(recipeId: string, recipeFn: any): CompileResult {
    let allCSS = '';
    const classMap: Record<string, string> = {};
    const atomicClasses: AtomicClass[] = [];
    const variants = recipeFn.getAllVariants?.() || [];
    
    for (const variant of variants) {
      const variantKey = Object.entries(variant).map(([k, v]) => `${k}-${v}`).join('_');
      const styleId = `${recipeId}_${variantKey}`;
      const styleDef = recipeFn(variant);
      const result = this.compileStyle(styleId, styleDef);
      allCSS += result.css;
      classMap[variantKey] = Object.values(result.classMap)[0];
      atomicClasses.push(...result.atomicClasses);
    }

    if (recipeFn.base) {
      const baseResult = this.compileStyle(`${recipeId}_base`, recipeFn.base);
      allCSS += baseResult.css;
      classMap['base'] = Object.values(baseResult.classMap)[0];
    }

    return {
      css: allCSS,
      classMap,
      atomicClasses,
      stats: {
        totalStyles: variants.length + (recipeFn.base ? 1 : 0),
        atomicStyles: atomicClasses.length,
        uniqueProperties: 0,
        savings: '0%'
      }
    };
  }

  compileFile(filePath: string): Record<string, CompileResult> {
    const results: Record<string, CompileResult> = {};
    const source = fs.readFileSync(filePath, 'utf8');
    const fileDir = path.dirname(filePath);
    
    const moduleExports: Record<string, any> = {};
    const module = { exports: moduleExports };
    
    const evalContext = {
      exports: moduleExports,
      module,
      require: (id: string) => {
        if (id.startsWith('.')) {
          const resolvedPath = path.resolve(fileDir, id);
          return require(resolvedPath);
        }
        return require(id);
      },
      __dirname: fileDir,
      __filename: filePath,
      $,
      recipe,
      createTokens,
      compile: (style: any) => style
    };
    
    const evalFn = new Function(...Object.keys(evalContext), source);
    evalFn(...Object.values(evalContext));
    
    for (const [exportName, exportValue] of Object.entries(moduleExports)) {
      if (typeof exportValue === 'function' && exportValue.variants) {
        results[exportName] = this.compileRecipe(exportName, exportValue);
      } else if (exportValue && typeof exportValue === 'object' && exportValue.selectors) {
        results[exportName] = this.compileStyle(exportName, exportValue);
      }
    }
    return results;
  }

  generateTypeScriptTypes(results: Record<string, CompileResult>, outputPath: string): void {
    let types = `/**
 * ChainCSS Generated Types
 * Do not edit - generated by ChainCSS compiler v${VERSION}
 * @generated
 */

`;
    for (const [name, result] of Object.entries(results)) {
      for (const className of Object.keys(result.classMap)) {
        types += `export declare const ${className}: string;\n`;
      }
    }
    writeFile(outputPath, types);
  }

  generateJavaScriptModule(results: Record<string, CompileResult>, outputPath: string): void {
    let jsCode = `/**
 * ChainCSS Generated Class Map
 * Do not edit - generated by ChainCSS compiler v${VERSION}
 * @generated
 */

`;
    for (const [name, result] of Object.entries(results)) {
      for (const [className, classValue] of Object.entries(result.classMap)) {
        jsCode += `export const ${className} = '${classValue}';\n`;
      }
    }
    jsCode += `\nexport const classMap = {\n`;
    for (const [name, result] of Object.entries(results)) {
      for (const [className, classValue] of Object.entries(result.classMap)) {
        jsCode += `  ${className}: '${classValue}',\n`;
      }
    }
    jsCode += `};\n`;
    writeFile(outputPath, jsCode);
  }

  generateCSSFile(results: Record<string, CompileResult>, outputPath: string): void {
    let allCSS = '';
    for (const result of Object.values(results)) {
      allCSS += result.css + '\n';
    }
    writeFile(outputPath, formatCSS(allCSS, this.config.output.minify));
  }

  async compile(inputFile: string, outputDir: string): Promise<{
    cssFile: string;
    jsFile: string;
    typesFile: string;
    results: Record<string, CompileResult>;
  }> {
    if (this.config.verbose) console.log(`[chaincss] Compiling ${inputFile}...`);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    const results = this.compileFile(inputFile);
    const baseName = getBaseName(inputFile);
    const cssFile = path.join(outputDir, `${baseName}.css`);
    const jsFile = path.join(outputDir, `${baseName}.js`);
    const typesFile = path.join(outputDir, `${baseName}.d.ts`);
    
    this.generateCSSFile(results, cssFile);
    this.generateJavaScriptModule(results, jsFile);
    this.generateTypeScriptTypes(results, typesFile);
    
    return { cssFile, jsFile, typesFile, results };
  }

  // ============================================================================
  // Compile components with output to source directories
  // ============================================================================

  async compileComponents(components: string[]): Promise<void> {
    if (this.config.verbose) {
      console.log(`[chaincss] Compiling ${components.length} component(s)...`);
    }

    const componentExports = new Map<string, string>();
    const componentCSS = new Map<string, string>();
    
    // Collect all CSS for global.css
    let allCSS = '';
    
    // Define the type locally
    type FrameworkType = 'react' | 'vue' | 'svelte' | 'solid' | 'auto';

    // Store component info for framework generation
    const allComponentInfo: Array<{
      name: string;
      selector: string;
      styles: any;
      propsDefinition?: Record<string, any>;
      framework: FrameworkType;
      outputDir: string;
    }> = [];

    for (const file of components) {
      const sourceDir = path.dirname(file);
      const baseName = path.basename(file, '.chain.js');
      const stylesDir = sourceDir;
      
      const classOutputPath = path.join(stylesDir, `${baseName}.class.js`);
      const cssOutputPath = path.join(stylesDir, `${baseName}.css`);
      
      const exports = await this.importModule(file);
      
      let code = '';
      let componentCSSContent = '';
      
      for (const [name, style] of Object.entries(exports)) {
        const styleDef = style as StyleDef;
        if (styleDef) {
          const processedStyle = { ...styleDef };
          let className: string;
          
          if (styleDef.selectors && styleDef.selectors.length > 0) {
            const selector = styleDef.selectors[0];
            className = selector.startsWith('.') ? selector.slice(1) : selector;
            processedStyle.selectors = [selector];
          } else {
            className = `c_${this.hash(name)}`;
            processedStyle.selectors = [`.${className}`];
          }
          
          code += `export const ${name} = '${className}';\n`;
          
          // Generate CSS for this style
          chain.cssOutput = '';
          const compiledObj: Record<string, StyleDef> = {};
          compiledObj[`${baseName}_${name}`] = processedStyle;
          bttCompile(compiledObj as any);
          componentCSSContent += chain.cssOutput + '\n';
          
          // Check if this style should generate a framework component
          if (styleDef._generateComponent) {
            const componentName = styleDef._componentName || name;
            const selector = styleDef.selectors?.[0] || `.${componentName.toLowerCase()}`;
            
            allComponentInfo.push({
              name: componentName,
              selector: selector,
              styles: styleDef,
              propsDefinition: styleDef._propsDefinition,
              framework: (styleDef._framework || 'auto') as FrameworkType,
              outputDir: stylesDir
            });
          }
        }
      }
      
      if (code && componentCSSContent) {
        // Ensure styles directory exists
        if (!fs.existsSync(stylesDir)) {
          fs.mkdirSync(stylesDir, { recursive: true });
        }
        
        // Write class file
        fs.writeFileSync(classOutputPath, code);
        componentExports.set(classOutputPath, code);
        
        // Write individual component CSS - ALWAYS unminified for debugging
        const unminifiedCSS = formatCSS(componentCSSContent, false);
        fs.writeFileSync(cssOutputPath, unminifiedCSS);
        componentCSS.set(cssOutputPath, componentCSSContent);
        
        // Collect for combined global.css
        allCSS += componentCSSContent + '\n';
        
        if (this.config.verbose) {
          console.log(`  ✓ Generated: ${classOutputPath}`);
          console.log(`  ✓ Generated: ${cssOutputPath}`);
        }
      }
    }
    
    // ============================================================================
    // Generate Framework Components (React, Vue, Svelte, Solid)
    // ============================================================================
    
    if (allComponentInfo.length > 0) {
      // Dynamically import the component generator
      const { generateComponentCode } = await import('../compiler/btt.js');
      
      for (const componentInfo of allComponentInfo) {
        try {
          const componentCode = generateComponentCode({
            name: componentInfo.name,
            selector: componentInfo.selector,
            styles: componentInfo.styles,
            propsDefinition: componentInfo.propsDefinition,
            framework: componentInfo.framework
          });
          
          // Determine file extension based on framework
          let ext = '.tsx';
          if (componentInfo.framework === 'vue') ext = '.vue';
          if (componentInfo.framework === 'svelte') ext = '.svelte';
          
          const componentPath = path.join(componentInfo.outputDir, `${componentInfo.name}${ext}`);
          fs.writeFileSync(componentPath, componentCode);
          
          if (this.config.verbose) {
            console.log(`  ✓ Generated component: ${componentPath}`);
          }
        } catch (error) {
          console.warn(`  ⚠ Failed to generate component for ${componentInfo.name}:`, error);
        }
      }
      
      console.log(`✓ Generated ${allComponentInfo.length} framework component(s)`);
    }
    
    // ============================================================================
    // Generate Combined global.css
    // ============================================================================
    
    const globalStylesDir = path.join(process.cwd(), 'src/global-style');
    if (!fs.existsSync(globalStylesDir)) {
      fs.mkdirSync(globalStylesDir, { recursive: true });
    }
    
    const globalStylesPath = path.join(globalStylesDir, 'global.css');
    // Force minify = true for global.css
    fs.writeFileSync(globalStylesPath, formatCSS(allCSS, true));
    
    console.log(`✓ Generated ${componentCSS.size} component CSS file(s)`);
    console.log(`✓ Generated global.css (minified)`);
    console.log(`✓ Generated ${componentExports.size} component class file(s)`);
  }

  private async importModule(filePath: string): Promise<Record<string, any>> {
    const absolutePath = path.resolve(filePath);
    try {
      // For .chain.js files, use dynamic import
      const fileUrl = `file://${absolutePath}`;
      
      // Clear the import cache by appending a timestamp
      const freshUrl = `${fileUrl}?t=${Date.now()}`;
      
      const imported = await import(freshUrl);
      return imported;
    } catch (error) {
      console.error(`Failed to import ${filePath}:`, error);
      return {};
    }
  }

  private hash(str: string): string {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36).slice(0, 6);
  }

  async watch(inputFile: string, outputDir: string): Promise<void> {
    const chokidar = await import('chokidar');
    console.log(`[chaincss] Watching ${inputFile} for changes...`);
    await this.compile(inputFile, outputDir);
    const watcher = chokidar.watch(inputFile);
    watcher.on('change', async () => {
      console.log(`[chaincss] File changed: ${inputFile}`);
      try {
        await this.compile(inputFile, outputDir);
        console.log(`[chaincss] Recompiled successfully`);
      } catch (error) {
        console.error(`[chaincss] Recompilation failed:`, error);
      }
    });
  }

  getStats(): any {
    if (this.atomicOptimizer) return this.atomicOptimizer.getStats();
    return { totalStyles: this.styleCache.size, atomicStyles: 0, uniqueProperties: 0, savings: '0%' };
  }

  clearCache(): void {
    this.styleCache.clear();
    this.classMap.clear();
    if (this.atomicOptimizer) this.atomicOptimizer.clearCache();
  }
}

export async function compileChainCSS(
  inputFile: string,
  outputDir: string,
  config?: ChainCSSConfig
): Promise<ReturnType<ChainCSSCompiler['compile']>> {
  const compiler = new ChainCSSCompiler(config);
  return compiler.compile(inputFile, outputDir);
}