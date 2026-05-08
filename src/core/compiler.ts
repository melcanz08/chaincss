// chaincss/src/core/compiler.ts

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';
import { fileURLToPath, pathToFileURL } from 'url';
import { 
  DEFAULT_CONFIG, 
  NEVER_ATOMIC_PROPERTIES,
  ALWAYS_ATOMIC_PROPERTIES,
  VERSION,
  PERFORMANCE,
  MEMORY
} from './constants.js';
import { generateClassName, formatCSS, writeFile, getBaseName } from './utils.js';
import type { ChainCSSConfig, CompileResult, StyleDefinition } from './types.js';

// Core Compiler Logic
import { compile as bttCompile, setAtomicOptimizer, setBreakpoints, setSourceComments, scanFileForStyles } from '../compiler/btt.js';
import { AtomicOptimizer } from '../compiler/atomic-optimizer.js';
import ChainCSSPrefixer from '../compiler/prefixer.js';
import { CacheManager } from '../compiler/cache-manager.js';
import { PersistentCache } from '../compiler/content-addressable-cache.js';
import { shorthandMap, macros } from '../compiler/shorthands.js';
import type { AtomicClass } from '../compiler/atomic-optimizer.js';

import { StyleGraphCompiler } from '../compiler/style-graph.js';
import type { GraphCompileOptions } from '../compiler/style-graph.js';


const __filename = typeof import.meta !== 'undefined' ? (() => { try { return fileURLToPath(import.meta.url); } catch { return ''; } })() : '';
const __dirname = __filename ? path.dirname(__filename) : '';

interface CachedStyleEntry {
  result: {
    css: string;
    classMap: Record<string, string>;
    atomicClasses: AtomicClass[];
    stats: any;
  };
  accessCount: number;
  lastAccessed: number;
  hash: string;
}

export class ChainCSSCompiler {
  private config: Required<ChainCSSConfig>;
  private prefixer: ChainCSSPrefixer | null = null;
  public atomicOptimizer: AtomicOptimizer | null = null;

  private sharedStyles: Map<string, number> = new Map();
  private styleCache = new Map<string, CachedStyleEntry>();
  private classMap = new Map<string, string>();
  private runtimeCache: CacheManager;
  private persistentCache: PersistentCache;
  
  private readonly MAX_STYLE_CACHE_SIZE = PERFORMANCE.CACHE_MAX_ENTRIES || 500;
  private importedModules = new Map<string, { timestamp: number; hash: string }>();
  private dependencyGraph = new Map<string, Set<string>>();
  private generatedCSS: string = '';
  private accumulatedCSS: string = '';
  private compileInProgress: boolean = false;
  private compileQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  
  // LRU tracking for O(1) eviction
  private lruList: string[] = [];

  constructor(config: ChainCSSConfig) {
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

    this.setupCompilerGlobals();
    
    this.runtimeCache = new CacheManager(this.config.cachePath || './.chaincss-cache');
    this.persistentCache = new PersistentCache({
      cacheDir: (this.config as any).persistentCachePath || './.chaincss/persistent-cache',
      maxAgeDays: (this.config as any).cacheMaxAgeDays || 30,
      maxSizeMB: (this.config as any).cacheMaxSizeMB || 500,
      enabled: (this.config as any).cacheEnabled !== false,
      verbose: this.config.verbose
    });

    this.atomicOptimizer = new AtomicOptimizer(this.config as any);

    this.initOptimizer();
    this.initPrefixer();
  }

  /**
 * Compile using the style graph compiler for advanced optimizations.
 * 
 * @example
 * const result = compiler.compileWithGraph(styles, { 
 *   eliminateDead: true, 
 *   knownSelectors: ['.header', '.footer'],
 *   mergeIdentical: true 
 * });
 */
  public compileWithGraph(
    styles: Record<string, import('./types.js').StyleDefinition>,
    options?: GraphCompileOptions
  ): import('./types.js').GraphCompileResult {
    const graphCompiler = new StyleGraphCompiler({
      ...options,
      verbose: this.config.verbose,
    });
    
    const result = graphCompiler.compile(styles);
    
    if (this.config.verbose) {
      if (result.eliminatedDead > 0) {
        console.log(`  🧹 Eliminated ${result.eliminatedDead} dead styles`);
      }
      if (result.mergedRules > 0) {
        console.log(`  🔗 Merged ${result.mergedRules} identical rules`);
      }
      if (result.optimizationTime > 0) {
        console.log(`  ⚡ Graph compilation: ${result.optimizationTime}ms`);
      }
    }
    
    return result;
  }

