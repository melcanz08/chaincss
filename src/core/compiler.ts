// src/core/compiler.ts

/**
 * ChainCSS Build Compiler
 * 
 * Orchestrates the build pipeline: scanning, atomic optimization,
 * CSS generation, manifest creation, and the full 18-pass IR pipeline.
 * 
 * Routes every style through: accessibility, responsive inference,
 * layout intelligence, pattern learning, source optimization,
 * semantic tokens, intent API, constraint solver, and more.
 */

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

// Unified compilation pipeline
import { compileToCSS, partitionForBuild } from './style-compiler.js';
import type { StyleObject } from './style-collector.js';

// Compiler passes
import { AtomicOptimizer } from '../compiler/atomic-optimizer.js';
import type { AtomicClass } from '../compiler/atomic-optimizer.js';
import { ChainCSSPrefixer } from '../compiler/prefixer.js';
import { CacheManager } from '../compiler/cache-manager.js';
import { PersistentCache } from '../compiler/content-addressable-cache.js';
import { StyleGraphCompiler } from '../compiler/style-graph.js';
import type { GraphCompileOptions } from '../compiler/style-graph.js';

// Legacy — kept for backward compatibility
import { scanFileForStyles } from '../compiler/scanner.js';
import { setBreakpoints } from '../compiler/breakpoints.js';

// IR Pipeline — runs all 18 optimization passes
import { createIR, compileViaIR, generateCSS, type StyleIR } from '../compiler/style-ir.js';
import { PassManager, DEFAULT_PIPELINE } from '../compiler/pass-manager.js';



const __filename = typeof import.meta !== 'undefined' 
  ? (() => { try { return fileURLToPath(import.meta.url); } catch { return ''; } })() 
  : '';
const __dirname = __filename ? path.dirname(__filename) : '';

// ============================================================================
// Types
// ============================================================================

interface CachedStyleEntry {
  result: any;
  accessCount: number;
  lastAccessed: number;
  hash: string;
}

// ============================================================================
// ChainCSSCompiler
// ============================================================================

export class ChainCSSCompiler {
  private config: Required<ChainCSSConfig>;
  private prefixer: ChainCSSPrefixer | null = null;
  public atomicOptimizer: AtomicOptimizer | null = null;

  // IR Pipeline — runs all 18 passes
  private passManager: PassManager;
  private pipelineEnabled: boolean;

  // Caching
  private styleCache = new Map<string, CachedStyleEntry>();
  private lruList: string[] = [];
  private readonly MAX_CACHE_SIZE = PERFORMANCE.CACHE_MAX_ENTRIES || 500;
  
  // Build state
  private accumulatedCSS: string = '';
  private compileInProgress: boolean = false;
  private compileQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  
  // Module tracking
  private importedModules = new Map<string, { timestamp: number; hash: string }>();
  private dependencyGraph = new Map<string, Set<string>>();
  
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
    this.initOptimizer();
    this.initPrefixer();

    // Initialize the IR pass pipeline (enabled by default)
    this.pipelineEnabled = (config as any).experimental?.enablePipeline !== false;
    this.passManager = new PassManager(DEFAULT_PIPELINE);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  private setupCompilerGlobals(): void {
    if (this.config.breakpoints) {
      setBreakpoints(this.config.breakpoints);
    }
  }

  private initOptimizer(): void {
    if (this.config.atomic.enabled) {
      this.atomicOptimizer = new AtomicOptimizer(this.config.atomic);
    }
  }

  private initPrefixer(): void {
    if (this.config.prefixer.enabled) {
      this.prefixer = new ChainCSSPrefixer(this.config.prefixer);
    }
  }

  // ==========================================================================
  // Style Compilation (the core method)
  // ==========================================================================

  /**
   * Compile a single style definition to CSS + class map.
   * 
   * Routes through the full 18-pass IR pipeline by default, which includes:
   * accessibility checks, responsive inference, layout intelligence,
   * pattern learning, source optimization, semantic tokens, intent API,
   * constraint solver, and CSS compression.
   * 
   * Set { experimental: { enablePipeline: false } } to use direct compilation.
   */
  public compileStyle(styleId: string, styleDef: StyleDefinition): CompileResult {
    // Use pipeline if enabled (default: true)
    if (this.pipelineEnabled) {
      return this.compileStyleViaPipeline(styleId, styleDef);
    }

    // Fallback: direct compilation
    return this.compileStyleDirect(styleId, styleDef);
  }

