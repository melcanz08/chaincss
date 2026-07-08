// src/cli/commands/dev.ts
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import type { DevOptions } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const LIVE_RELOAD_SCRIPT = `
<script>
(function() {
  // Only connect if not already reloading
  if (window.__chaincss_reloading) return;
  
  var es = new EventSource('/__chaincss_reload');
  var debounce = null;
  var connected = false;
  
  es.onopen = function() {
    connected = true;
  };
  
  es.onmessage = function() {
    if (!connected) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(function() {
      window.__chaincss_reloading = true;
      window.location.reload();
    }, 150);
  };
  
  es.onerror = function() {
    if (connected) {
      // Only close on actual errors after successful connection
      es.close();
    }
  };
})();
</script>
`;

// Files that should never trigger a reload
const IGNORED_FILES = [
  '.class.js',       // ChainCSS generated class maps
  'chaincss-ir.json', // Inspector data
  '.map',             // Source maps
];

// ============================================================================
// Framework Detection
// ============================================================================

interface FrameworkConfig {
  name: string;
  icon: string;
  entryPoints: string[];
  buildOnce: (entry: string, outfile: string) => { cmd: string; args: string[] };
}

const FRAMEWORKS: Record<string, FrameworkConfig> = {
  react: {
    name: 'React',
    icon: '⚛️',
    entryPoints: ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'src/App.tsx'],
    buildOnce: (entry, outfile) => ({
      cmd: 'npx',
      args: ['esbuild', entry, '--bundle', `--outfile=${outfile}`, '--jsx=automatic', '--sourcemap'],
    }),
  },
  'react-dom': {
    name: 'React',
    icon: '⚛️',
    entryPoints: ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx'],
    buildOnce: (entry, outfile) => ({
      cmd: 'npx',
      args: ['esbuild', entry, '--bundle', `--outfile=${outfile}`, '--jsx=automatic', '--sourcemap'],
    }),
  },
  vue: {
    name: 'Vue',
    icon: '💚',
    entryPoints: ['src/main.ts', 'src/main.js', 'src/index.ts', 'src/index.js'],
    buildOnce: (entry, outfile) => ({
      cmd: 'npx',
      args: ['esbuild', entry, '--bundle', `--outfile=${outfile}`, '--loader:.vue=vue', '--sourcemap'],
    }),
  },
  svelte: {
    name: 'Svelte',
    icon: '🧡',
    entryPoints: ['src/main.ts', 'src/main.js', 'src/index.ts', 'src/index.js'],
    buildOnce: (entry, outfile) => ({
      cmd: 'npx',
      args: ['esbuild', entry, '--bundle', `--outfile=${outfile}`, '--loader:.svelte=svelte', '--sourcemap'],
    }),
  },
  solid: {
    name: 'SolidJS',
    icon: '🔷',
    entryPoints: ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx'],
    buildOnce: (entry, outfile) => ({
      cmd: 'npx',
      args: ['esbuild', entry, '--bundle', `--outfile=${outfile}`, '--jsx=automatic', '--jsx-import-source=solid-js', '--sourcemap'],
    }),
  },
};

function detectFramework(): FrameworkConfig | null {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [key, config] of Object.entries(FRAMEWORKS)) {
      if (deps[key]) return config;
    }
    return null;
  } catch {
    return null;
  }
}

function findEntryPoint(entryPoints: string[]): string | null {
  for (const entry of entryPoints) {
    if (fs.existsSync(path.join(process.cwd(), entry))) return entry;
  }
  return null;
}

// ============================================================================
// Find index.html
// ============================================================================

function findIndexHtml(publicDir: string): string | null {
  const locations = [
    path.join(process.cwd(), publicDir, 'index.html'),
    path.join(process.cwd(), 'index.html'),
    path.join(process.cwd(), 'public', 'index.html'),
    path.join(process.cwd(), 'src', 'index.html'),
  ];
  for (const loc of locations) {
    if (fs.existsSync(loc)) return loc;
  }
  return null;
}

