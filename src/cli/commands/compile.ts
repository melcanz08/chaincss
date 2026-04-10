// chaincss/src/cli/commands/compile.ts

import path from 'path';
import { ChainCSSCompiler } from '../../core/compiler.js';
import { createLogger } from '../utils/logger.js';
import { ensureDirectory, getOutputPath } from '../utils/file-utils.js';
import type { CompileOptions } from '../types.js';

export async function compileCommand(options: CompileOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  
  logger.header('ChainCSS Compiler');
  logger.info(`Input: ${options.input}`);
  logger.info(`Output: ${options.output}`);
  
  // Ensure output directory exists
  ensureDirectory(options.output);
  
  // Initialize compiler
  const compiler = new ChainCSSCompiler({
    atomic: {
      enabled: options.atomic !== false,
      minify: options.minify !== false,
      verbose: options.verbose
    },
    prefixer: {
      enabled: options.prefix !== false
    },
    output: {
      minify: options.minify !== false
    },
    verbose: options.verbose
  });
  
  const startTime = Date.now();
  
  try {
    // Check if input is a file or directory
    const fs = await import('fs');
    const isDirectory = fs.existsSync(options.input) && fs.statSync(options.input).isDirectory();
    
    if (isDirectory) {
      // Compile all .chain.js files in directory
      const { glob } = await import('glob');
      const files = glob.sync(`${options.input}/**/*.chain.{js,ts}`, {
        ignore: ['**/node_modules/**']
      });
      
      logger.step(`Found ${files.length} file(s) to compile`);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = path.relative(process.cwd(), file);
        logger.progress(i + 1, files.length, `Compiling ${relativePath}...`);
        
        const outputPath = getOutputPath(file, options.output);
        await compiler.compile(file, outputPath);
      }
      
      logger.progress(files.length, files.length, 'Complete!');
    } else {
      // Compile single file
      logger.step('Compiling...');
      const outputPath = getOutputPath(options.input, options.output);
      const result = await compiler.compile(options.input, outputPath);
      
      logger.success(`Compiled successfully in ${Date.now() - startTime}ms`);
      logger.divider();
      logger.table({
        'CSS file': path.basename(result.cssFile),
        'JS module': path.basename(result.jsFile),
        'Types': path.basename(result.typesFile),
        'Styles': Object.keys(result.results).length,
        'Size': `${(fs.statSync(result.cssFile).size / 1024).toFixed(2)} KB`
      });
    }
    
    // Watch mode
    if (options.watch) {
      logger.info('Watching for changes...');
      const chokidar = await import('chokidar');
      const watcher = chokidar.watch(options.input);
      
      watcher.on('change', async (filePath: string) => {
        logger.debug(`File changed: ${filePath}`);
        const outputPath = getOutputPath(filePath, options.output);
        await compiler.compile(filePath, outputPath);
        logger.success(`Recompiled ${path.basename(filePath)}`);
      });
    }
    
  } catch (error) {
    logger.error('Compilation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}