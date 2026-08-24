#!/usr/bin/env node

// scripts/build.mjs

/**
 * Unified ChainCSS build script.
 * Replaces separate esbuild commands with a single orchestrator.
 * Injects VERSION from package.json at build time.
 * 
 * Usage: node scripts/build.mjs [--watch]
 */

import { build, context } from 'esbuild';
import { writeFileSync, mkdirSync, chmodSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

const isWatch = process.argv.includes('--watch');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const __VERSION__ = pkg.version;

console.log(`📦 Building ChainCSS v${__VERSION__}\n`);

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
    entryPoints: ['src/adapters/cli/index.ts'],
    outfile: 'dist/cli/index.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
    banner: { js: '#!/usr/bin/env node\n' },
    chmod: 0o755,
  },
  // Browser entry — no banner, define only
  {
    name: 'browser',
    entryPoints: ['src/browser.ts'],
    outfile: 'dist/browser.js',
    platform: 'browser',
    format: 'esm',
    external: ["react", "react-dom", "vue", "svelte", "url", "fs", "fs/promises", "module", "path", "node:fs", "node:fs/promises", "node:path", "chalk"],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.CHAINCSS_METRICS': '"false"',
      'process.platform': '"browser"',
      'process.stdout': 'undefined',
      'process.stderr': 'undefined',
      'process.env.NO_COLOR': '"true"',
      'process.env.WT_SESSION': 'undefined',
      'process.env.TERM': 'undefined',
      'process.env.LANG': 'undefined',
    },
  },
  // Runtime (browser ESM) — no banner, define only
  {
    name: 'runtime',
    entryPoints: ['src/frameworks/index.ts'],
    outfile: 'dist/runtime/index.js',
    platform: 'browser',
    format: 'esm',
    external: ["react", "react-dom", "vue", "svelte", "url", "fs", "fs/promises", "module", "path", "chalk"],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.platform': '"browser"',
      'process.stdout': 'undefined',
      'process.stderr': 'undefined',
      'process.env.NO_COLOR': '"true"',
    },
  },
  // Runtime (browser CJS) — no banner, define only
  {
    name: 'runtime-cjs',
    entryPoints: ['src/frameworks/index.ts'],
    outfile: 'dist/runtime/index.cjs',
    platform: 'browser',
    format: 'cjs',
    external: ["react", "react-dom", "vue", "svelte", "url", "fs", "fs/promises", "module", "path", "chalk"],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.platform': '"browser"',
      'process.stdout': 'undefined',
      'process.stderr': 'undefined',
      'process.env.NO_COLOR': '"true"',
    },
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
  // Utilities
  {
    name: 'utils',
    entryPoints: ['src/shared/utils/index.ts'],
    outfile: 'dist/utils.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'utils-cjs',
    entryPoints: ['src/shared/utils/index.ts'],
    outfile: 'dist/utils.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  // Vite Plugin
  {
    name: 'plugin-vite',
    entryPoints: ['src/frameworks/build-tools/vite/index.ts'],
    outfile: 'dist/plugins/vite.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'plugin-vite-cjs',
    entryPoints: ['src/frameworks/build-tools/vite/index.ts'],
    outfile: 'dist/plugins/vite.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  // Webpack Plugin
  {
    name: 'plugin-webpack',
    entryPoints: ['src/frameworks/build-tools/webpack/index.ts'],
    outfile: 'dist/plugins/webpack.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'plugin-webpack-cjs',
    entryPoints: ['src/frameworks/build-tools/webpack/index.ts'],
    outfile: 'dist/plugins/webpack.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  // Advanced entry
  {
    name: 'advanced',
    entryPoints: ['src/advanced.ts'],
    outfile: 'dist/advanced.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  // Figma sync plugin
  {
    name: "figma-sync",
    entryPoints: ["src/frameworks/build-tools/figma-sync/index.ts"],
    outfile: "dist/plugins/figma-sync.js",
    platform: "node",
    format: "esm",
    packages: "external",
  },
  {
    name: "figma-sync-cjs",
    entryPoints: ["src/frameworks/build-tools/figma-sync/index.ts"],
    outfile: "dist/plugins/figma-sync.cjs",
    platform: "node",
    format: "cjs",
    packages: "external",
  },
  // Token entanglement engine
  {
    name: "entanglement",
    entryPoints: ["src/compiler/tokens/entanglement.ts"],
    outfile: "dist/compiler/tokens/entanglement.js",
    platform: "node",
    format: "esm",
    packages: "external",
  },
  {
    name: "entanglement-cjs",
    entryPoints: ["src/compiler/tokens/entanglement.ts"],
    outfile: "dist/compiler/tokens/entanglement.cjs",
    platform: "node",
    format: "cjs",
    packages: "external",
  },
  // Token API (clean platform integration)
  {
    name: "token-api",
    entryPoints: ["src/token-api.ts"],
    outfile: "dist/token-api.js",
    platform: "node",
    format: "esm",
    packages: "external",
  },
  {
    name: "token-api-cjs",
    entryPoints: ["src/token-api.ts"],
    outfile: "dist/token-api.cjs",
    platform: "node",
    format: "cjs",
    packages: "external",
  },
  // Next.js Server
  {
    name: 'next-server',
    entryPoints: ['src/frameworks/next/server.tsx'],
    outfile: 'dist/next/server.js',
    platform: 'node',
    format: 'esm',
    external: ['react', 'react-dom', 'fs', 'path'],
    packages: 'external',
  },
  {
    name: 'next-server-cjs',
    entryPoints: ['src/frameworks/next/server.tsx'],
    outfile: 'dist/next/server.cjs',
    platform: 'node',
    format: 'cjs',
    external: ['react', 'react-dom', 'fs', 'path'],
    packages: 'external',
  },
  // Next.js Client
  {
    name: 'next-client',
    entryPoints: ['src/frameworks/next/client.tsx'],
    outfile: 'dist/next/client.js',
    platform: 'browser',
    format: 'esm',
    external: ["react", "react-dom", "fs", "path", "crypto", "os", "events", "module", "url", "util", "stream", "jiti", "node:module", "node:fs", "node:path", "node:os", "node:url", "node:assert", "node:process", "node:v8", "node:util", "node:crypto", "node:tty", "node:fs/promises", "node:perf_hooks", "node:vm"],
  },
  {
    name: 'next-client-cjs',
    entryPoints: ['src/frameworks/next/client.tsx'],
    outfile: 'dist/next/client.cjs',
    platform: 'browser',
    format: 'cjs',
    external: ["react", "react-dom", "fs", "path", "crypto", "os", "events", "module", "url", "util", "stream", "jiti", "node:module", "node:fs", "node:path", "node:os", "node:url", "node:assert", "node:process", "node:v8", "node:util", "node:crypto", "node:tty", "node:fs/promises", "node:perf_hooks", "node:vm"],
  },
  // Next.js Plugin
  {
    name: 'next-plugin',
    entryPoints: ['src/frameworks/next/plugin.ts'],
    outfile: 'dist/next/plugin.js',
    platform: 'node',
    format: 'esm',
    external: ['fs', 'path', 'glob', 'webpack'],
    packages: 'external',
  },
  {
    name: 'next-plugin-cjs',
    entryPoints: ['src/frameworks/next/plugin.ts'],
    outfile: 'dist/next/plugin.cjs',
    platform: 'node',
    format: 'cjs',
    external: ['fs', 'path', 'glob', 'webpack'],
    packages: 'external',
  },
  // PostCSS Plugin
  {
    name: 'postcss',
    entryPoints: ['src/frameworks/build-tools/postcss/index.cjs'],
    outfile: 'dist/postcss/index.js',
    platform: 'node',
    format: 'esm',
    external: ['fs', 'path', 'glob', 'postcss'],
    packages: 'external',
  },
  {
    name: 'postcss-cjs',
    entryPoints: ['src/frameworks/build-tools/postcss/index.cjs'],
    outfile: 'dist/postcss/index.cjs',
    platform: 'node',
    format: 'cjs',
    external: ['fs', 'path', 'glob', 'postcss'],
    packages: 'external',
  },
  // Compiler entry
  {
    name: 'compiler-entry',
    entryPoints: ['src/compiler-entry.ts'],
    outfile: 'dist/compiler-entry.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'compiler-entry-cjs',
    entryPoints: ['src/compiler-entry.ts'],
    outfile: 'dist/compiler-entry.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  // Core entry
  {
    name: 'core-entry',
    entryPoints: ['src/core-entry.ts'],
    outfile: 'dist/core-entry.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'core-entry-cjs',
    entryPoints: ['src/core-entry.ts'],
    outfile: 'dist/core-entry.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  // Runtime entry
  {
    name: 'runtime-entry',
    entryPoints: ['src/runtime-entry.ts'],
    outfile: 'dist/runtime-entry.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'runtime-entry-cjs',
    entryPoints: ['src/runtime-entry.ts'],
    outfile: 'dist/runtime-entry.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
  // Utils entry
  {
    name: 'utils-entry',
    entryPoints: ['src/utils-entry.ts'],
    outfile: 'dist/utils-entry.js',
    platform: 'node',
    format: 'esm',
    packages: 'external',
  },
  {
    name: 'utils-entry-cjs',
    entryPoints: ['src/utils-entry.ts'],
    outfile: 'dist/utils-entry.cjs',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  },
    // Playground entry (browser-safe compiler bridge for the website playground)
  {
    name: 'playground-entry',
    entryPoints: ['src/playground-entry.ts'],
    outfile: 'dist/playground-entry.js',
    platform: 'browser',
    format: 'esm',
    external: ["react", "react-dom", "vue", "svelte", "url", "fs", "fs/promises", "module", "path", "node:fs", "node:fs/promises", "node:path", "chalk"],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.CHAINCSS_METRICS': '"false"',
      'process.platform': '"browser"',
      'process.stdout': 'undefined',
      'process.stderr': 'undefined',
      'process.env.NO_COLOR': '"true"',
      'process.env.WT_SESSION': 'undefined',
      'process.env.TERM': 'undefined',
      'process.env.LANG': 'undefined',
    },
  },
  {
    name: 'playground-entry-cjs',
    entryPoints: ['src/playground-entry.ts'],
    outfile: 'dist/playground-entry.cjs',
    platform: 'browser',
    format: 'cjs',
    external: ["react", "react-dom", "vue", "svelte", "url", "fs", "fs/promises", "module", "path", "node:fs", "node:fs/promises", "node:path", "chalk"],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.CHAINCSS_METRICS': '"false"',
      'process.platform': '"browser"',
      'process.stdout': 'undefined',
      'process.stderr': 'undefined',
      'process.env.NO_COLOR': '"true"',
      'process.env.WT_SESSION': 'undefined',
      'process.env.TERM': 'undefined',
      'process.env.LANG': 'undefined',
    },
  },
];

// ============================================================================
// Build Runner
// ============================================================================

async function run() {
  if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
  mkdirSync(dist, { recursive: true });

  console.log('🔨 Building ChainCSS...\n');

  if (isWatch) {
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
          define: {
            ...target.define,
            '__CHAINCSS_VERSION__': JSON.stringify(__VERSION__),
          },
          logLevel: 'info',
        });
        await ctx.watch();
        return ctx;
      })
    );

    writeFileSync(
      resolve(dist, 'package.json'),
      JSON.stringify({ type: 'module' }, null, 2)
    );

    console.log('👀 Watching for changes...\n');
  } else {
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
          define: {
            ...target.define,
            '__CHAINCSS_VERSION__': JSON.stringify(__VERSION__),
          },
          logLevel: 'warning',
        });

        if (target.chmod) {
          chmodSync(outfile, target.chmod);
        }

        console.log(`  ✅ ${target.name.padEnd(22)} → ${target.outfile}`);
      } catch (err) {
        console.log(`  ❌ ${target.name.padEnd(22)} → ${err.message}`);
        if (!isWatch) process.exit(1);
      }
    }

    writeFileSync(
      resolve(dist, 'package.json'),
      JSON.stringify({ type: 'module' }, null, 2)
    );

    console.log(`\n✨ Build complete! ${targets.length} targets built.`);
  }
}

run().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});