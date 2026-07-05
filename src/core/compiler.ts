// src/core/compiler.ts

/**
 * ChainCSS Build Compiler
 * 
 * Orchestrates the build pipeline: CSS generation, manifest creation,
 * and the unified 5-stage pipeline.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';
import { fileURLToPath, pathToFileURL } from 'url';
import { 
  DEFAULT_CONFIG, 
  VERSION,
  PERFORMANCE,
} from './constants.js';
import { formatCSS, writeFile, getBaseName } from './utils.js';
import type { ChainCSSConfig, CompileResult, StyleDefinition } from './types.js';

// Unified compilation pipeline
import { compileToCSS, partitionForBuild } from './style-compiler.js';
import type { StyleObject } from './style-collector.js';

// Compiler passes
import { ChainCSSPrefixer } from '../compiler/prefixer.js';
import { StyleGraphCompiler } from '../compiler/style-graph.js';
import type { GraphCompileOptions } from '../compiler/style-graph.js';

// Unified Pipeline (single system)
import { Pipeline, createDefaultPipeline } from '../compiler/pipeline/index.js';
import type { PipelineResult } from '../compiler/pipeline/index.js';
import { setBreakpoints } from '../compiler/breakpoints.js';

// IR — parse directly, no wasted CSS generation
import { createIR, parseIR, generateCSS, type StyleIR } from '../style-ir.js';

// Services (extracted from this class)
import { ModuleLoader } from '../compiler/services/module-loader.js';
import { CacheStore } from '../compiler/services/cache-store.js';
import { ManifestWriter } from '../compiler/services/manifest-writer.js';
import type { CompilerEvent, CompilerEventHandler } from '../compiler/services/compiler-events.js';

// ============================================================================
// ChainCSSCompiler
// ============================================================================

export class ChainCSSCompiler {
  private config: Required<ChainCSSConfig>;
  private prefixer: ChainCSSPrefixer | null = null;

  // Unified pipeline — single system
  private pipeline: Pipeline;
  private pipelineEnabled: boolean;

  // Extracted services
  private loader: ModuleLoader;
  private cache: CacheStore<CompileResult>;
  private manifestWriter: ManifestWriter;
  
  // Event system
  private eventHandlers: CompilerEventHandler[] = [];
  
  // Build state
  private accumulatedCSS: string = '';
  private compileInProgress: boolean = false;
  private compileQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  private aggregatedStats = {
  totalStyles: 0,
  atomicStyles: 0,
  deadRulesEliminated: 0,
  pipelinePasses: 0,
  filesProcessed: 0,
};
  
  constructor(config: ChainCSSConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      atomic: {
        ...DEFAULT_CONFIG.atomic,
        ...config.atomic,
      }
    } as Required<ChainCSSConfig>;

    this.setupCompilerGlobals();
    this.initPrefixer();

    // Initialize services
    this.loader = new ModuleLoader();
    this.cache = new CacheStore<CompileResult>(PERFORMANCE.CACHE_MAX_ENTRIES || 500);
    this.manifestWriter = new ManifestWriter();

    // Initialize unified pipeline (enabled by default)
    this.pipelineEnabled = (config as any).experimental?.enablePipeline !== false;
    this.pipeline = createDefaultPipeline({
      contexts: {
        optimization: { minify: this.config.output.minify, atomic: this.config.atomic.enabled },
      }
    });
  }

  

  // ==========================================================================
  // Event System
  // ==========================================================================

  /**
   * Subscribe to compiler events (warnings, errors, info).
   * Returns an unsubscribe function.
   */
  public onEvent(handler: CompilerEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  private emit(event: CompilerEvent): void {
    for (const handler of this.eventHandlers) {
      try { handler(event); } catch { /* handler errors shouldn't break compilation */ }
    }
    // Default behavior: log warnings unless silent mode
    if (event.type === 'warning' && !this.config.silent) {
      console.warn(chalk.yellow(`[ChainCSS] ${event.code}: ${event.message}`));
    }
    if (event.type === 'error' && !this.config.silent) {
      console.error(chalk.red(`[ChainCSS] ${event.code}: ${event.message}`));
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  private setupCompilerGlobals(): void {
    if (this.config.breakpoints) {
      setBreakpoints(this.config.breakpoints);
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
   * Routes through the unified 5-stage pipeline by default.
   * Set { experimental: { enablePipeline: false } } to use direct compilation.
   */
  public compileStyle(styleId: string, styleDef: StyleDefinition): CompileResult {
    if (this.pipelineEnabled) {
      return this.compileStyleViaPipeline(styleId, styleDef);
    }
    return this.compileStyleDirect(styleId, styleDef);
  }

  /**
   * Compile through the unified 5-stage pipeline.
   * Parses directly into IR — no wasted CSS generation from legacy path.
   */
  private compileStyleViaPipeline(
    styleId: string,
    styleDef: StyleDefinition
  ): CompileResult {
    const hash = this.hashStyleDef(styleDef);
    const cacheKey = `pipeline:${styleId}:${hash}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const selectors = styleDef.selectors || [];
    const isGlobalSelector = selectors.some(s =>
      !s.startsWith('.') && !s.startsWith('#')
    );

    // Phase 1: Convert StyleDefinition → StyleObject
    const styleObject = this.styleDefToObject(styleDef, styleId);

    // Phase 2: Parse directly into IR (single parse, no wasted CSS generation)
    const ir = parseIR(
      { [styleId]: styleObject as any },
      styleId
    );

    // Phase 3: Run through unified pipeline
    const pipelineResult = this.pipeline.execute(ir);

    // Collect stats from the pipeline result
    const totalRules = pipelineResult.ir.rules.length;
    const aliveRules = pipelineResult.ir.rules.filter(r => !r.isDead).length;
    const deadRules = totalRules - aliveRules;
    const atomicRules = pipelineResult.ir.rules.filter(
      r => r.meta?.atomic === true
    ).length;

    // Phase 4: Generate CSS from optimized IR
    const rawCSS = generateCSS(pipelineResult.ir, {
      minify: false,
    });

    const minifiedCSS = this.config.output.minify
      ? generateCSS(pipelineResult.ir, { minify: true })
      : rawCSS;

    let finalCSS = minifiedCSS;

    // Calculate compression savings
    const rawBytes = new TextEncoder().encode(rawCSS).length;
    const minBytes = new TextEncoder().encode(finalCSS).length;
    const savingsPercent = rawBytes > 0
      ? Math.round((1 - minBytes / rawBytes) * 100)
      : 0;

    // Phase 5: Run through prefixer if enabled
    if (this.prefixer && this.config.prefixer.enabled && finalCSS.trim()) {
      try {
        // Use lightweight prefixer directly (sync, no dependencies)
        const prefixed = (this.prefixer as any).lightweightPrefix(finalCSS);
        finalCSS = prefixed || finalCSS;
      } catch (e) {
        this.emit({
          type: 'warning',
          code: 'PREFIXER_FAILED',
          message: `CSS prefixing failed for "${styleId}", using unprefixed output`,
          sourceFile: styleId,
          originalError: e instanceof Error ? e : new Error(String(e)),
        });
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
      stats: {
        totalStyles: totalRules,
        atomicStyles: atomicRules,
        uniqueProperties: 0,
        savings: deadRules > 0 ? `${deadRules} rules eliminated` : '0%',
        deadRulesEliminated: deadRules,
        compressionSavings: `${savingsPercent}%`,
        pipelinePasses: pipelineResult.timeline.length,
        totalDuration: pipelineResult.totalDuration,
      }
    };

    result.inspector = {
      ir: pipelineResult.ir,
      pipelineReport: pipelineResult.timeline,
      diagnostics: pipelineResult.ir.diagnostics,
    };

    // Attach pipeline diagnostics if verbose
    if (this.config.verbose) {
      (result as any)._pipelineReport = pipelineResult.timeline || [];
      (result as any)._diagnostics = pipelineResult.ir.diagnostics || [];
    }

    // Cache
    this.cache.set(cacheKey, result, hash);

    return result;
  }

  /**
   * Direct compilation without the pipeline.
   * Used when pipeline is disabled or as fallback.
   */
  private compileStyleDirect(
    styleId: string,
    styleDef: StyleDefinition
  ): CompileResult {
    const hash = this.hashStyleDef(styleDef);
    const cacheKey = `direct:${styleId}:${hash}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const selectors = styleDef.selectors || [];
    const isGlobalSelector = selectors.some(s => 
      !s.startsWith('.') && !s.startsWith('#')
    );

    // Build the style object
    const styleObject = this.styleDefToObject(styleDef, styleId);

    // Generate CSS directly via compileToCSS
    const finalCSS = compileToCSS(styleObject, {
      scopeSelector: Array.isArray(selectors) ? selectors.join(', ') : `.${styleId}`,
      minify: this.config.output.minify,
      sourceMap: this.config.sourceComments,
      sourceFile: styleId
    });
    
    const finalClassName = isGlobalSelector 
      ? '' 
      : selectors[0]?.replace(/^\./, '') || `chain-${styleId}`;

    const { hasDynamic } = partitionForBuild(styleObject);

    const result: CompileResult = {
      css: formatCSS(finalCSS, this.config.output.minify),
      classMap: isGlobalSelector ? {} : { [styleId]: finalClassName },
      atomicClasses: [],
      stats: this.getStats()
    };

    // Cache
    this.cache.set(cacheKey, result, hash);

    return result;
  }

  /**
   * Convert a StyleDefinition to the unified StyleObject format.
   * Handles nested pseudo-classes, at-rules, and nested selectors.
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

    // Restore selectors (they were destructured out of properties)
    if (selectors && Array.isArray(selectors)) {
      (styleObject as any).selectors = selectors;
    }

    // Handle hover pseudo-class
    if (hover && typeof hover === 'object') {
      styleObject['&:hover'] = hover;
    }

    // Handle at-rules (media queries, etc.)
    if (atRules && Array.isArray(atRules)) {
      styleObject.atRules = atRules;
    }

    // Handle nested rules
    if (nestedRules && Array.isArray(nestedRules)) {
      styleObject._nestedRules = nestedRules;
    }

    // Handle arbitrary nested selectors (& prefix, .class, etc.)
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
   * Enable or disable the pipeline.
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
   * Get the Pipeline instance for direct control.
   */
  public getPipeline(): Pipeline {
    return this.pipeline;
  }

  /**
   * Get diagnostics from the last pipeline run.
   */
  public getDiagnostics(): any[] {
    const results = this.pipeline.getLastResult?.();
    return results?.ir?.diagnostics || [];
  }

  /**
   * Print the pipeline report to console.
   */
  public printPipelineReport(): void {
    const lastResult = this.pipeline.getLastResult?.();
    if (lastResult?.timeline) {
      console.log(this.pipeline.report(lastResult.timeline));
    }
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
        
        for (const variant of variants) {
          const variantKey = Object.entries(variant)
            .map(([k, v]) => `${k}-${v}`)
            .join('_');
          
          const styleDef = recipeValue(variant);
          if (styleDef && styleDef.selectors) {
            const result = this.compileStyle(`${recipeId}_${variantKey}`, styleDef);
            css += result.css;
            Object.assign(classMap, result.classMap);
          }
        }
        
        return {
          css: formatCSS(css, this.config.output.minify),
          classMap,
          atomicClasses: [],
          stats: this.getStats()
        };
      }
    } catch (error) {
      this.emit({
        type: 'error',
        code: 'RECIPE_COMPILE_FAILED',
        message: `Failed to compile recipe "${recipeId}": ${(error as Error).message}`,
        sourceFile: recipeId,
        originalError: error instanceof Error ? error : new Error(String(error)),
      });
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
    const moduleExports = await this.loader.import(filePath);
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
   * Main build method — compiles all .chain.ts files and generates output files.
   */
  public async compileComponents(components: string[]): Promise<void> {
    if (this.compileInProgress) {
      return new Promise((resolve, reject) => {
        this.compileQueue.push({ resolve, reject });
      });
    }

    this.aggregatedStats = {
      totalStyles: 0,
      atomicStyles: 0,
      deadRulesEliminated: 0,
      pipelinePasses: 0,
      filesProcessed: 0,
    };
    
    this.compileInProgress = true;
    
    try {
      this.accumulatedCSS = '';

      if (!this.config.silent) {
        console.log(chalk.blue('\n🏗️  Building Component Styles...'));
      }

      let processedComponents = 0;
      const generatedClassFiles: string[] = [];
      let totalDiagnostics = 0;
      
      for (const file of components) {
        // Match the default glob pattern: .chain.js, .chain.ts, .chain.jsx, .chain.tsx
        if (!file.endsWith('.chain.js') && !file.endsWith('.chain.ts') &&
            !file.endsWith('.chain.jsx') && !file.endsWith('.chain.tsx')) continue;

        const baseName = path.basename(file).replace(/\.chain\.(js|ts|jsx|tsx)$/, '');
        const sourceDir = path.dirname(file);

        let sourceCode = '';
        try { sourceCode = fs.readFileSync(file, 'utf8'); } catch {}
        const hasDynamic = sourceCode.includes('chain.dynamic()');

        const diags = await this.compileOneComponent(
          file, baseName, sourceDir, hasDynamic, generatedClassFiles
        );
        totalDiagnostics += diags;
        processedComponents++;
      }

      // Manifest
      if (!this.config.silent) {
        console.log(chalk.blue('\n📋 Finalizing Manifest...'));
      }

      this.manifestWriter.write({
        version: VERSION,
        timestamp: new Date().toISOString(),
        atomicMap: {},
        stats: this.getAggregatedStats(),
        pipelineEnabled: this.pipelineEnabled,
        diagnosticsCount: totalDiagnostics,
        classFiles: generatedClassFiles.map(f => path.relative(process.cwd(), f))
      });
      
      if (!this.config.silent) {
        console.log(chalk.green(`\n✅ Build Complete!`));
        console.log(chalk.gray(`   📁 Components processed: ${processedComponents}`));
        console.log(chalk.gray(`   📁 Class files generated: ${generatedClassFiles.length}`));
        console.log(chalk.gray(`   📁 Manifest: ${path.relative(process.cwd(), '.chaincss/manifest/manifest.json')}`));
        
        if (this.pipelineEnabled) {
          console.log(chalk.cyan(`   🔬 Pipeline: 5-stage pipeline active — ${totalDiagnostics} diagnostics`));
        }
      }
      
    } finally {
      this.compileInProgress = false;
      this.drainCompileQueue();
    }
  }

  /**
   * Compile a single component file and write its outputs.
   * Returns the count of diagnostics generated during compilation.
   */
  private async compileOneComponent(
    file: string,
    baseName: string,
    sourceDir: string,
    hasDynamic: boolean,
    generatedClassFiles: string[]
  ): Promise<number> {
    let diagnosticsCount = 0;

    try {
      const rawExports = await this.loader.import(file);
      const styles = rawExports.default || rawExports;
      let jsBuffer = this.generateClassFileHeader(file);
      let cssBuffer = '';

      for (const [name, style] of Object.entries(styles)) {
        if (!style || typeof style !== 'object' || !(style as any).selectors) continue;

        const result = this.compileStyle(name, style as StyleDefinition);
        const className = Object.values(result.classMap)[0];

        if (className) {
          jsBuffer += hasDynamic
            ? `export const ${name}Class = '${className}';\n`
            : `export const ${name} = '${className}';\n`;
        }

        cssBuffer += result.css + '\n';

        if ((result as any)._diagnostics) {
          diagnosticsCount += (result as any)._diagnostics.length;
        }
      }

      if (cssBuffer.trim() || jsBuffer.includes('export const')) {
        await this.writeComponentOutput(sourceDir, baseName, jsBuffer, cssBuffer, generatedClassFiles);
      }
    } catch (error) {
      this.emit({
        type: 'error',
        code: 'FILE_PROCESS_FAILED',
        message: `Failed to process ${baseName}: ${(error as Error).message}`,
        sourceFile: file,
        originalError: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return diagnosticsCount;
  }

  /**
   * Generate the header comment for a generated class file.
   */
  private generateClassFileHeader(file: string): string {
    return `/** 
 * ChainCSS Generated Class Map 
 * Source: ${path.relative(process.cwd(), file)}
 * Generated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY
 */\n\n`;
  }

  /**
   * Write the compiled output files (.class.js and .css) for a component.
   */
  private async writeComponentOutput(
    sourceDir: string,
    baseName: string,
    jsBuffer: string,
    cssBuffer: string,
    generatedClassFiles: string[]
  ): Promise<void> {
    if (!fs.existsSync(sourceDir)) {
      fs.mkdirSync(sourceDir, { recursive: true });
    }

    const classFilePath = path.join(sourceDir, `${baseName}.class.js`);
    fs.writeFileSync(classFilePath, jsBuffer);
    generatedClassFiles.push(classFilePath);

    if (cssBuffer.trim()) {
      let finalCSS = cssBuffer;

      if (this.prefixer && this.config.prefixer.enabled) {
        try {
          const prefixed = await this.prefixer.process(finalCSS);
          finalCSS = prefixed.css || finalCSS;
        } catch (e) {
          this.emit({
            type: 'warning',
            code: 'PREFIXER_BATCH_FAILED',
            message: `CSS prefixing failed for "${baseName}", using unprefixed output`,
            sourceFile: classFilePath,
            originalError: e instanceof Error ? e : new Error(String(e)),
          });
        }
      }

      const cssFilePath = path.join(sourceDir, `${baseName}.css`);
      fs.writeFileSync(cssFilePath, formatCSS(finalCSS, false));
    }

    if (this.config.verbose) {
      console.log(chalk.green(`   ✨ ${baseName} → ${path.relative(process.cwd(), classFilePath)}`));
    }
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
    this.cache.clear();
  }

  public getStats() {
    const lastResult = this.pipeline.getLastResult?.();
    const rules = lastResult?.ir?.rules || [];
    const totalRules = rules.length;
    const aliveRules = rules.filter((r: any) => !r.isDead).length;
    const atomicRules = rules.filter((r: any) => r.meta?.atomic === true).length;
    const deadRules = totalRules - aliveRules;

    this.aggregatedStats.totalStyles += totalRules;
    this.aggregatedStats.atomicStyles += atomicRules;
    this.aggregatedStats.deadRulesEliminated += deadRules;
    this.aggregatedStats.pipelinePasses = Math.max(
      this.aggregatedStats.pipelinePasses,
      lastResult?.timeline?.length || 0
    );
    this.aggregatedStats.filesProcessed++;

    return {
      totalStyles: totalRules,
      atomicStyles: atomicRules,
      uniqueProperties: 0,
      savings: deadRules > 0 ? `${deadRules} rules eliminated` : '0%',
      deadRulesEliminated: deadRules,
      pipelinePasses: lastResult?.timeline?.length || 0,
    };
  }

  public getAggregatedStats() {
    return {
      totalStyles: this.aggregatedStats.totalStyles,
      atomicStyles: this.aggregatedStats.atomicStyles,
      uniqueProperties: 0,
      savings: this.aggregatedStats.deadRulesEliminated > 0
        ? `${this.aggregatedStats.deadRulesEliminated} rules eliminated`
        : '0%',
      deadRulesEliminated: this.aggregatedStats.deadRulesEliminated,
      pipelinePasses: this.aggregatedStats.pipelinePasses,
      filesProcessed: this.aggregatedStats.filesProcessed,
    };
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

  private hashStyleDef(styleDef: StyleDefinition): string {
    const { _componentName, _generateComponent, _framework, _propsDefinition, ...relevant } = styleDef as any;

    // Sort keys for deterministic serialization — property order in source
    // shouldn't change the cache key if the values are identical
    const sortedKeys = Object.keys(relevant).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of sortedKeys) {
      sortedObj[key] = relevant[key];
    }

    return crypto.createHash('sha256')
      .update(JSON.stringify(sortedObj))
      .digest('hex')
      .slice(0, 16);
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