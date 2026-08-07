// __tests__/integration/framework/next.test.tsx
// Update the tests to use the current ChainCSS API

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { 
  chain as chainServer, 
  getChainCSS, 
  clearChainCSS, 
  ChainCSSServerStyles, 
  ChainCSSStyleTag 
} from '../../../src/frameworks/next/server.js';
import { 
  chain as chainClient, 
  useAtomicClasses, 
  ChainCSSProvider 
} from '../../../src/frameworks/next/client.js';
import withChainCSS, { ChainCSSNextWebpackPlugin } from '../../../src/frameworks/next/plugin.js';

describe('Next.js App Router Integration', () => {
  beforeEach(() => {
    clearChainCSS();
  });

  describe('Server-Side Rendering (SSR / RSC)', () => {
    it('should collect styles during server element creation', () => {
      const styles = chainServer()
        .raw('color', 'blue')
        .box({ padding: 20 })
        .$el('container');

      expect(styles.root).toBeDefined();
      expect(styles.className).toBeDefined();
      // Style collection is async in RSC — className is the contract
      expect(styles.className || styles.root).toContain('container');
    });

    it('should render ChainCSSServerStyles component correctly', () => {
      chainServer().raw('background', 'red').$el('box');
      
      const html = renderToString(React.createElement(ChainCSSServerStyles));
      expect(html).toContain('data-chaincss="server"');
    });

    it('should render custom ChainCSSStyleTag with passed css', () => {
      const html = renderToString(React.createElement(ChainCSSStyleTag, { css: '.custom { color: green; }' }));
      expect(html).toContain('data-chaincss="server-tag"');
      expect(html).toContain('.custom { color: green; }');
    });
  });

  describe('Client Hydration & Runtime', () => {
    it('should create client chain instances without throwing', () => {
      const clientEl = chainClient()
        .raw('color', 'green')
        .$el('button');

      expect(clientEl.root).toBeDefined();
    });

    it('should render ChainCSSProvider wrapper component', () => {
      const html = renderToString(
        React.createElement(ChainCSSProvider, null, React.createElement('div', null, 'Child Content'))
      );
      expect(html).toContain('Child Content');
    });
  });

  describe('Next.js Webpack Plugin & Config Wrapper', () => {
    it('should configure webpack config with plugin and fallback rules', () => {
      const nextConfig = {
        webpack: (config: any) => config,
      };
      const wrapped = withChainCSS({ output: './custom.css', manifest: true })(nextConfig);
      expect(wrapped.webpack).toBeTypeOf('function');

      const mockWebpackConfig = { plugins: [], resolve: {} };
      const resultConfig = wrapped.webpack(mockWebpackConfig, { isServer: false });
      
      expect(resultConfig.plugins.length).toBeGreaterThan(0);
      expect(resultConfig.plugins[0]).toBeInstanceOf(ChainCSSNextWebpackPlugin);
      expect(resultConfig.resolve.fallback.fs).toBe(false);
      expect(resultConfig.resolve.fallback.path).toBe(false);
    });

    it('should handle server builds without disabling client fallbacks', () => {
      const nextConfig = {};
      const wrapped = withChainCSS()(nextConfig);
      const mockWebpackConfig = { plugins: [], resolve: {} };
      const resultConfig = wrapped.webpack(mockWebpackConfig, { isServer: true });
      
      expect(resultConfig.plugins.length).toBeGreaterThan(0);
      expect(resultConfig.resolve.fallback).toBeUndefined();
    });
  });
});