// ============================================================================
// File Change Debouncer
// ============================================================================

class ReloadDebouncer {
  private lastReload = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = false;
  private readonly cooldown: number;

  constructor(cooldownMs = 2000) {
    this.cooldown = cooldownMs;
  }

  schedule(fn: () => void): void {
    const now = Date.now();
    const elapsed = now - this.lastReload;

    if (elapsed >= this.cooldown) {
      // Enough time passed, execute immediately
      this.lastReload = now;
      this.pending = false;
      fn();
    } else {
      // Too soon, schedule for later
      if (!this.pending) {
        this.pending = true;
        const delay = this.cooldown - elapsed + 100;
        this.timer = setTimeout(() => {
          this.lastReload = Date.now();
          this.pending = false;
          fn();
        }, delay);
      }
    }
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// ============================================================================
// Dev Command
// ============================================================================

export async function devCommand(options: DevOptions): Promise<void> {
  const logger = createLogger(true);
  logger.header('ChainCSS Dev Server');

  // Load config
  const config = await loadConfig(options.config);
  const PORT = options.port || config.dev?.port || 3000;
  const publicDir = config.dev?.publicDir || '.';
  const distDir = typeof config.output === 'object'
    ? path.dirname(config.output.cssFile || 'dist/styles.css')
    : typeof config.output === 'string' ? config.output : 'dist';

  // Find entry HTML
  const indexHtml = findIndexHtml(publicDir);
  if (indexHtml) {
    logger.info(`📄 Serving: ${path.relative(process.cwd(), indexHtml)}`);
  } else {
    logger.warn('No index.html found. Create one at the project root.');
    logger.info('  https://chaincss.dev/docs');
  }

  // =========================================================================
  // 1. CSS Watcher (primary — always runs)
  // =========================================================================
  logger.info('🎨 Starting CSS compiler (watch mode)...');
  const buildArgs = ['chaincss', 'build', '--watch'];
  if (options.config) buildArgs.push('--config', options.config);

  const cssWatcher = spawn('npx', buildArgs, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });

  // =========================================================================
  // 2. Framework JS — Build Once (not watched)
  // =========================================================================
  const framework = detectFramework();
  let jsBundlePath: string | null = null;

  if (framework) {
    logger.info(`${framework.icon}  ${framework.name} detected`);
    const entry = findEntryPoint(framework.entryPoints);
    if (entry) {
      jsBundlePath = path.join(distDir, 'bundle.js');
      const { cmd, args } = framework.buildOnce(entry, jsBundlePath);
      logger.info(`📦 Building: ${entry} → ${jsBundlePath}`);
      
      // Build once — user runs their own watch for JS
      const buildProc = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, NODE_ENV: 'development' },
      });
      
