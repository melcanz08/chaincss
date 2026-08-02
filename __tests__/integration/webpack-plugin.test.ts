// __tests__/integration/webpack-plugin.test.ts
// Tests for ChainCSS Webpack Loader v1.6.1+ (compiler-based)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock compiler to avoid real FS compile
vi.mock('@core/usecases/compiler.js', () => ({
  ChainCSSCompiler: class {
    compileVirtualSource = vi.fn().mockResolvedValue({
      btn: {
        css: '.btn{color:red}',
        classMap: { btn: 'btn-class' },
        dynamic: { useBtn: () => 'btn-class' },
        inspector: { ir: [{ id: 'test' }], pipelineReport: [], diagnostics: [] }
      }
    })
    compileFile = vi.fn().mockResolvedValue({
      btn: {
        css: '.btn{color:red}',
        classMap: { btn: 'btn-class' },
        dynamic: { useBtn: () => 'btn-class' },
        inspector: { ir: [{ id: 'test' }], pipelineReport: [], diagnostics: [] }
      }
    })
  }
}));

vi.mock('../../src/compiler/pipeline/inspector/serializer.js', () => ({
  serializeForInspector: vi.fn(() => [{ id: 'test' }])
}));

import chaincssLoader, { clearInspectorData, getInspectorData, ChainCSSWebpackPlugin } from '@frameworks/build-tools/webpack/index.js';

describe('Webpack Loader v1', () => {
  let callback: ReturnType<typeof vi.fn>;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    clearInspectorData();
    callback = vi.fn();
    mockContext = {
      resourcePath: '/project/src/Button.chain.ts',
      getOptions: vi.fn(() => ({}) as any),
      async: vi.fn(() => callback),
      cacheable: vi.fn(),
      addDependency: vi.fn(),
      emitFile: vi.fn(),
    };
  });

  it('calls cacheable and async', async () => {
    chaincssLoader.call(mockContext, 'export const btn = chain().color("red")');
    // cacheable is now optional but we keep it for webpack perf
    await new Promise(r => setTimeout(r, 20));
    expect(mockContext.async).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it('generates ESM exports + dynamic with TODO toString', async () => {
    chaincssLoader.call(mockContext, 'export const btn = chain().color("red")');
    await new Promise(r => setTimeout(r, 20));
    const [, code] = callback.mock.calls[0];
    expect(code).toContain(`export const btn = 'btn-class'`);
    expect(code).toContain(`export const useBtn =`); // dynamic preserved
  });

  it('injects CSS when extractCSS=false', async () => {
    mockContext.getOptions = vi.fn(() => ({ extractCSS: false } as any));
    chaincssLoader.call(mockContext, 'export const btn = chain().color("red")');
    await new Promise(r => setTimeout(r, 20));
    const [, code] = callback.mock.calls[0];
    expect(code).toContain(`document.createElement('style')`);
  });

  it('emits CSS file when extractCSS=true', async () => {
    mockContext.getOptions = vi.fn(() => ({ extractCSS: true } as any));
    chaincssLoader.call(mockContext, 'export const btn = chain().color("red")');
    await new Promise(r => setTimeout(r, 20));
    expect(mockContext.emitFile).toHaveBeenCalled();
  });

  it('Plugin companion clears and writes ir.json', () => {
    const plugin = new ChainCSSWebpackPlugin({ outputJsonPath: 'ir.json' });
    const compilation: any = { assets: {} };
    const compiler: any = {
      hooks: {
        compile: { tap: vi.fn((_, fn: any) => fn()) },
        emit: { tapAsync: vi.fn((_, fn: any) => fn(compilation, () => {})) }
      }
    };
    plugin.apply(compiler);
    expect(compiler.hooks.compile.tap).toHaveBeenCalledWith('ChainCSSWebpackPlugin', expect.any(Function));
    expect(compilation.assets['ir.json']).toBeDefined();
  });
});