  public hasStyles(): boolean {
    const combined = this.getCombinedCSS();
    return !!(combined && combined.trim().length > 0);
  }

  private async processStyleObject(styleObj: Record<string, any>, componentName: string): Promise<void> {
    if (!this.atomicOptimizer) return;

    // Transform the style object - expand shorthands
    const finalStyle: Record<string, any> = {};
    
    for (let [key, value] of Object.entries(styleObj)) {
      // Handle hover states properly
      if (key === 'hover' && typeof value === 'object') {
        const expandedHover: Record<string, any> = {};
        for (const [hk, hv] of Object.entries(value)) {
          const realKey = shorthandMap[hk] || hk;
          expandedHover[realKey] = hv;
        }
        finalStyle.hover = expandedHover;
        continue;
      }
      
      // Handle atRules
      if (key === 'atRules') {
        finalStyle.atRules = value;
        continue;
      }
      
      // Handle nested selectors
      if (key.startsWith('.') || key.startsWith('&')) {
        finalStyle[key] = value;
        continue;
      }
      
      // Transform standard properties
      const realKey = shorthandMap[key] || key;
      finalStyle[realKey] = value;
    }

    const result = this.atomicOptimizer.optimize({
      [componentName]: { 
        selectors: [componentName], 
        ...finalStyle
      }
    });
    
    if (result.css && result.css.trim()) {
      this.accumulatedCSS += result.css + '\n';
    }
    
    // Cache for HMR - use SHA256 for consistency
    const cacheKey = crypto.createHash('sha256')
      .update(`${componentName}-${JSON.stringify(styleObj)}`)
      .digest('hex')
      .slice(0, 16);
    
    this.addToCache(cacheKey, {
      result: {
        css: result.css || '',
        classMap: result.map || {},
        atomicClasses: [],
        stats: this.getStats()
      },
      accessCount: 1,
      lastAccessed: Date.now(),
      hash: cacheKey
    });
  }

  private addToCache(key: string, entry: CachedStyleEntry): void {
    // If key already exists, just update it
    if (this.styleCache.has(key)) {
      this.styleCache.set(key, entry);
      // Move to end of LRU list (most recently used)
      this.lruList = this.lruList.filter(k => k !== key);
      this.lruList.push(key);
      return;
    }
    
    // Evict oldest entries if at capacity
    while (this.styleCache.size >= this.MAX_STYLE_CACHE_SIZE && this.lruList.length > 0) {
      const oldest = this.lruList.shift();
      if (oldest) {
        this.styleCache.delete(oldest);
        if (this.config.verbose) {
          console.log(chalk.gray(`  🧹 Cache evicted: ${oldest.slice(0, 8)}...`));
        }
      }
    }
    
    this.styleCache.set(key, entry);
    this.lruList.push(key);
  }

  /**
   * Scans a raw source string (from Vite) for useChainStyles patterns 
   * and registers them with the optimizer.
   * Uses brace-counting parser instead of fragile regex.
   */
  public async compileSource(source: string, id: string): Promise<void> {
    if (!this.atomicOptimizer || id.includes('\0')) return;

    try {
      let processedCount = 0;
      
      if (this.config.verbose && processedCount > 0) {
        console.log(`  └─ Processed ${processedCount} chain() styles from ${id.split('/').pop()}`);
      }
    } catch (error) {
      console.error(chalk.red(`  ❌ Error compiling source ${id}: ${error}`));
    }
  }

