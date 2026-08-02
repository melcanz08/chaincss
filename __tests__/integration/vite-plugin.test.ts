// __tests__/integration/vite-plugin.test.ts
// Vite plugin integration tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, build } from 'vite';
import chaincssPlugin from '@frameworks/build-tools/vite/index.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Vite Plugin Integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaincss-vite-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createFixtureProject() {
    const projectDir = path.join(tmpDir, `project-${Date.now()}`);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      type: 'module',
    }));

    fs.writeFileSync(path.join(projectDir, 'vite.config.ts'), `
      import { defineConfig } from 'vite';
      import chaincss from 'chaincss/plugin/vite';
      
      export default defineConfig({
        plugins: [chaincss({ verbose: false, hmr: false })],
      });
    `);

    fs.writeFileSync(path.join(projectDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body><div id="app"></div></body>
      </html>
    `);

    fs.writeFileSync(path.join(projectDir, 'src', 'main.ts'), `
      import { createChain } from 'chaincss';
      
      const styles = createChain()
        .display('flex')
        .padding(20)
        .$el('container');
      
      console.log(styles);
    `);

    return projectDir;
  }

  describe('Plugin Creation', () => {
    it('should create a plugin instance', () => {
      const plugin = chaincssPlugin();
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('chaincss');
      expect(plugin.enforce).toBe('pre');
    });

    it('should accept options', () => {
      const plugin = chaincssPlugin({
        atomic: true,
        minify: true,
        verbose: false,
        hmr: false,
      });
      expect(plugin.name).toBe('chaincss');
    });

    it('should have required hooks', () => {
      const plugin = chaincssPlugin();
      expect(typeof plugin.resolveId).toBe('function');
      expect(typeof plugin.load).toBe('function');
      expect(typeof plugin.transform).toBe('function');
      expect(typeof plugin.buildStart).toBe('function');
      expect(typeof plugin.buildEnd).toBe('function');
    });
  });

  describe('Virtual Module Resolution', () => {
    it('should resolve virtual:chaincss.css', () => {
      const plugin = chaincssPlugin();
      const result = (plugin as any).resolveId('virtual:chaincss.css', '', { attributes: {}, isEntry: false });
      expect(result).toBe('\0virtual:chaincss.css');
    });

    it('should resolve virtual:chaincss-manifest', () => {
      const plugin = chaincssPlugin();
      const result = (plugin as any).resolveId('virtual:chaincss-manifest', '', { attributes: {}, isEntry: false });
      expect(result).toBe('\0virtual:chaincss-manifest');
    });

    it('should not resolve other modules', () => {
      const plugin = chaincssPlugin();
      const result = (plugin as any).resolveId('./some-file.ts', '', { attributes: {}, isEntry: false });
      expect(result).toBeNull();
    });
  });

  describe('Virtual Module Loading', () => {
    it('should load manifest module', () => {
      const plugin = chaincssPlugin();
      const result = (plugin as any).load('\0virtual:chaincss-manifest');
      expect(result).toBeDefined();
      expect(result).toContain('atomicMap');
    });

    it('should load CSS module', () => {
      const plugin = chaincssPlugin();
      const result = (plugin as any).load('\0virtual:chaincss.css');
      expect(result).toBeDefined();
    });
  });

  describe('File Processing', () => {
    it('should skip node_modules', async () => {
      const plugin = chaincssPlugin({ verbose: false });
      const result = await (plugin as any).transform!(
        'import x from "react"',
        '/project/node_modules/react/index.js'
      );
      expect(result).toBeNull();
    });

    it('should skip virtual modules', async () => {
      const plugin = chaincssPlugin({ verbose: false });
      const result = await (plugin as any).transform!(
        'test',
        '\0virtual:some-module'
      );
      expect(result).toBeNull();
    });

    it('should process source files', async () => {
      const plugin = chaincssPlugin({ verbose: false, hmr: false, injectGlobal: false });

      const source = `
        import { createChain } from 'chaincss';
        const styles = createChain().color('red').$el('test');
      `;

      const result = await (plugin as any).transform!(source, '/project/src/main.ts');
      expect(() => result).not.toThrow();
    });
  });

  describe('buildStart / buildEnd', () => {
    it('should handle buildStart without error', () => {
      const plugin = chaincssPlugin();
      expect(() => (plugin as any).buildStart!({} as any)).not.toThrow();
    });

    it('should handle buildEnd without error', () => {
      const plugin = chaincssPlugin();
      expect(() => (plugin as any).buildEnd!()).not.toThrow();
    });
  });
});