  /**
   * Compile through the full 18-pass IR pipeline.
   * Returns enhanced CompileResult with diagnostics from all passes.
   */
  private compileStyleViaPipeline(
    styleId: string,
    styleDef: StyleDefinition
  ): CompileResult {
    const hash = this.hashStyleDef(styleDef);
    const cacheKey = `pipeline:${styleId}:${hash}`;

    // Check cache
    const cached = this.styleCache.get(cacheKey);
    if (cached) {
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      this.touchLRU(cacheKey);
      return cached.result;
    }

    const selectors = styleDef.selectors || [];
    const isGlobalSelector = selectors.some(s =>
      !s.startsWith('.') && !s.startsWith('#')
    );

    // Phase 1: Convert StyleDefinition → StyleObject
    const styleObject = this.styleDefToObject(styleDef, styleId);

    // Phase 2: Parse into IR (compileViaIR handles parseIR internally)
    const { ir } = compileViaIR(
      { [styleId]: styleObject as any },
      [], // no extra passes — we use PassManager instead
      { sourceFile: styleId }
    );

    // Phase 3: Run the full 18-pass pipeline
    const pipelineResult = this.passManager.run(ir);

    // Phase 4: Generate CSS from optimized IR
    let finalCSS = generateCSS(pipelineResult.ir, {
      minify: this.config.output.minify,
    });

    // Phase 5: Run through prefixer if enabled
    if (this.prefixer && this.config.prefixer.enabled && finalCSS.trim()) {
      try {
        const prefixed = (this.prefixer as any).processSync
          ? (this.prefixer as any).processSync(finalCSS)
          : finalCSS;
        finalCSS = prefixed?.css || finalCSS;
      } catch {
        // Fall through with unprefixed CSS
      }
    }

    // Determine class name
    let finalClassName = '';
    if (!isGlobalSelector) {
      finalClassName = selectors[0]?.replace(/^\./, '') || `chain-${styleId}`;
    }

    // Partition for build/runtime split
    const { hasDynamic, dynamicValues } = partitionForBuild(styleObject);

    const result: CompileResult = {
      css: formatCSS(finalCSS, this.config.output.minify),
      classMap: isGlobalSelector ? {} : { [styleId]: finalClassName },
      atomicClasses: [],
      stats: this.getStats()
    };

    // Attach pipeline diagnostics if verbose
    if (this.config.verbose) {
      (result as any)._pipelineReport = pipelineResult.summary;
      (result as any)._diagnostics = pipelineResult.ir.diagnostics || [];
    }

    // Cache
    this.addToCache(cacheKey, { result, accessCount: 1, lastAccessed: Date.now(), hash });

    return result;
  }