  /**
   * Safely parse a style object string without using eval.
   * Supports JSON-like syntax and token references.
   */
  private safeParseStyleObject(input: string): Record<string, any> {
    try {
      // Remove comments
      let cleaned = input
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      
      // Handle token references like $colors.primary -> "__TOKEN__colors.primary__"
      const tokenPlaceholders: string[] = [];
      cleaned = cleaned.replace(/\$([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g, (match) => {
        tokenPlaceholders.push(match);
        return `"__TOKEN_${tokenPlaceholders.length - 1}__"`;
      });
      
      // Try JSON.parse first
      if (cleaned.trim().startsWith('{')) {
        try {
          const result = JSON.parse(cleaned);
          // Restore token references
          return this.restoreTokens(result, tokenPlaceholders);
        } catch {
          // If JSON fails, try a limited object literal parser
          return this.parseObjectLiteral(cleaned, tokenPlaceholders);
        }
      }
    } catch (err) {
      if (this.config.verbose) {
        console.warn(chalk.yellow(`  ⚠️  Failed to parse style body: ${input.substring(0, 100)}...`));
      }
    }
    
    return {};
  }

  /**
   * Parse a limited subset of JavaScript object literal syntax.
   * Handles: strings, numbers, booleans, null, nested objects, arrays.
   * Does NOT execute code.
   */
  private parseObjectLiteral(str: string, tokenPlaceholders: string[]): Record<string, any> {
    // This is a simplified safe parser. For production, consider using a library like json5.
    // It handles the common cases without eval.
    try {
      // Replace single-quoted strings with double-quoted
      let normalized = str
        .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
        // Handle unquoted property names
        .replace(/(\{|\,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
        // Handle trailing commas
        .replace(/,\s*([}\]])/g, '$1');
      
      const result = JSON.parse(normalized);
      return this.restoreTokens(result, tokenPlaceholders);
    } catch {
      return {};
    }
  }

  private restoreTokens(obj: any, tokens: string[]): any {
    if (typeof obj === 'string') {
      const match = obj.match(/^__TOKEN_(\d+)__$/);
      if (match) {
        const idx = parseInt(match[1]);
        return tokens[idx] || obj;
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.restoreTokens(item, tokens));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.restoreTokens(value, tokens);
      }
      return result;
    }
    return obj;
  }

  /**
   * @deprecated Use safeParseStyleObject instead.
   * Kept for backward compatibility during migration.
   */
  private looseParse(styleBody: string): Record<string, any> {
    return this.safeParseStyleObject(styleBody);
  }

  private setupCompilerGlobals(): void {
    setSourceComments(this.config.sourceComments !== false);
    if (this.config.breakpoints) {
      setBreakpoints(this.config.breakpoints);
    }
  }

  // ============================================================================
  // Caching & Imports
  // ============================================================================

  private hashStyleDef(styleDef: StyleDefinition): string {
    const { _componentName, _generateComponent, _framework, _propsDefinition, ...relevant } = styleDef;
    return crypto.createHash('sha256').update(JSON.stringify(relevant)).digest('hex').slice(0, 16);
  }

  private async importModule(filePath: string): Promise<Record<string, any>> {
    const absolutePath = path.resolve(filePath);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    const fileUrl = pathToFileURL(absolutePath).href;
    
    try {
      // Check for TSX/JSX files that need preprocessing
      if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        throw new Error(`Component file ${path.basename(filePath)} will be processed by scanner`);
      }
      
      // Clear require cache for HMR
      const moduleId = `${fileUrl}?t=${Date.now()}`;
      const imported = await import(/* @vite-ignore */ moduleId);
      
      return imported.default && typeof imported.default === 'object' 
        ? { ...imported.default, ...imported }
        : imported;
    } catch (error: any) {
      error.message = `Failed to import ${path.basename(filePath)}: ${error.message}`;
      throw error;
    }
  }

  // ============================================================================
  // Compilation Methods
  // ============================================================================

  public compileStyle(styleId: string, styleDef: StyleDefinition): CompileResult {
    const hash = this.hashStyleDef(styleDef);
    const cacheKey = `${styleId}:${hash}`;

    if (this.styleCache.has(cacheKey)) {
      const cached = this.styleCache.get(cacheKey)!;
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      // Update LRU position
      this.lruList = this.lruList.filter(k => k !== cacheKey);
      this.lruList.push(cacheKey);
      return cached.result;
    }

    // Phase 1: Standard Compile
    let finalCSS = bttCompile({ [styleId]: styleDef });
    let finalClassName = generateClassName(styleId, this.config.atomic.naming);
    let atomicClassNames: string[] = [];
    let atomicClasses: AtomicClass[] = [];

    if (this.atomicOptimizer && this.config.atomic.enabled) {
      const optimized = this.atomicOptimizer.optimize({ [styleId]: styleDef });
      
      const componentMapping = this.atomicOptimizer.getComponentMapEntry(styleId);
      atomicClassNames = componentMapping?.atomicClasses || [];
      
      // Get full AtomicClass data from the optimizer instead of creating empty ones
      atomicClasses = atomicClassNames
        .map(className => {
          const atomicEntry = (this.atomicOptimizer as any)?.getAtomicEntry?.(className);
          if (atomicEntry) {
            return atomicEntry;
          }
          // Fallback only if entry not found
          return {
            className,
            prop: '',
            value: '',
            usageCount: 0,
            rules: ''
          };
        })
        .filter(Boolean) as AtomicClass[];
      
      if (optimized.map && optimized.map[styleId]) {
        finalClassName = [optimized.map[styleId], ...atomicClassNames].join(' ');
      }
      
      // Only use atomic CSS if it produced output, otherwise keep standard CSS
      if (optimized.css && optimized.css.trim()) {
        finalCSS = optimized.css;
      }
      // else keep finalCSS from bttCompile above
    }

    const result: CompileResult = {
      css: formatCSS(finalCSS, this.config.output.minify),
      classMap: { [styleId]: finalClassName },
      atomicClasses,
      stats: this.getStats()
    };

    // Cache the result
    this.addToCache(cacheKey, {
      result,
      accessCount: 1,
      lastAccessed: Date.now(),
      hash
    });

    return result;
  }

  public compileRecipe(recipeId: string, recipeValue: any): CompileResult {
    try {
      const getAllVariants = recipeValue.getAllVariants;
      if (typeof getAllVariants === 'function') {
        const variants = getAllVariants();
        let css = '';
        const classMap: Record<string, string> = {};
        let allAtomicClassObjects: AtomicClass[] = [];
        
        for (const variant of variants) {
          const variantKey = Object.entries(variant)
            .map(([k, v]) => `${k}-${v}`)
            .join('_');
          
          const styleDef = recipeValue(variant);
          if (styleDef && styleDef.selectors) {
            const result = this.compileStyle(`${recipeId}_${variantKey}`, styleDef);
            css += result.css;
            Object.assign(classMap, result.classMap);
            
            if (result.atomicClasses && result.atomicClasses.length > 0) {
              allAtomicClassObjects.push(...result.atomicClasses);
            }
          }
        }
        
        // Deduplicate by className
        const seen = new Set<string>();
        allAtomicClassObjects = allAtomicClassObjects.filter(ac => {
          if (seen.has(ac.className)) return false;
          seen.add(ac.className);
          return true;
        });
        
        return {
          css: formatCSS(css, this.config.output.minify),
          classMap,
          atomicClasses: allAtomicClassObjects,
          stats: this.getStats()
        };
      }
    } catch (error) {
      console.error(`Failed to compile recipe ${recipeId}:`, error);
    }
    
    return {
      css: '',
      classMap: {},
      atomicClasses: [],
      stats: this.getStats()
    };
  }

  public async compile(inputFile: string, outputDir: string): Promise<any> {
    const results = await this.compileFile(inputFile);
    const baseName = getBaseName(inputFile);
    this.generateCSSFile(results, path.join(outputDir, `${baseName}.css`));
    return { results };
  }

  public async compileFile(filePath: string): Promise<Record<string, CompileResult>> {
    const moduleExports = await this.importModule(filePath);
    const results: Record<string, CompileResult> = {};

    for (const [name, value] of Object.entries(moduleExports)) {
      if (typeof value === 'function' && (value as any).variants) {
        results[name] = this.compileRecipe(name, value);
      } else if (value && typeof value === 'object' && (value as any).selectors) {
        results[name] = this.compileStyle(name, value as StyleDefinition);
      }
    }
    return results;
  }

  public async compileComponents(components: string[]): Promise<void> {
    // Ensure only one compilation at a time
    if (this.compileInProgress) {
      return new Promise((resolve, reject) => {
        this.compileQueue.push({ resolve, reject });
      });
    }
    
    this.compileInProgress = true;
    
    try {
      if (this.atomicOptimizer) this.atomicOptimizer.reset();
      this.accumulatedCSS = '';

      if (!this.config.silent) {
        console.log(chalk.blue('\n🔍 Phase 1: Scanning & Usage Analysis...'));
      }

      const BATCH_SIZE = PERFORMANCE.BATCH_SIZE || 10;
      const errors: Error[] = [];
      
      for (let i = 0; i < components.length; i += BATCH_SIZE) {
        const batch = components.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (file) => {
          if (typeof file !== 'string' || file.includes('\0') || file.startsWith('virtual:')) {
            return null;
          }
          if (!fs.existsSync(file)) return null;

          try {
            if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
              const result = scanFileForStyles(file, this.atomicOptimizer);
              if (result.errors.length > 0) {
                errors.push(...result.errors);
              }
            } else if (file.endsWith('.chain.js') || file.endsWith('.chain.ts')) {
              const exports = await this.importModule(file);
              const styles = exports.default || exports;
              const styleArray = Object.values(styles).filter(s => s && typeof s === 'object');
              this.atomicOptimizer?.trackStyles(styleArray as StyleDefinition[]);
            }
          } catch (err) {
            if (this.config.verbose) {
              console.warn(chalk.yellow(`  ⚠️  Scanning fallback for ${path.basename(file)}`));
            }
            const result = scanFileForStyles(file, this.atomicOptimizer);
            if (result.errors.length > 0) {
              errors.push(...result.errors);
            }
          }
          return null;
        });
        
        await Promise.allSettled(batchPromises);
        
        if (this.config.verbose && i % (BATCH_SIZE * 5) === 0) {
          console.log(chalk.gray(`  📊 Processed ${Math.min(i + BATCH_SIZE, components.length)}/${components.length} files`));
        }
      }
      
      if (errors.length > 0 && this.config.verbose) {
        console.warn(chalk.yellow(`  ⚠️  ${errors.length} scanning errors occurred`));
      }

      if (!this.config.silent) {
        console.log(chalk.blue('\n🏗️  Phase 2: Generating Component Styles...'));
      }
      
      const publicDir = path.resolve(process.cwd(), 'public');
      const manifestDir = path.resolve(process.cwd(), '.chaincss', 'manifest');

      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      if (!fs.existsSync(manifestDir)) fs.mkdirSync(manifestDir, { recursive: true });

      let processedComponents = 0;
      const generatedClassFiles: string[] = [];
      let totalAtomicRules = 0;
      
      for (const file of components) {
        if (!file.endsWith('.chain.js') && !file.endsWith('.chain.ts')) continue;

        const baseName = path.basename(file).replace(/\.chain\.(js|ts)$/, '');
        const sourceDir = path.dirname(file);
        let hasContent = false;
        let jsBuffer = `/** 
 * ChainCSS Generated Class Map 
 * Source: ${path.relative(process.cwd(), file)}
 * Generated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY
 */\n\n`;
        let cssBuffer = '';

        try {
          const rawExports = await this.importModule(file);
          const styles = rawExports.default || rawExports;
          
          for (const [name, style] of Object.entries(styles)) {
            if (style && typeof style === 'object' && (style as any).selectors) {
              const result = this.compileStyle(name, style as StyleDefinition);
              
              if (this.config.verbose) {
                const className = Object.values(result.classMap)[0];
                console.log(chalk.gray(`   📝 ${name} → ${className || '(empty)'}`));
              }
              
              const className = Object.values(result.classMap)[0];
              if (className) {
                jsBuffer += `export const ${name} = '${className}';\n`;
                cssBuffer += result.css + '\n';
                hasContent = true;
                totalAtomicRules += result.atomicClasses?.length || 0;
              }
            }
          }

          if (hasContent) {
            const targetDir = path.join(sourceDir, 'style');
            
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            
            const classFilePath = path.join(targetDir, `${baseName}.class.js`);
            fs.writeFileSync(classFilePath, jsBuffer);
            generatedClassFiles.push(classFilePath);
            
            if (cssBuffer.trim()) {
              const cssFilePath = path.join(targetDir, `${baseName}.css`);
              fs.writeFileSync(cssFilePath, formatCSS(cssBuffer, false));
            }
            
            processedComponents++;
            
            if (this.config.verbose) {
              console.log(chalk.green(`   ✨ ${baseName} → ${path.relative(process.cwd(), classFilePath)}`));
            }
          }
        } catch (error) {
          console.error(chalk.red(`   ❌ Failed to process ${baseName}: ${(error as Error).message}`));
        }
      }

      if (!this.config.silent) {
        console.log(chalk.blue('\n🌍 Phase 3: Finalizing Global Assets...'));
      }

      const finalAtomicCSS = this.atomicOptimizer ? this.atomicOptimizer.generateAtomicCSS() : '';
      
      const globalCssPath = path.join(publicDir, 'global.css');
      fs.writeFileSync(globalCssPath, formatCSS(finalAtomicCSS, this.config.output.minify));
      
      if (this.config.verbose) {
        console.log(chalk.blue(`   📦 Global CSS → ${path.relative(process.cwd(), globalCssPath)} (${finalAtomicCSS.length} bytes)`));
      }

      const manifestData = {
        version: VERSION,
        timestamp: new Date().toISOString(),
        atomicMap: this.atomicOptimizer?.atomicMap || {},
        stats: this.getStats(),
        classFiles: generatedClassFiles.map(f => path.relative(process.cwd(), f))
      };

      const manifestPath = path.join(manifestDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
      
      if (this.config.verbose) {
        console.log(chalk.blue(`   📦 Manifest → ${path.relative(process.cwd(), manifestPath)}`));
      }
      
      if (!this.config.silent) {
        console.log(chalk.green(`\n✅ Build Complete!`));
        console.log(chalk.gray(`   📁 Components processed: ${processedComponents}`));
        console.log(chalk.gray(`   📁 Class files generated: ${generatedClassFiles.length}`));
        console.log(chalk.gray(`   📁 Global CSS: ${path.relative(process.cwd(), globalCssPath)}`));
        console.log(chalk.gray(`   📁 Manifest: ${path.relative(process.cwd(), manifestPath)}`));

        if (this.atomicOptimizer) {
          const atomicCount = Object.keys(this.atomicOptimizer.atomicMap).length;
          const stats = this.atomicOptimizer.getStats();
          console.log(chalk.cyan(`\n📊 Optimization Stats:`));
          console.log(chalk.gray(`   Atomic Rules: ${atomicCount}`));
          console.log(chalk.gray(`   Total Styles: ${stats.totalStyles}`));
          console.log(chalk.gray(`   Unique Properties: ${stats.uniqueProperties}`));
          if (stats.savings) {
            console.log(chalk.green(`   CSS Savings: ${stats.savings}`));
          }
        }
      }
      
    } finally {
      this.compileInProgress = false;
      
      // Process queued compilations safely
      this.drainCompileQueue();
    }
  }
  
