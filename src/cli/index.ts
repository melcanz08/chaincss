// src/cli/index.ts
import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { loadConfig } from './utils/config-loader.js';

// ============================================================================
// Path Resolution
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const findPackageJson = (startDir: string): string => {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (existsSync(pkgPath)) return pkgPath;
    currentDir = path.dirname(currentDir);
  }
  throw new Error('Could not find package.json');
};

const packageJsonPath = findPackageJson(__dirname);
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('chaincss')
  .description('ChainCSS - Zero-runtime CSS-in-JS Compiler')
  .version(packageJson.version, '-V, --version')
  .usage('[command] [options]')
  .helpOption('-h, --help', 'Display help for command');

// ============================================================================
// Dynamic Import for Compiler (avoids bundling top-level await)
// ============================================================================

const getCompiler = async (config?: any) => {
  const { ChainCSSCompiler } = await import('../core/compiler.js');
  return new ChainCSSCompiler(config);
};

// ============================================================================
// Error Handling
// ============================================================================

const handleError = (error: unknown, command: string): void => {
  console.error(chalk.red(`\n❌ Error running "${command}":`));
  if (error instanceof Error) {
    console.error(chalk.red(`   ${error.message}`));
    if (process.env.DEBUG) console.error(error.stack);
  } else {
    console.error(chalk.red(`   ${String(error)}`));
  }
  process.exit(1);
};

// ============================================================================
// Init Command
// ============================================================================

// ============================================================================
// Init Command (Generates the NEW Object-based config)
// ============================================================================
program
  .command('init')
  .description('Initialize ChainCSS configuration file')
  .option('-f, --force', 'Overwrite existing config file')
  .action(async (options) => {
    try {
      const configPath = 'chaincss.config.js';
      if (existsSync(configPath) && !options.force) {
        console.log(chalk.yellow('Config file already exists. Use --force to overwrite.'));
        return;
      }
      
      const config = `export default {
  inputs: ['src/**/*.chain.{js,ts}', 'src/**/*.tsx'],
  output: {
    cssFile: 'global.css',
    classMapFile: 'style',
    minify: false,
    generateGlobalCSS: true
  },
  atomic: {
    enabled: true,
    naming: 'hash',
    mode: 'hybrid'
  },
  verbose: true
};`;
      writeFileSync(configPath, config); 
      console.log(chalk.green('✓ Created chaincss.config.js with Object-based output.'));
    } catch (error) {
      handleError(error, 'init');
    }
  });

// ============================================================================
// Build Command
// ============================================================================
program
  .command('build')
  .option('-v, --verbose', 'Verbose output')
  .action(async (opts) => {
    try {
      const config = await loadConfig();
      const compiler = await getCompiler(config);
      
      console.log(chalk.blue('🚀 Starting ChainCSS Build...'));

      const patterns = config.inputs || ['src/**/*.chain.{js,ts}', 'src/**/*.tsx'];
      const files = await glob(patterns);
      
      // The compiler handles the logic we wrote earlier:
      // 1. Component CSS in src/components/<Name>/style/
      // 2. Global CSS in public/
      // 3. Manifest in src/manifest/
      await compiler.compileComponents(files);

      const stats = compiler.getStats();
      console.log(chalk.green(`\n✅ Build Complete!`));
      console.log(chalk.cyan(`📊 Atomic Rules: ${stats.atomicStyles}`));
    } catch (error) {
      handleError(error, 'build');
    }
  });

// ============================================================================
// Watch Command
// ============================================================================
program
  .command('watch')
  .description('Watch and automatically recompile styles')
  .action(async () => {
    try {
      const config = await loadConfig();
      const compiler = await getCompiler(config);
      const chokidar = await import('chokidar');
      
      const patterns = config.inputs || ['src/**/*.chain.{js,ts}', 'src/**/*.tsx'];
      const watcher = chokidar.watch(patterns, { ignored: '**/node_modules/**' });

      console.log(chalk.blue('📡 Watching for changes...'));

      watcher.on('change', async (filePath) => {
        console.log(chalk.yellow(`\r🔄 Change detected: ${path.basename(filePath)}`));
        const files = await glob(patterns);
        await compiler.compileComponents(files);
      });
    } catch (error) {
      handleError(error, 'watch');
    }
  });

// ============================================================================
// Timeline
// ============================================================================

program
  .command('timeline')
  .description('Manage style timeline')
  .argument('<action>', 'Action: list, diff, export, clear')
  .option('-s, --snapshot1 <id>', 'First snapshot ID or selector for diff')
  .option('--snapshot2 <id>', 'Second snapshot ID or selector for diff')
  .option('-o, --output <path>', 'Output file for export')
  .action(async (action, options) => {
    const { timelineCommand } = await import('./commands/timeline.js');
    await timelineCommand(action, options);
  });

// ============================================================================
// Help and Examples
// ============================================================================

program.on('--help', () => {
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  # Initialize a new project'));
  console.log('  $ chaincss init');
  console.log('');
  console.log(chalk.gray('  # Build all styles'));
  console.log('  $ chaincss build -c "src/**/*.chain.js"');
  console.log('');
  console.log(chalk.gray('  # Watch for changes'));
  console.log('  $ chaincss watch -c "src/**/*.chain.js"');
  console.log('');
  console.log(chalk.cyan('Documentation:'));
  console.log('  https://github.com/melcanz08/chaincss');
  console.log('');
});

// ============================================================================
// Cache
// ============================================================================

program
  .command('cache')
  .description('Manage persistent cache')
  .argument('<action>', 'Action: clear, stats, prune')
  .option('-v, --verbose', 'Verbose output')
  .action(async (action, options) => {
    const { cacheCommand } = await import('./commands/cache.js');
    await cacheCommand(action, options);
  });

// ============================================================================
// Parse Arguments
// ============================================================================

if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);

