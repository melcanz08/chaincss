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

program
  .command('init')
  .description('Initialize ChainCSS configuration file')
  .option('-f, --force', 'Overwrite existing config file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (!existsSync('src')) mkdirSync('src', { recursive: true });
      if (!existsSync('src/styles')) mkdirSync('src/styles', { recursive: true });
      
      const configPath = 'chaincss.config.js';
      if (existsSync(configPath) && !options.force) {
        console.log(chalk.yellow('Config file already exists. Use --force to overwrite.'));
        return;
      }
      
      const config = `export default {
  // Look for .chain.js files in src/styles folders
  inputs: ['src/**/*.chain.js', 'src/**/styles/*.chain.js'],
  
  // Output class files next to source files (in the same folder)
  output: 'src',
  
  // Where to put the combined global.css
  globalOutput: 'src/global.css',
  
  verbose: true
  components: 'src/**/*.chain.js'
};`;
      writeFileSync(configPath, config); 
      
      console.log(chalk.green('✓ Created chaincss.config.js'));
    } catch (error) {
      handleError(error, 'init');
    }
  });

// ============================================================================
// Build Command
// ============================================================================

program
  .command('build')
  .description('Build all styles from configuration')
  .option('-c, --components <pattern>', 'Components pattern (glob)')
  .option('-v, --verbose', 'Verbose output')
  .option('-t, --timeline', 'Enable style timeline tracking')
  .action(async (opts) => {
    try {
      // Load config from chaincss.config.js
      const config = await loadConfig();
      
      const { ChainCSSCompiler } = await import('../core/compiler.js');
      // Update this line to pass the FULL config
      const compiler = new ChainCSSCompiler({
        tokens: config.tokens,
        atomic: config.atomic,
        prefixer: config.prefixer,
        breakpoints: (config as any).breakpoints,  // ← Add 'as any' here
        verbose: opts.verbose || config.verbose
      });
      
      let components: string[] = [];
      if (opts.components) {
        components = await glob(opts.components, {
          ignore: ['**/node_modules/**', '**/dist/**']
        });
        console.log(chalk.blue(`Found ${components.length} component(s):`));
        components.forEach(c => console.log(`  - ${c}`));
      } else if (config.inputs) {
        // Use inputs from config if no -c flag
        for (const pattern of config.inputs) {
          const matches = await glob(pattern, {
            ignore: ['**/node_modules/**', '**/dist/**']
          });
          components.push(...matches);
        }
        console.log(chalk.blue(`Found ${components.length} component(s) from config:`));
        components.forEach(c => console.log(`  - ${c}`));
      }
      
      await compiler.compileComponents(components);
      console.log(chalk.green('✅ Build complete'));
    } catch (error) {
      handleError(error, 'build');
    }
  });

// ============================================================================
// Watch Command
// ============================================================================

program
  .command('watch')
  .description('Watch and automatically recompile styles on changes')
  .option('-c, --components <pattern>', 'Components pattern (glob)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (opts) => {
    try {
      console.log(chalk.blue('👀 ChainCSS Watch Mode\n'));
      const config = await loadConfig();
      
      const chokidar = await import('chokidar');
      const compiler = await getCompiler({
        tokens: config.tokens,
        atomic: config.atomic,
        prefixer: config.prefixer,
        breakpoints: (config as any).breakpoints,
        verbose: opts.verbose || config.verbose
      });
      
      let components: string[] = [];
      if (opts.components) {
        components = await glob(opts.components, {
          ignore: ['**/node_modules/**', '**/dist/**']
        });
        console.log(`Found ${components.length} component(s):`);
        components.forEach(c => console.log(`  - ${c}`));
      } else if (config.inputs) {
        for (const pattern of config.inputs) {
          const matches = await glob(pattern, {
            ignore: ['**/node_modules/**', '**/dist/**']
          });
          components.push(...matches);
        }
        console.log(`Found ${components.length} component(s) from config:`);
        components.forEach(c => console.log(`  - ${c}`));
      }
      
      // Initial build
      await compiler.compileComponents(components);
      console.log(chalk.green('\n✓ Initial build complete'));
      console.log(chalk.blue('\n📡 Watching for changes...\n'));
      
      // Watch for changes
      const watcher = chokidar.watch(opts.components || config.inputs || 'src/**/*.chain.js', {
        ignored: ['**/node_modules/**', '**/dist/**'],
        persistent: true
      });
      
      let debounceTimer: NodeJS.Timeout;
      
      watcher.on('change', async (filePath: string) => {
        console.log(chalk.yellow(`📝 Changed: ${filePath}`));
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          console.log(chalk.blue('🔄 Rebuilding...'));
          await compiler.compileComponents(components);
          console.log(chalk.green('✅ Rebuild complete\n'));
        }, 100);
      });
      
      process.on('SIGINT', () => {
        console.log(chalk.blue('\n👋 Stopping watch mode...'));
        watcher.close();
        process.exit(0);
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
  .option('-s2, --snapshot2 <id>', 'Second snapshot ID or selector for diff')
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
// Parse Arguments
// ============================================================================

if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);