  /**
   * Direct compilation without the IR pipeline.
   * Used when pipeline is disabled or as fallback.
   */
  private compileStyleDirect(
    styleId: string,
    styleDef: StyleDefinition
  ): CompileResult {
    const hash = this.hashStyleDef(styleDef);
    const cacheKey = `${styleId}:${hash}`;

    // Check cache
    const cached = this.styleCache.get(cacheKey);
    if (cached) {
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      this.touchLRU(cacheKey);
      return cached.result;
    }

    // Determine selectors
    const selectors = styleDef.selectors || [];
    const isGlobalSelector = selectors.some(s => 
      !s.startsWith('.') && !s.startsWith('#')
    );

    let finalClassName = '';
    let finalCSS = '';
    let atomicClasses: AtomicClass[] = [];

    // Phase 1: Atomic Optimization
    if (this.atomicOptimizer && this.config.atomic.enabled && !isGlobalSelector) {
      const optimized = this.atomicOptimizer.optimize({ [styleId]: styleDef });
      
      if (optimized.map && optimized.map[styleId]) {
        finalClassName = optimized.map[styleId];
      }
      
      if (optimized.css && optimized.css.trim()) {
        finalCSS = optimized.css;
      }
      
      const componentMapping = this.atomicOptimizer.getComponentMapEntry(styleId);
      if (componentMapping?.atomicClasses) {
        atomicClasses = componentMapping.atomicClasses
          .map(className => {
            const allClasses = this.atomicOptimizer?.getAllAtomicClasses?.() || [];
            const entry = allClasses.find((a: any) => a.className === className);
            return entry || { className, prop: '', value: '', usageCount: 0, rules: '' };
          })
          .filter(Boolean) as AtomicClass[];
      }
    }

    // Phase 2: CSS Generation
    if (!finalCSS || isGlobalSelector) {
      const styleObject = this.styleDefToObject(styleDef, styleId);
      
      finalCSS = compileToCSS(styleObject, {
        scopeSelector: Array.isArray(selectors) ? selectors.join(', ') : `.${styleId}`,
        minify: this.config.output.minify,
        sourceMap: this.config.sourceComments,
        sourceFile: styleId
      });
      
      if (isGlobalSelector) {
        finalClassName = '';
      } else {
        finalClassName = finalClassName || generateClassName(styleId, this.config.atomic.naming);
      }
    }

    // Phase 3: Partition for build/runtime split
    const styleObject = this.styleDefToObject(styleDef, styleId);
    const { hasDynamic } = partitionForBuild(styleObject);

    const result: CompileResult = {
      css: formatCSS(finalCSS, this.config.output.minify),
      classMap: isGlobalSelector ? {} : { [styleId]: finalClassName },
      atomicClasses: isGlobalSelector ? [] : atomicClasses,
      stats: this.getStats()
    };

    // Cache
    this.addToCache(cacheKey, { result, accessCount: 1, lastAccessed: Date.now(), hash });

    return result;
  }

  /**
   * Convert a StyleDefinition to the unified StyleObject format.
   */
  private styleDefToObject(styleDef: StyleDefinition, id: string): StyleObject {
    const {
      selectors,
      atRules,
      nestedRules,
      hover,
      themes,
      _componentName,
      _generateComponent,
      _framework,
      _propsDefinition,
      ...properties
    } = styleDef as any;

    const styleObject: StyleObject = { ...properties };

    // FIX: Preserve selectors on the style object so CSS generation uses them
    if (selectors && Array.isArray(selectors)) {
      (styleObject as any).selectors = selectors;
    }

    if (hover && typeof hover === 'object') {
      styleObject['&:hover'] = hover;
    }

    if (atRules && Array.isArray(atRules)) {
      styleObject._atRules = atRules;
    }

    if (nestedRules && Array.isArray(nestedRules)) {
      styleObject._nestedRules = nestedRules;
    }

    for (const key of Object.keys(styleDef)) {
      if (key.startsWith('&') || key.startsWith('.')) {
        styleObject[key] = (styleDef as any)[key];
      }
    }

    return styleObject;
  }

  // ==========================================================================
  // Pipeline Control
  // ==========================================================================

  /**
   * Enable or disable the 18-pass IR pipeline.
   * When disabled, uses direct CSS compilation (faster but no optimizations).
   */
  public setPipelineEnabled(enabled: boolean): this {
    this.pipelineEnabled = enabled;
    return this;
  }

  /**
   * Check if the pipeline is currently enabled.
   */
  public isPipelineEnabled(): boolean {
    return this.pipelineEnabled;
  }

  /**
   * Get the pass manager for direct pipeline control.
   */
  public getPassManager(): PassManager {
    return this.passManager;
  }

  /**
   * Get diagnostics from the last pipeline run.
   */
  public getDiagnostics(): any[] {
    const results = this.passManager.getResults();
    const allDiagnostics: any[] = [];
    for (const result of results) {
      if (result.errors.length > 0) {
        allDiagnostics.push(...result.errors);
      }
    }
    return allDiagnostics;
  }

  /**
   * Print the pipeline report to console.
   */
  public printPipelineReport(): void {
    console.log(this.passManager.report());
  }

  // ==========================================================================
  // Recipe Compilation
  // ==========================================================================

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
    
