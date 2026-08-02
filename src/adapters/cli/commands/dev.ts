// ============================================================================
// FILE: src/adapters/cli/commands/dev.ts
// ChainCSS - Extension-Driven, Framework-Agnostic Dev Server
// ============================================================================

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createLogger } from "@shared/logger/index.js";
import { loadConfig } from "../utils/config-loader.js";
import type { DevOptions } from '../types.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

const LIVE_RELOAD_SCRIPT = `<script>
(function() {
  if (window.__chaincss_reloading) return;
  var es = new EventSource('/__chaincss_reload');
  var debounce = null, connected = false;
  es.onopen = function() { connected = true; console.log('[ChainCSS] Hot-reload channel established.'); };
  es.onmessage = function(e) {
    if (!connected || e.data === 'heartbeat') return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(function() { 
      window.__chaincss_reloading = true; 
      window.location.reload(); 
    }, 100);
  };
  es.onerror = function() { if (connected) es.close(); };
})();
</script>`;

const POTENTIAL_ENTRIES = [
  'src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js',
  'src/index.tsx', 'src/index.ts', 'src/index.jsx', 'src/index.js',
  'src/App.tsx', 'src/App.ts', 'src/App.jsx', 'src/App.js'
];

function resolveEntry(): string | null {
  for (const entry of POTENTIAL_ENTRIES) {
    if (fs.existsSync(path.join(process.cwd(), entry))) return entry;
  }
  return null;
}

function getDeps(): Record<string, string> {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch { return {}; }
}

/**
 * Safely guards against Path Traversal attacks (e.g., /../../etc/passwd)
 */
