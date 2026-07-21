// __tests__/integration/cli.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CLI Commands', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaincss-cli-test-'));
    
    // Create a minimal project structure
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-cli-project',
      type: 'module',
    }));
    
    // Create a sample chain file
    fs.writeFileSync(path.join(tmpDir, 'src', 'styles.chain.ts'), `
import { createChain } from 'chaincss';

export const container = createChain(false)
  .display('flex')
  .flexDirection('column')
  .gap(16)
  .padding(24)
  .$el('container');

export const button = createChain(false)
  .display('inline-flex')
  .padding('12px 24px')
  .background('#3b82f6')
  .color('white')
  .borderRadius(8)
  .$el('button');
`);
  });

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  });

  function runCLI(args: string): { stdout: string; stderr: string; exitCode: number } {
    try {
      const cliPath = path.join(originalCwd, 'dist', 'cli', 'index.js');
      const stdout = execSync(`node ${cliPath} ${args} 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf8',
        timeout: 30000,
      });
      return { stdout, stderr: '', exitCode: 0 };
    } catch (e: any) {
      return {
        stdout: e.stdout || '',
        stderr: e.stderr || '',
        exitCode: e.status || 1,
      };
    }
  }

  describe('--help', () => {
    it('should display help without arguments', () => {
      const { stdout, exitCode } = runCLI('');
      expect(stdout).toContain('Usage');
      expect(stdout).toContain('chaincss');
    });

    it('should display help with --help', () => {
      const { stdout } = runCLI('--help');
      expect(stdout).toContain('Examples');
      expect(stdout).toContain('chaincss init');
      expect(stdout).toContain('chaincss build');
    });
  });

  describe('--version', () => {
    it('should display version', () => {
      const { stdout } = runCLI('--version');
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('init', () => {
    it('should create config file', () => {
      // Remove existing config if any
      const configPath = path.join(tmpDir, 'chaincss.config.js');
      if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

      const { stdout } = runCLI('init');
      expect(stdout).toContain('Created');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain('export default');
      expect(configContent).toContain('atomic');
      expect(configContent).toContain('inputs');
    });

    it('should warn if config exists', () => {
      const { stdout } = runCLI('init');
      expect(stdout).toContain('already exists');
    });

    it('should overwrite with --force', () => {
      const { stdout } = runCLI('init --force');
      expect(stdout).toContain('Created');
    });
  });

  describe('build', () => {
    it('should run build without crashing', () => {
      // Write a config file that matches our test project
      fs.writeFileSync(path.join(tmpDir, 'chaincss.config.js'), `
export default {
  inputs: ['src/**/*.chain.ts'],
  output: {
    cssFile: 'global.css',
    minify: false,
  },
  atomic: {
    enabled: false,
  },
  verbose: false,
  silent: true,
};
`);
      const { exitCode } = runCLI('build');
      expect(exitCode).toBe(0);
    });
  });
});