    return { css: '', classMap: {}, atomicClasses: [], stats: this.getStats() };
  }

  // ==========================================================================
  // Graph Compilation (advanced optimization)
  // ==========================================================================

  public compileWithGraph(
    styles: Record<string, StyleDefinition>,
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

  // ==========================================================================
  // File & Batch Compilation
  // ==========================================================================

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

  /**
   * Main build method — compiles all components and generates output files.
   */
  public async compileComponents(components: string[]): Promise<void> {
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

      if (!this.config.silent) {
        console.log(chalk.blue('\n🏗️  Phase 2: Generating Component Styles...'));
      }
      
      const manifestDir = path.resolve(process.cwd(), '.chaincss', 'manifest');
      if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir, { recursive: true });
      }

      let processedComponents = 0;
      const generatedClassFiles: string[] = [];
      let totalDiagnostics = 0;
      
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

        // Read source to detect mixed mode (chain.dynamic())
        let sourceCode = '';
        try { sourceCode = fs.readFileSync(file, 'utf8'); } catch {}
        const hasDynamic = sourceCode.includes('chain.dynamic()');

        try {
          const rawExports = await this.importModule(file);
          const styles = rawExports.default || rawExports;
          
          for (const [name, style] of Object.entries(styles)) {
            if (style && typeof style === 'object' && (style as any).selectors) {
              const result = this.compileStyle(name, style as StyleDefinition);
              const className = Object.values(result.classMap)[0];
              
              if (className) {
                if (hasDynamic) {
                  jsBuffer += `export const ${name}Class = '${className}';\n`;
                } else {
                  jsBuffer += `export const ${name} = '${className}';\n`;
                }
                
                if (result.atomicClasses && result.atomicClasses.length > 0 && this.atomicOptimizer) {
                  const allEntries = this.atomicOptimizer.getAllAtomicClasses?.() || [];
                  const entryMap = new Map(allEntries.map((a: any) => [a.className, a]));
                  const seenAtomic = new Set<string>();
                  
                  for (const ac of result.atomicClasses) {
                    const acName = typeof ac === 'string' ? ac : ac.className;
                    if (!seenAtomic.has(acName)) {
                      seenAtomic.add(acName);
                      const fullEntry: any = entryMap.get(acName);
                      if (fullEntry?.cssRule) {
                        cssBuffer += `.${acName} { ${fullEntry.cssRule} }\n`;
                      }
                    }
                  }
                }
                
                cssBuffer += result.css + '\n';
                hasContent = true;
              } else {
                hasContent = true;
                cssBuffer += result.css + '\n';
              }

              // Collect pipeline diagnostics
              if ((result as any)._diagnostics) {
                totalDiagnostics += (result as any)._diagnostics.length;
              }
            }
          }

          if (hasContent) {
            const targetDir = sourceDir;
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            
            const classFilePath = path.join(targetDir, `${baseName}.class.js`);
            fs.writeFileSync(classFilePath, jsBuffer);
            generatedClassFiles.push(classFilePath);
            
            if (cssBuffer.trim()) {
              const cssFilePath = path.join(targetDir, `${baseName}.css`);
              let finalCSS = cssBuffer;
              
              if (this.prefixer && this.config.prefixer.enabled) {
                try {
                  const prefixed = await this.prefixer.process(finalCSS);
                  finalCSS = prefixed.css || finalCSS;
                } catch (e) {
                  // Fall through with unprefixed CSS
                }
              }
              
              fs.writeFileSync(cssFilePath, formatCSS(finalCSS, false));
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

      // Phase 3: Manifest
      if (!this.config.silent) {
        console.log(chalk.blue('\n🌍 Phase 3: Finalizing Global Assets...'));
      }

      const manifestData = {
        version: VERSION,
        timestamp: new Date().toISOString(),
        atomicMap: this.atomicOptimizer?.atomicMap || {},
        stats: this.getStats(),
        pipelineEnabled: this.pipelineEnabled,
        diagnosticsCount: totalDiagnostics,
        classFiles: generatedClassFiles.map(f => path.relative(process.cwd(), f))
      };

      const manifestPath = path.join(manifestDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
      
      if (!this.config.silent) {
        console.log(chalk.green(`\n✅ Build Complete!`));
        console.log(chalk.gray(`   📁 Components processed: ${processedComponents}`));
        console.log(chalk.gray(`   📁 Class files generated: ${generatedClassFiles.length}`));
        console.log(chalk.gray(`   📁 Manifest: ${path.relative(process.cwd(), manifestPath)}`));
        
        if (this.pipelineEnabled) {
          console.log(chalk.cyan(`   🔬 Pipeline: 18 passes active — ${totalDiagnostics} diagnostics`));
        }

        if (this.atomicOptimizer) {
          const stats = this.atomicOptimizer.getStats();
          console.log(chalk.cyan(`\n📊 Optimization Stats:`));
          console.log(chalk.gray(`   Atomic Rules: ${stats.atomicStyles}`));
          console.log(chalk.gray(`   Total Styles: ${stats.totalStyles}`));
          console.log(chalk.gray(`   Unique Properties: ${stats.uniqueProperties}`));
          if (stats.savings) {
            console.log(chalk.green(`   CSS Savings: ${stats.savings}`));
          }
        }
      }
      
    } finally {
      this.compileInProgress = false;
      this.drainCompileQueue();
    }
  }

  // ==========================================================================
  // Caching
  // ==========================================================================

  private addToCache(key: string, entry: CachedStyleEntry): void {
    if (this.styleCache.has(key)) {
      this.styleCache.set(key, entry);
      this.touchLRU(key);
      return;
    }
    
    while (this.styleCache.size >= this.MAX_CACHE_SIZE && this.lruList.length > 0) {
      const oldest = this.lruList.shift();
      if (oldest) {
        this.styleCache.delete(oldest);
      }
    }
    
    this.styleCache.set(key, entry);
    this.lruList.push(key);
  }

  private touchLRU(key: string): void {
    this.lruList = this.lruList.filter(k => k !== key);
    this.lruList.push(key);
  }

  private hashStyleDef(styleDef: StyleDefinition): string {
    const { _componentName, _generateComponent, _framework, _propsDefinition, ...relevant } = styleDef as any;
    return crypto.createHash('sha256')
      .update(JSON.stringify(relevant))
      .digest('hex')
      .slice(0, 16);
  }

  // ==========================================================================
  // Module Imports
  // ==========================================================================

  private async importModule(filePath: string): Promise<Record<string, any>> {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    const fileUrl = pathToFileURL(absolutePath).href;
    
    try {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        throw new Error(`Component file ${path.basename(filePath)} will be processed by scanner`);
      }
      
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

  // ==========================================================================
  // Source Scanning (for Vite/Webpack plugins)
  // ==========================================================================

  public async compileSource(source: string, id: string): Promise<void> {
    if (!this.atomicOptimizer || id.includes('\0')) return;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  public getCombinedCSS(): string {
    return this.accumulatedCSS;
  }

  public hasStyles(): boolean {
    return !!(this.accumulatedCSS && this.accumulatedCSS.trim().length > 0);
  }

  public clearCSS(): void {
    this.accumulatedCSS = '';
    this.styleCache.clear();
    this.lruList = [];
    if (this.atomicOptimizer) {
      this.atomicOptimizer.reset();
    }
  }

  public getStats() {
    const stats = this.atomicOptimizer?.getStats();
    return {
      totalStyles: stats?.totalStyles || 0,
      atomicStyles: stats?.atomicStyles || 0,
      uniqueProperties: stats?.uniqueProperties || 0,
      savings: stats?.savings || '0%'
    };
  }

  public getAtomicMap(): Record<string, string> {
    return this.atomicOptimizer?.getAtomicMap?.() || {};
  }

  private generateCSSFile(results: Record<string, CompileResult>, outputPath: string): void {
    let css = '';
    for (const r of Object.values(results)) css += r.css;
    writeFile(outputPath, css);
  }

  private drainCompileQueue(): void {
    while (this.compileQueue.length > 0) {
      const queue = [...this.compileQueue];
      this.compileQueue = [];
      for (const item of queue) {
        item.resolve();
      }
    }
  }
}

// ============================================================================
// Convenience function
// ============================================================================

export async function compileChainCSS(
  inputFile: string,
  outputDir: string,
  config?: ChainCSSConfig
) {
  const compiler = new ChainCSSCompiler(config || {});
  return await compiler.compile(inputFile, outputDir);
}