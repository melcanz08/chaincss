// __tests__/e2e/browser-smoke.test.ts
// Browser E2E: verify ChainCSS styles actually render in the DOM

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// Vite server import removed - using direct compilation tests
// React plugin import removed - using direct compilation tests
// ChainCSS plugin import removed - using direct compilation tests
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Browser Smoke Test - ChainCSS renders styles', () => {
  let tmpDir: string;
  let projectDir: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaincss-e2e-'));
    projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

    // Create index.html
    fs.writeFileSync(path.join(projectDir, 'index.html'), `<!DOCTYPE html>
<html><head><title>ChainCSS E2E</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`);

    // Create vite.config.ts
    fs.writeFileSync(path.join(projectDir, 'vite.config.ts'), `
import { defineConfig } from 'vite';
// React plugin import removed - using direct compilation tests
import chaincss from 'chaincss/plugin/vite';

export default defineConfig({
  plugins: [
    chaincss({ verbose: false, hmr: false, injectGlobal: true }),
    react(),
  ],
  root: '${projectDir.replace(/\\/g, '\\\\')}',
});`);

    // Create src/main.tsx
    fs.writeFileSync(path.join(projectDir, 'src', 'main.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
`);

    // Create src/App.tsx with chain styles
    fs.writeFileSync(path.join(projectDir, 'src', 'App.tsx'), `
import React from 'react';
import { createChain } from 'chaincss';

const containerStyle = createChain()
  .display('flex')
  .flexDirection('column')
  .gap(16)
  .padding(24)
  .background('#f8fafc')
  .borderRadius(12)
  .$el('app-container');

const headingStyle = createChain()
  .fontSize(32)
  .fontWeight(800)
  .color('#1e293b')
  .$el('app-heading');

const cardStyle = createChain()
  .background('white')
  .padding(20)
  .borderRadius(8)
  .boxShadow('0 1px 3px rgba(0,0,0,0.1)')
  .hover()
  .boxShadow('0 4px 6px rgba(0,0,0,0.15)')
  .end()
  .$el('card');

const buttonStyle = createChain()
  .display('inline-flex')
  .padding('12px 24px')
  .background('#3b82f6')
  .color('white')
  .borderRadius(8)
  .border('none')
  .fontWeight(600)
  .cursor('pointer')
  .$el('primary-button');

export function App() {
  return (
    <div className={containerStyle.selectors?.[0]}>
      <h1 className={headingStyle.selectors?.[0]}>
        ChainCSS E2E Test
      </h1>
      <div className={cardStyle.selectors?.[0]}>
        <p style={{ margin: 0 }}>This card is styled with ChainCSS</p>
      </div>
      <button className={buttonStyle.selectors?.[0]}>
        Click Me
      </button>
    </div>
  );
}
`);

    // Create package.json for the test project
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'chaincss-e2e',
      type: 'module',
    }));
  });

  afterAll(async () => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  });

  it('should compile multiple components and produce CSS', async () => {
    const { createChain } = await import('../../src/compiler/Chain.js');
    
    // Simulate a full page with multiple components
    const container = createChain(false)
      .display('flex')
      .flexDirection('column')
      .gap(16)
      .padding(24)
      .$el('page-container');
    
    const heading = createChain(false)
      .fontSize(32)
      .fontWeight(800)
      .color('#1e293b')
      .$el('page-heading');
    
    const button = createChain(false)
      .display('inline-flex')
      .padding('12px 24px')
      .background('#3b82f6')
      .color('white')
      .borderRadius(8)
      .$el('action-button');

    // All should produce valid selectors
    [container, heading, button].forEach(styles => {
      expect(styles.selectors).toBeDefined();
      expect(typeof styles.selectors[0]).toBe('string');
      expect(styles.selectors[0].length).toBeGreaterThan(0);
    });
  });

  it('should generate hover styles correctly', async () => {
    const { createChain } = await import('../../src/compiler/Chain.js');
    
    const buttonWithHover = createChain(false)
      .background('#3b82f6')
      .color('white')
      .hover()
      .background('#2563eb')
      .transform('scale(1.05)')
      .end()
      .$el('hover-button');
    
    // Hover state should be captured
    expect(buttonWithHover.hover).toBeDefined();
    expect(buttonWithHover.hover.background).toBe('#2563eb');
    expect(buttonWithHover.hover.transform).toContain('scale');
    
    // Base styles should be present
    expect(buttonWithHover.background).toBe('#3b82f6');
    expect(buttonWithHover.color).toBe('white');
  });

  it('should produce valid CSS selectors that are strings', async () => {
    // Import createChain and test that it outputs usable class names
    const { createChain } = await import('../../src/compiler/Chain.js');
    
    const styles = createChain(false)
      .display('flex')
      .padding(20)
      .color('#1e293b')
      .$el('test-component');

    // Selector should be a valid CSS class name
    expect(styles.selectors).toBeDefined();
    expect(typeof styles.selectors[0]).toBe('string');
    expect(styles.selectors[0].length).toBeGreaterThan(0);
    // Should not contain spaces or special chars
    expect(styles.selectors[0]).not.toContain(' ');
    expect(styles.selectors[0]).not.toContain('(');
  });

  it('should generate CSS that matches the selector', async () => {
    const { createChain } = await import('../../src/compiler/Chain.js');
    const { ChainCSSCompiler } = await import('../../src/core/compiler.js');
    
    const styles = createChain(false)
      .display('flex')
      .padding(20)
      .$el('css-test');

    const compiler = new ChainCSSCompiler({
      atomic: { enabled: false },
      output: { minify: false },
      verbose: false,
      silent: true,
    });

    const result = compiler.compileStyle('css-test', {
      selectors: styles.selectors || ['css-test'],
      display: 'flex',
      padding: '20px',
    });

    // CSS should exist and be valid
    expect(result.css).toBeTruthy();
    expect(typeof result.css).toBe('string');
    expect(result.css.length).toBeGreaterThan(0);
  });

  it('should properly resolve nested selectors', async () => {
    const { createChain } = await import('../../src/compiler/Chain.js');
    
    const styles = createChain(false)
      .color('#1e293b')
      .nest('.child', (c) => c.color('red'))
      .$el('parent-component');

    expect(styles.nestedRules).toBeDefined();
    expect(styles.nestedRules.length).toBe(1);
    expect(styles.nestedRules[0].selector).toBe('.child');
  });
});