      buildProc.on('close', (code) => {
        if (code === 0) {
          logger.info('✅ JS bundle built');
          logger.info('💡 To watch JS files, run a separate watcher:');
          logger.info(`   npx esbuild ${entry} --bundle --outfile=${jsBundlePath} --watch`);
        } else {
          logger.error(`JS build failed (exit code ${code})`);
        }
      });
    } else {
      logger.warn(`No entry point found. Expected: ${framework.entryPoints.join(', ')}`);
    }
  } else {
    logger.info('💡 CSS-only mode (no framework detected)');
  }

      // =========================================================================
  // 3. HTTP Server — Reload Logic
  // =========================================================================
  let reloadClients: ServerResponse[] = [];
  const reloadDebouncer = new ReloadDebouncer(3000); // 3 second cooldown
  let initialBuildDone = false;
  let watchPhaseStarted = false;

  function notifyClients(): void {
    reloadClients = reloadClients.filter(client => {
      try {
        client.write('data: reload\n\n');
        return true;
      } catch {
        return false;
      }
    });
  }

  // Trigger reloads ONLY from CSS compiler output during watch phase
  cssWatcher.stdout?.on('data', (data: Buffer) => {
    const output = data.toString();
    process.stdout.write(output);

    // Detect when initial build completes and watch phase begins
    if (output.includes('Watching for changes...')) {
      initialBuildDone = true;
      // Don't reload on the first watch-triggered build
      setTimeout(() => {
        watchPhaseStarted = true;
      }, 2000); // Give 2 seconds grace after watch starts
      return;
    }

    // Only reload during active watch phase (not initial build)
    if (watchPhaseStarted && output.includes('Complete!')) {
      reloadDebouncer.schedule(() => {
        notifyClients();
      });
    }
  });

  cssWatcher.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(data.toString());
  });

  // =========================================================================
  // Request Handler
  // =========================================================================
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // SSE endpoint
    if (req.url === '/__chaincss_reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      // DON'T send data on connect - just keep the connection open
      reloadClients.push(res);
      req.on('close', () => {
        reloadClients = reloadClients.filter(client => client !== res);
      });
      return;
    }

    // Normalize URL
    let url = req.url || '/';
    if (url === '/') url = '/index.html';

    // File lookup order: publicDir → root → public/ → dist/
    const locations = [
      path.join(process.cwd(), publicDir, url),
      path.join(process.cwd(), url),
      path.join(process.cwd(), 'public', url),
      path.join(process.cwd(), distDir, ...url.split('/').filter(Boolean)),
    ];

    let filePath: string | null = null;
    for (const loc of locations) {
      try {
        if (fs.existsSync(loc) && fs.statSync(loc).isFile()) {
          filePath = loc;
          break;
        }
      } catch { /* continue */ }
    }

    // SPA fallback
    if (!filePath && indexHtml) {
      filePath = indexHtml;
    }

    // 404
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;">
<h1>404</h1><p>Page not found</p>
<p><small>Create an index.html to get started.<br>
<a href="https://chaincss.dev/docs">ChainCSS Docs</a></small></p>
</body></html>`);
      return;
    }

    // Serve file
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      let content = fs.readFileSync(filePath);

      // Inject live reload into HTML
      if (ext === '.html') {
        content = Buffer.from(
          content.toString().replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`)
        );
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  });

  // =========================================================================
  // Start
  // =========================================================================
  server.listen(PORT, () => {
    const boxWidth = 46;
    const lines = [
      `╔${'═'.repeat(boxWidth)}╗`,
      `║  🚀  ChainCSS Dev Server${' '.repeat(boxWidth - 23)}║`,
      `║  📡  http://localhost:${PORT}${' '.repeat(boxWidth - 25 - String(PORT).length)}║`,
      `║${' '.repeat(boxWidth)}║`,
      `║  📁  Root:   ${(path.relative(process.cwd(), path.resolve(publicDir)) || '.').padEnd(boxWidth - 14)}║`,
      `║  📦  Output: ${distDir.padEnd(boxWidth - 14)}║`,
      `║${' '.repeat(boxWidth)}║`,
    ];

    if (framework) {
      lines.push(`║  ${framework.icon}   Framework: ${framework.name}${' '.repeat(boxWidth - 19 - framework.name.length)}║`);
      lines.push(`║  💡  JS changes: rebuild manually${' '.repeat(boxWidth - 28)}║`);
    }

    lines.push(
      `║  🎨  Edit .chain.ts → auto-reload${' '.repeat(boxWidth - 32)}║`,
      `║  🔍  Ctrl+Shift+I → Inspector${' '.repeat(boxWidth - 27)}║`,
      `║  🛑  Ctrl+C to stop${' '.repeat(boxWidth - 18)}║`,
      `╚${'═'.repeat(boxWidth)}╝`
    );

    console.log('\n' + lines.join('\n') + '\n');
  });

  // =========================================================================
  // Cleanup
  // =========================================================================
  const cleanup = () => {
    console.log('\n🛑 Shutting down...');
    reloadDebouncer.destroy();
    cssWatcher.kill();
    reloadClients.forEach(client => {
      try { client.end(); } catch (e) {}
    });
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (err) => {
    console.error('Fatal error:', err.message);
    cleanup();
  });
}