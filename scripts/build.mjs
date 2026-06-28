#!/usr/bin/env node

// scripts/build.mjs

/**
 * Unified ChainCSS build script.
 * Replaces 7 separate esbuild commands with a single orchestrator.
 * 
 * Usage: node scripts/build.mjs [--watch]
 */

import { build, context } from 'esbuild';
import { writeFileSync, mkdirSync, chmodSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

const isWatch = process.argv.includes('--watch');

// ============================================================================
// Build Targets
// ============================================================================

const targets = [
  // Core library (Node.js ESM)
  {
    name: 'core',
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    platform: 'node',
    format: 'esm',
    external: ['vue', 'react', 'react-dom', 'svelte', 'url'],
    packages: 'external',
  },
  // Core library (CJS fallback)
  {
    name: 'core-cjs',
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.cjs',
    platform: 'node',
    format: 'cjs',
    external: ['vue', 'react', 'react-dom', 'svelte', 'url'],
    packages: 'external',
  },
  // CLI
  {
    name: 'cli',
    entryPoints: ['src/cli/index.ts'],
    outfile: 'dist/cli/index.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
    banner: { js: '#!/usr/bin/env node\n' },
    chmod: 0o755,
  },
  // Browser entry
  {
    name: 'browser',
    entryPoints: ['src/browser.ts'],
    outfile: 'dist/browser.js',
    platform: 'browser',
    format: 'esm',
    external: ['react', 'react-dom', 'vue', 'svelte', 'url'],
  },
  // Runtime
  {
    name: 'runtime',
    entryPoints: ['src/runtime/index.ts'],
    outfile: 'dist/runtime/index.js',
    platform: 'browser',
    format: 'esm',
    external: ['react', 'react-dom', 'vue', 'svelte', 'url'],
  },
  {
    name: 'runtime-cjs',
    entryPoints: ['src/runtime/index.ts'],
    outfile: 'dist/runtime/index.cjs',
    platform: 'browser',
    format: 'cjs',
    external: ['react', 'react-dom', 'vue', 'svelte', 'url'],
  },
  // Compiler (for programmatic use)
  {
    name: 'compiler',
    entryPoints: ['src/compiler/index.ts'],
    outfile: 'dist/compiler/index.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'compiler-cjs',
    entryPoints: ['src/compiler/index.ts'],
    outfile: 'dist/compiler/index.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  // Utilities (shorthands, macros, helpers, suggestions, animations, breakpoints)
  {
    name: 'utils',
    entryPoints: ['src/utils.ts'],
    outfile: 'dist/utils.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'utils-cjs',
    entryPoints: ['src/utils.ts'],
    outfile: 'dist/utils.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  // Plugins
  {
    name: 'plugin-vite',
    entryPoints: ['src/plugins/vite.ts'],
    outfile: 'dist/plugins/vite.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'plugin-vite-cjs',
    entryPoints: ['src/plugins/vite.ts'],
    outfile: 'dist/plugins/vite.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  {
    name: 'plugin-webpack',
    entryPoints: ['src/plugins/webpack.ts'],
    outfile: 'dist/plugins/webpack.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  // Advanced entry (for power users)
  {
    name: 'advanced',
    entryPoints: ['src/advanced.ts'],
    outfile: 'dist/advanced.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
];

// ============================================================================
// Build Runner
// ============================================================================

async function run() {
  // Clean
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  console.log('\uD83D\uDD28 Building ChainCSS...\n');

  if (isWatch) {
    // Watch mode: create contexts for incremental rebuilds
    const contexts = await Promise.all(
      targets.map(async (target) => {
        const ctx = await context({
          entryPoints: target.entryPoints,
          outfile: resolve(root, target.outfile),
          bundle: true,
          platform: target.platform,
          format: target.format,
          external: target.external || [],
          packages: target.packages || undefined,
          banner: target.banner,
          logLevel: 'info',
        });
        await ctx.watch();
        return ctx;
      })
    );
    console.log('\uD83D\uDC40 Watching for changes...\n');
  } else {
    // Single build
    for (const target of targets) {
      const outfile = resolve(root, target.outfile);
      mkdirSync(dirname(outfile), { recursive: true });

      try {
        await build({
          entryPoints: target.entryPoints,
          outfile,
          bundle: true,
          platform: target.platform,
          format: target.format,
          external: target.external || [],
          packages: target.packages || undefined,
          banner: target.banner,
          logLevel: 'warning',
        });

        // Set executable permission for CLI
        if (target.chmod) {
          chmodSync(outfile, target.chmod);
        }

        console.log(`  \u2705 ${target.name.padEnd(20)} \u2192 ${target.outfile}`);
      } catch (err) {
        console.error(`  \u274C ${target.name.padEnd(20)} \u2192 ${err.message}`);
        if (!isWatch) process.exit(1);
      }
    }

    console.log(`\n\u2728 Build complete! ${targets.length} targets built.`);
  }
}

run().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
