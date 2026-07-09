// src/cli/commands/dev.ts — Extension-driven, framework-agnostic dev server
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import type { DevOptions } from '../types.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const LIVE_RELOAD_SCRIPT = `<script>
(function() {
  if (window.__chaincss_reloading) return;
  var es = new EventSource('/__chaincss_reload');
  var debounce = null, connected = false;
  es.onopen = function() { connected = true; };
  es.onmessage = function() {
    if (!connected) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(function() { window.__chaincss_reloading = true; window.location.reload(); }, 150);
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

function getBundlerArgs(entry: string, outfile: string, deps: Record<string, string>): string[] {
  const ext = path.extname(entry);
  const args = ['esbuild', entry, '--bundle', `--outfile=${outfile}`, '--format=iife'];

  if (ext.endsWith('x') || deps['react'] || deps['solid-js']) {
    args.push('--jsx=transform');
    if (deps['solid-js']) args.push('--jsx-import-source=solid-js');
    if (deps['react']) args.push('--external:react', '--external:react-dom', '--external:react-dom/client');
  }
  if (deps['vue']) args.push('--external:vue');

  return args;
}

class ReloadDebouncer {
  private lastReload = 0; private timer: any = null; private pending = false;
  constructor(private cooldown = 2000) {}
  schedule(fn: () => void) {
    const now = Date.now(), elapsed = now - this.lastReload;
    if (elapsed >= this.cooldown) { this.lastReload = now; this.pending = false; fn(); }
    else if (!this.pending) { this.pending = true; this.timer = setTimeout(() => { this.lastReload = Date.now(); this.pending = false; fn(); }, this.cooldown - elapsed + 100); }
  }
  destroy() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
}

export async function devCommand(options: DevOptions): Promise<void> {
  const logger = createLogger(true);
  logger.header('ChainCSS Dev Server');

  const config = await loadConfig(options.config);
  const PORT = options.port || config.dev?.port || 3000;
  const publicDir = config.dev?.publicDir || '.';
  const distDir = typeof config.output === 'object' ? path.dirname(config.output.cssFile || 'dist/styles.css') : typeof config.output === 'string' ? config.output : 'dist';

  const entryFile = resolveEntry();
  const jsBundlePath = entryFile ? path.join(distDir, 'bundle.js') : null;
  const deps = getDeps();

  const locations = [path.join(process.cwd(), publicDir, 'index.html'), path.join(process.cwd(), 'index.html'), path.join(process.cwd(), 'public', 'index.html')];
  const indexHtml = locations.find(l => fs.existsSync(l)) || null;
  if (indexHtml) logger.info(`📄 Serving: ${path.relative(process.cwd(), indexHtml)}`);

  logger.info('🎨 Starting CSS compiler...');
  const cssWatcher = spawn('npx', ['chaincss', 'build', '--watch', ...(options.config ? ['--config', options.config] : [])], { stdio: ['inherit', 'pipe', 'pipe'], shell: true, env: { ...process.env, NODE_ENV: 'development' } });

  // Deterministic CSS-ready detection via filesystem polling
  const cssReady = new Promise<void>((resolve) => {
    if (!entryFile) return resolve();
    const artifact = path.join(process.cwd(), entryFile.replace(/\.(ts|js)x?$/, '.class.js'));
    const start = Date.now();
    function poll() {
      try { if (fs.existsSync(artifact) && fs.readFileSync(artifact, 'utf8').trim().length > 0) { logger.info(`✅ CSS ready`); return resolve(); } } catch {}
      if (Date.now() - start > 10000) return resolve();
      setTimeout(poll, 30);
    }
    poll();
  });

  let jsBuilt = false;
  function buildJS() {
    if (jsBuilt || !entryFile || !jsBundlePath) return;
    jsBuilt = true;
    const args = getBundlerArgs(entryFile, jsBundlePath, deps);
    logger.info(`📦 Building: ${entryFile} → ${jsBundlePath}`);
    const p = spawn('npx', args, { stdio: 'inherit', shell: true, env: { ...process.env, NODE_ENV: 'development' } });
    p.on('close', code => { if (code === 0) logger.info('✅ JS bundle built'); else logger.error(`JS build failed (exit code ${code})`); });
  }

  cssReady.then(() => buildJS());

  let reloadClients: ServerResponse[] = [];
  const debouncer = new ReloadDebouncer(3000);
  let watchPhase = false;

  function notify() { reloadClients = reloadClients.filter(c => { try { c.write('data: reload\n\n'); return true; } catch { return false; } }); }

  cssWatcher.stdout?.on('data', (d: Buffer) => {
    const o = d.toString(); process.stdout.write(o);
    if (o.includes('Watching for changes...')) setTimeout(() => { watchPhase = true; }, 1000);
    if (watchPhase && o.includes('Complete!')) debouncer.schedule(() => notify());
  });
  cssWatcher.stderr?.on('data', (d: Buffer) => process.stderr.write(d.toString()));

  const server = createServer((req, res) => {
    if (req.url === '/__chaincss_reload') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      reloadClients.push(res);
      req.on('close', () => { reloadClients = reloadClients.filter(c => c !== res); });
      return;
    }
    let url = req.url || '/'; if (url === '/') url = '/index.html';
    const lookups = [path.join(process.cwd(), publicDir, url), path.join(process.cwd(), url), path.join(process.cwd(), 'public', url), path.join(process.cwd(), distDir, ...url.split('/').filter(Boolean))];
    const fp = lookups.find(l => { try { return fs.existsSync(l) && fs.statSync(l).isFile(); } catch { return false; } }) || indexHtml;
    if (!fp) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(fp);
    try {
      let c = fs.readFileSync(fp);
      if (ext === '.html') c = Buffer.from(c.toString().replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`));
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(c);
    } catch { res.writeHead(500); res.end(); }
  });

  server.listen(PORT, () => console.log(`\n🚀 http://localhost:${PORT}\n`));

  const cleanup = () => { debouncer.destroy(); cssWatcher.kill(); server.close(); process.exit(0); };
  process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
}