function isSafePath(target: string, safeRoot: string): boolean {
  const relative = path.relative(safeRoot, target);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function devCommand(options: DevOptions): Promise<void> {
  const logger = createLogger(true);
  logger.header('ChainCSS Dev Server');

  const config = await loadConfig(options.config);
  const PORT = options.port || config.dev?.port || 3000;
  const publicDir = config.dev?.publicDir || '.';
  const distDir = typeof config.output === 'object'
    ? path.dirname(config.output.cssFile || 'dist/styles.css')
    : typeof config.output === 'string' ? config.output : 'dist';

  const entryFile = resolveEntry();
  const jsBundlePath = entryFile ? path.join(distDir, 'bundle.js') : null;
  const deps = getDeps();
  const rootDir = process.cwd();

  const locations = [
    path.join(rootDir, publicDir, 'index.html'),
    path.join(rootDir, 'index.html'),
    path.join(rootDir, 'public', 'index.html')
  ];
  const indexHtml = locations.find(l => fs.existsSync(l)) || null;
  if (indexHtml) {
    logger.info(`📄 Serving entry-point: ${path.relative(rootDir, indexHtml)}`);
  }

  logger.info('🎨 Invoking CSS compiler watch engine...');

  // RESOLUTION FIX: Bypass slow shell/npx lookups by spawning the active Node binary directly
  // on your built local CLI entry point. This makes cold starts instantaneous.
  const cliEntryPoint = path.join(rootDir, 'dist', 'cli', 'index.js');
  const cssWatcher = spawn(
    process.execPath,
    [cliEntryPoint, 'build', '--watch', ...(options.config ? ['--config', options.config] : [])],
    {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env, NODE_ENV: 'development' }
    }
  );

  const cssReady = new Promise<void>((resolve) => {
    if (!entryFile) return resolve();
    const ext = path.extname(entryFile);
    const isTS = ext === '.ts' || ext === '.tsx';
    const artifactName = entryFile.replace(/\.(ts|js)x?$/, `.class.${isTS ? 'ts' : 'js'}`);
    const artifact = path.join(rootDir, artifactName);
    const start = Date.now();

    function poll() {
      try {
        if (fs.existsSync(artifact) && fs.readFileSync(artifact, 'utf8').trim().length > 0) {
          logger.info(`✅ CSS Ready (${path.basename(artifactName)})`);
          return resolve();
        }
      } catch {}
      if (Date.now() - start > 10000) {
        logger.warn(`⚠️ Timeout waiting for: ${path.basename(artifactName)}. Starting anyway.`);
        return resolve();
      }
      setTimeout(poll, 30);
    }
    poll();
  });

  // Client connection pool
  let reloadClients = new Set<ServerResponse>();
  let jsBuildError: string | null = null;
  let esbuildContext: any = null;

  const notifyReload = () => {
    for (const client of reloadClients) {
      try {
        // Only write if the connection socket is writable
        if (client.writable && !client.destroyed) {
          client.write('data: reload\n\n');
        }
      } catch {
        reloadClients.delete(client);
      }
    }
  };

  // Attempt programmatic load of esbuild for instant in-memory rebuilds
  let esbuild: any = null;
  try {
    esbuild = await import('esbuild');
  } catch {
    logger.warn('⚠️  esbuild dependency missing. Run: npm install -D esbuild');
  }

  async function initializeBundler() {
    if (!entryFile || !jsBundlePath || !esbuild) return;

    const ext = path.extname(entryFile);
    const isJSX = ext.endsWith('x') || deps['react'] || deps['solid-js'];

    try {
      esbuildContext = await esbuild.context({
        entryPoints: [entryFile],
        bundle: true,
        outfile: jsBundlePath,
        format: 'iife',
        sourcemap: 'inline',
        jsx: isJSX ? 'transform' : undefined,
        jsxImportSource: deps['solid-js'] ? 'solid-js' : undefined,
        external: [
          ...(deps['react'] ? ['react', 'react-dom', 'react-dom/client'] : []),
          ...(deps['vue'] ? ['vue'] : [])
        ],
        plugins: [{
          name: 'chaincss-bundler-logger',
          setup(build: any) {
            build.onStart(() => {
              logger.info(`📦 Compiling bundle: ${entryFile}`);
            });
            build.onEnd((result: any) => {
              if (result.errors.length > 0) {
                jsBuildError = result.errors.map((e: any) => `${e.text} (${e.location?.file}:${e.location?.line})`).join('\n');
                logger.error(`❌ Bundle Failed:\n${jsBuildError}`);
              } else {
                jsBuildError = null;
                logger.success('✅ JS Bundle compiled successfully');
              }
              notifyReload();
            });
          }
        }]
      });

      // Let esbuild natively watch application source changes (runs programmatically)
      await esbuildContext.watch();
    } catch (err) {
      logger.error(`Fatal: Failed to start bundling context: ${(err as Error).message}`);
    }
  }

  // Bind watch streams and output redirection
  cssWatcher.stdout?.on('data', (d: Buffer) => {
    const output = d.toString();
    process.stdout.write(output);

    // Notify reload clients only when CSS compiler outputs a successful compilation run
    if (output.includes('✓ Updated') || output.includes('Complete!')) {
      notifyReload();
    }
  });
  cssWatcher.stderr?.on('data', (d: Buffer) => process.stderr.write(d.toString()));

  // Start compilers sequentially
  cssReady.then(() => initializeBundler());

  const server = createServer((req, res) => {
    // ============================================================================
    // Live Reload Endpoint (SSE)
    // ============================================================================
    if (req.url === '/__chaincss_reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': ok\n\n');
      reloadClients.add(res);

      const heartbeat = setInterval(() => {
        try {
          if (res.writable && !res.destroyed) {
            res.write('data: heartbeat\n\n');
          } else {
            clearInterval(heartbeat);
            reloadClients.delete(res);
          }
        } catch {
          clearInterval(heartbeat);
          reloadClients.delete(res);
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(heartbeat);
        reloadClients.delete(res);
      });
      return;
    }

    // ============================================================================
    // Compiler Stats Endpoint
    // ============================================================================
    if (req.url === '/__chaincss_stats') {
      try {
        const cacheDir = path.join(rootDir, '.chaincss-cache', 'persistent');
        const projectHash = Buffer.from(rootDir).toString('base64').substring(0, 8);

        // Try multiple cache file patterns to find the state
        const possiblePaths = [
          path.join(cacheDir, `compiler-state-${projectHash}.json`),
          path.join(cacheDir, `compiler-state-${projectHash}`),
        ];

        // Also scan for any state files
        let stateFile: string | null = null;
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            stateFile = p;
            break;
          }
        }

        // Fallback: scan directory for matching files
        if (!stateFile && fs.existsSync(cacheDir)) {
          const entries = fs.readdirSync(cacheDir);
          const match = entries.find(e => e.startsWith(`compiler-state-${projectHash}`));
          if (match) {
            stateFile = path.join(cacheDir, match);
          }
        }

        let stats: any = {
          persistent: false,
          status: 'No persistent compiler state available',
          hint: 'Run `chaincss build --persistent` or `chaincss watch` to enable persistent mode',
        };

        if (stateFile) {
          const raw = fs.readFileSync(stateFile, 'utf8');
          const cached = JSON.parse(raw);
          stats = {
            persistent: true,
            totalCompiles: cached.stats?.totalCompiles ?? 0,
            incrementalCompiles: cached.stats?.incrementalCompiles ?? 0,
            fullCompiles: cached.stats?.fullCompiles ?? 0,
            totalRulesEver: cached.stats?.totalRulesEver ?? 0,
            currentLiveRules: cached.stats?.currentLiveRules ?? 0,
            averageRecompilePercent: cached.stats?.averageRecompilePercent ?? 100,
            compiledFiles: cached.compiledFiles?.length ?? 0,
            metadataEntries: cached.metadata?.length ?? 0,
            lastCompiledAt: cached.lastCompiledAt ?? null,
            uptime: cached.lastCompiledAt ? Date.now() - cached.lastCompiledAt : 0,
          };
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(stats, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Failed to read compiler stats',
          detail: (err as Error).message,
        }));
      }
      return;
    }

    // ============================================================================
    // Static File Serving
    // ============================================================================
    let url = req.url || '/';
    // Strip query parameters for correct file lookup
    const qIndex = url.indexOf('?');
    if (qIndex !== -1) {
      url = url.substring(0, qIndex);
    }
    if (url === '/') url = '/index.html';

    const lookups = [
      path.join(rootDir, publicDir, url),
      path.join(rootDir, url),
      path.join(rootDir, 'public', url),
      path.join(rootDir, distDir, ...url.split('/').filter(Boolean))
    ];

    const targetFile = lookups.find(l => {
      try {
        // SECURITY FIX: Ensure the file path doesn't break out of the workspace directory
        if (!isSafePath(l, rootDir)) return false;
        return fs.existsSync(l) && fs.statSync(l).isFile();
      } catch { return false; }
    }) || indexHtml;

    if (!targetFile) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(targetFile);
    try {
      let content = fs.readFileSync(targetFile);

      if (ext === '.html') {
        let html = content.toString();
        html = html.replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`);

        if (jsBuildError) {
          const banner = `<div style="position:fixed;top:0;left:0;right:0;background:#e11d48;color:white;padding:14px;font-family:monospace;font-size:13px;z-index:999999;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1);white-space:pre-wrap;">⚠️ JS Compilation Error:<br/>${jsBuildError.replace(/</g, '&lt;')}</div>`;
          html = html.replace('<body>', `<body>${banner}`);
        }
        content = Buffer.from(html);
      }

      // STREAM SAFETY FIX: Set explicitly computed response lengths to avoid truncation
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache, must-revalidate',
        'Content-Length': Buffer.byteLength(content).toString()
      });
      res.end(content);
    } catch {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });

  server.listen(PORT, () => {
    logger.success(`🚀 Development Server active: http://localhost:${PORT}`);
    logger.info(`📊 Compiler stats: http://localhost:${PORT}/__chaincss_stats`);
  });

  const cleanup = async () => {
    logger.info('Shutting down compilers and asset server...');
    cssWatcher.kill();
    if (esbuildContext) await esbuildContext.dispose();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}