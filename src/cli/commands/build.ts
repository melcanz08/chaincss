// src/cli/commands/build.ts

import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { ChainCSSCompiler } from '../../core/compiler.js';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { findInputFiles, ensureDirectory } from '../utils/file-utils.js';
import type { BuildOptions } from '../types.js';

import { serializeForInspector } from '../../compiler/pipeline/inspector/serializer.js';
import { InspectorStore } from '../../compiler/pipeline/inspector/store.js';

export async function buildCommand(options: BuildOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  
  logger.header('ChainCSS Build');
  
  const config = await loadConfig(options.config && !options.config.includes('*') ? options.config : undefined);
  const inputs = options.config && options.config.includes('*') 
    ? [options.config] 
    : config.inputs || ['src/**/*.chain.{js,ts}', 'src/**/*.chain.{jsx,tsx}'];
  
  let outputDir = 'dist/styles';
  let cssFileName = 'styles.css';
  if (typeof config.output === 'object' && config.output.cssFile) {
    outputDir = path.dirname(config.output.cssFile);
    cssFileName = path.basename(config.output.cssFile);
  } else if (typeof config.output === 'string') {
    outputDir = config.output;
  }
  
  if (inputs.length === 0) {
    logger.error('No input patterns found in configuration');
    process.exit(1);
  }
  
  logger.info(`Input patterns: ${inputs.join(', ')}`);
  const files = findInputFiles(inputs);
  
  if (files.length === 0) {
    logger.warn('No .chain.js or .chain.ts files found');
    return;
  }
  
  logger.success(`Found ${files.length} file(s) to compile`);
  
  ensureDirectory(outputDir);
  
  const compiler = new ChainCSSCompiler({
    tokens: config.tokens,
    atomic: {
      enabled: options.atomic !== undefined ? options.atomic : (config.atomic?.enabled !== false),
      threshold: config.atomic?.threshold || 2,
      naming: config.atomic?.naming || (process.env.NODE_ENV === 'production' ? 'hash' : 'readable'),
      minify: options.minify !== undefined ? options.minify : (config.atomic?.minify !== false),
      mode: config.atomic?.mode || 'hybrid',
      verbose: options.verbose || config.verbose || false
    },
    prefixer: {
      enabled: config.prefixer?.enabled !== false,
      browsers: config.prefixer?.browsers
    },
    output: {
      minify: options.minify !== undefined ? options.minify : (config.output?.minify !== false),
      generateGlobalCSS: config.output?.generateGlobalCSS !== false
    },
    verbose: options.verbose || config.verbose || false,
    breakpoints: config.breakpoints,
    debug: config.debug || false,
    timeline: config.timeline || false
  });

  const inspectorStore = new InspectorStore();
  
  const startTime = Date.now();
  let combinedCSS = '';
  let totalStyles = 0;
  let totalAtomicStyles = 0;
  let classFilesGenerated = 0;
  
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = path.relative(process.cwd(), file);
      logger.progress(i + 1, files.length, `Compiling ${relativePath}...`);
      
      try {
        const results = await compiler.compileFile(file);
        let fileCSS = '';
        const classMap: Record<string, string> = {};

        for (const [name, result] of Object.entries(results)) {
          if (result.css) fileCSS += result.css + '\n';
          const className = Object.values(result.classMap)[0];
          if (className) classMap[name] = className;
        }

        // Collect inspector IR data
        for (const [name, compileResult] of Object.entries(results)) {
          const inspector = (compileResult as any).inspector;
          if (inspector?.ir) {
            try {
              const rules = serializeForInspector(
                inspector.ir,
                inspector.pipelineReport || [],
                inspector.diagnostics || [],
                file,
                name
              );
              inspectorStore.addAll(rules);
            } catch (err) {
              // Silently skip if serialization fails
            }
          }
        }

        // Track stats
        for (const result of Object.values(results)) {
          totalStyles += result.stats?.totalStyles || 0;
          totalAtomicStyles += result.stats?.atomicStyles || 0;
        }

        // Generate .class.js file for each .chain.ts
        if (Object.keys(classMap).length > 0) {
          const baseName = path.basename(file).replace(/\.chain\.(ts|js|tsx|jsx)$/, '');
          const classFilePath = path.join(path.dirname(file), `${baseName}.class.js`);
          const classLines = [
            '/** ChainCSS Generated — DO NOT EDIT */',
            ''
          ];
          for (const [name, className] of Object.entries(classMap)) {
            // Check if this style has dynamic functions from compile result
            const result = results[name];
            if (result?.dynamic && Object.keys(result.dynamic).length > 0) {
              // Emit actual executable functions, not JSON strings
              const fnEntries: string[] = [];
              for (const [prop, fn] of Object.entries(result.dynamic)) {
                fnEntries.push(`${prop}: ${(fn as Function).toString()}`);
              }
              classLines.push(`export const ${name} = { className: '${className}', dynamic: { ${fnEntries.join(', ')} } };`);
            } else {
              classLines.push(`export const ${name} = '${className}';`);
            }
          }
          ensureDirectory(path.dirname(classFilePath));
          fs.writeFileSync(classFilePath, classLines.join('\n'), 'utf8');
          classFilesGenerated++;
          
          if (options.verbose || config.verbose) {
            logger.info(`  Generated ${path.relative(process.cwd(), classFilePath)}`);
          }
        }

        // Add to combined CSS
        if (fileCSS.trim()) {
          combinedCSS += `\n/* ${relativePath} */\n${fileCSS}`;
        }
        
      } catch (error) {
        logger.error(`Failed to compile ${relativePath}: ${(error as Error).message}`);
      }
    }
    
    // Write combined CSS file
    const cssOutputPath = path.join(outputDir, cssFileName);
    ensureDirectory(path.dirname(cssOutputPath));
    fs.writeFileSync(cssOutputPath, combinedCSS.trim(), 'utf8');

    // Write inspector IR data
    try {
      const irData = inspectorStore.export();
      if (irData && irData.rules && irData.rules.length > 0) {
        const irOutputPath = path.join(outputDir, 'chaincss-ir.json');
        ensureDirectory(path.dirname(irOutputPath));
        fs.writeFileSync(irOutputPath, JSON.stringify(irData, null, 2), 'utf8');
        logger.info(`📊 Inspector data: ${irData.rules.length} rules → ${path.relative(process.cwd(), irOutputPath)}`);
      } else {
        logger.info('No inspector data collected (IR may not be enabled)');
      }
    } catch (err) {
      // Inspector export is optional - don't fail the build
    }
    
    logger.progress(files.length, files.length, 'Complete!');
    logger.success(`Built ${files.length} file(s) in ${Date.now() - startTime}ms`);
    
    // Show stats
    if (totalStyles > 0 || classFilesGenerated > 0) {
      logger.info('Compilation statistics:');
      logger.table({
        'Total styles': totalStyles,
        'Atomic styles': totalAtomicStyles,
        'Standard styles': totalStyles - totalAtomicStyles,
        'CSS output': path.relative(process.cwd(), cssOutputPath),
        'Class files': classFilesGenerated,
      });
    }
    
  } catch (error) {
    logger.error(`Compilation failed: ${(error as Error).message}`);
    process.exit(1);
  }
  
  // Watch mode
  if (options.watch || config.watch) {
    logger.info('Watching for changes...');
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch(inputs, {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.chaincss-cache/**']
    });
    
    watcher.on('change', async (filePath: string) => {
      const ext = path.extname(filePath);
      if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
        logger.step(`Change detected: ${path.basename(filePath)}`);
        try {
          const results = await compiler.compileFile(filePath);
          let fileCSS = '';
          const classMap: Record<string, string> = {};

          for (const [name, result] of Object.entries(results)) {
            if (result.css) fileCSS += result.css + '\n';
            const className = Object.values(result.classMap)[0];
            if (className) classMap[name] = className;
          }

          // Regenerate .class.js
          if (Object.keys(classMap).length > 0) {
            const baseName = path.basename(filePath).replace(/\.chain\.(ts|js|tsx|jsx)$/, '');
            const classFilePath = path.join(path.dirname(filePath), `${baseName}.class.js`);
            const classLines = ['/** ChainCSS Generated — DO NOT EDIT */', ''];
            for (const [name, className] of Object.entries(classMap)) {
              const result = results[name];
              if (result?.dynamic && Object.keys(result.dynamic).length > 0) {
                const fnEntries: string[] = [];
                for (const [prop, fn] of Object.entries(result.dynamic)) {
                  fnEntries.push(`${prop}: ${(fn as Function).toString()}`);
                }
                classLines.push(`export const ${name} = { className: '${className}', dynamic: { ${fnEntries.join(', ')} } };`);
              } else {
                classLines.push(`export const ${name} = '${className}';`);
              }
            }
            ensureDirectory(path.dirname(classFilePath));
            fs.writeFileSync(classFilePath, classLines.join('\n'), 'utf8');
          }

          // Rewrite combined CSS (simplified — full rebuild)
          logger.info('File changed — run `chaincss build` to update combined CSS.');
        } catch (error) {
          logger.error(`Failed to recompile: ${(error as Error).message}`);
        }
      }
    });
    
    process.on('SIGINT', () => {
      logger.info('Stopping watch mode...');
      watcher.close();
      process.exit(0);
    });
  }
}