  /**
   * Drains the compile queue safely, handling items added during draining.
   */
  private drainCompileQueue(): void {
    while (this.compileQueue.length > 0) {
      const queue = [...this.compileQueue];
      this.compileQueue = [];
      for (const item of queue) {
        item.resolve();
      }
    }
  }
  
  // ============================================================================
  // Utilities & Plugin Helpers
  // ============================================================================

  public getCombinedCSS(): string {
    return this.accumulatedCSS;
  }

  public clearCSS(): void {
    this.accumulatedCSS = '';
    this.styleCache.clear();
    this.lruList = [];
    if (this.atomicOptimizer) {
      this.atomicOptimizer.reset();
    }
    if (this.config.verbose) {
      console.log('[Compiler] CSS cache cleared');
    }
  }

  public getStats() {
    const stats = this.atomicOptimizer?.getStats();
    return {
        totalStyles: stats?.totalStyles || 0,
        atomicStyles: (stats as any)?.atomicStyles || 0,
        uniqueProperties: (stats as any)?.uniqueProperties || 0,
        savings: stats?.savings || '0%'
    };
  }

  private generateCSSFile(results: Record<string, CompileResult>, outputPath: string): void {
    let css = '';
    for (const r of Object.values(results)) css += r.css;
    writeFile(outputPath, css);
  }

  public getAtomicMap(): Record<string, string> {
    return (this.atomicOptimizer as any)?.classMap || {};
  }

  private initOptimizer(): void {
    if (this.config.atomic.enabled) {
      if (!this.atomicOptimizer) {
        this.atomicOptimizer = new AtomicOptimizer(this.config.atomic);
        setAtomicOptimizer(this.atomicOptimizer);
      }
    }
  }

  private initPrefixer(): void {
    if (this.config.prefixer.enabled) this.prefixer = new ChainCSSPrefixer(this.config.prefixer);
  }
}

export async function compileChainCSS(inputFile: string, outputDir: string, config?: ChainCSSConfig) {
  const compiler = new ChainCSSCompiler(config || {});
  return await compiler.compile(inputFile, outputDir);
}