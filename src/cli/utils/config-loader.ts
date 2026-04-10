/**
 * ChainCSS Configuration Loader
 * @module config-loader
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';
import type { ChainCSSConfig } from '../types.js';

const DEFAULT_CONFIG: any = {
  inputs: ['src/**/*.chain.js', 'src/**/*.chain.ts'],
  tokens: {
    enabled: true,
    prefix: 'chain'
  },
  atomic: {
    enabled: false,
    threshold: 3,
    naming: process.env.NODE_ENV === 'production' ? 'hash' : 'readable',
    minify: true,
    mode: 'hybrid',
    outputStrategy: 'component-first',
    verbose: false
  },
  prefixer: {
    enabled: true,
    mode: 'auto',
    browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
    sourceMap: true
  },
  output: {
    cssFile: 'styles.css',
    classMapFile: 'class-map.json',
    typesFile: 'classes.d.ts',
    minify: true,
    generateGlobalCSS: true
  },
  breakpoints: {
    sm: '(max-width: 640px)',
    md: '(min-width: 641px) and (max-width: 768px)',
    lg: '(min-width: 769px) and (max-width: 1024px)',
    xl: '(min-width: 1025px)',
    '2xl': '(min-width: 1280px)',
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)',
  },
  debug: false,
  sourceComments: true,
  timeline: false,
  framework: 'auto',
  namespace: 'chain',
  watch: false,
  verbose: false
};

export async function loadConfig(configPath?: string): Promise<ChainCSSConfig> {
  const logger = createLogger(false);
  
  const possiblePaths = configPath 
    ? [configPath]
    : [
        path.join(process.cwd(), 'chaincss.config.js'),
        path.join(process.cwd(), 'chaincss.config.ts'),
        path.join(process.cwd(), '.chaincssrc.js'),
        path.join(process.cwd(), 'chaincss.json')
      ];
  
  for (const configFile of possiblePaths) {
    if (fs.existsSync(configFile)) {
      try {
        logger.debug(`Loading config from ${configFile}`);
        
        if (configFile.endsWith('.json')) {
          const content = fs.readFileSync(configFile, 'utf8');
          const userConfig = JSON.parse(content);
          return mergeConfig(DEFAULT_CONFIG, userConfig);
        } else {
          const configModule = await import(`file://${configFile}`);
          const userConfig = configModule.default || configModule;
          return mergeConfig(DEFAULT_CONFIG, userConfig);
        }
      } catch (error) {
        logger.warn(`Failed to load config from ${configFile}:`, error);
      }
    }
  }
  
  logger.debug('No config file found, using defaults');
  return DEFAULT_CONFIG;
}

function mergeConfig(defaults: any, user: any): ChainCSSConfig {
  return {
    ...defaults,
    ...user,
    tokens: {
      ...defaults.tokens,
      ...user.tokens
    },
    atomic: {
      ...defaults.atomic,
      ...user.atomic
    },
    prefixer: {
      ...defaults.prefixer,
      ...user.prefixer
    },
    output: {
      ...defaults.output,
      ...user.output
    },
    breakpoints: {
      ...defaults.breakpoints,
      ...user.breakpoints
    }
  };
}

export function saveConfigTemplate(outputPath: string = 'chaincss.config.js', full: boolean = false): void {
  let template = '';
  
  if (full) {
    template = `/**
 * ChainCSS Configuration
 * @type {import('chaincss').ChainCSSConfig}
 * 
 * Documentation: https://chaincss.dev/docs/configuration
 */
export default {
  // ========== INPUT/OUTPUT ==========
  inputs: ['src/**/*.chain.js', 'src/**/*.chain.ts'],
  output: 'dist/styles',
  
  // ========== TOKENS ==========
  tokens: {
    enabled: true,
    prefix: 'chain'
  },
  
  // ========== ATOMIC CSS ==========
  atomic: {
    enabled: true,
    threshold: 3,
    naming: 'readable',
    minify: true,
    mode: 'hybrid',
    outputStrategy: 'component-first',
    verbose: false
  },
  
  // ========== AUTOPREFIXER ==========
  prefixer: {
    enabled: true,
    mode: 'auto',
    browsers: ['> 0.5%', 'last 2 versions', 'not dead'],
    sourceMap: true
  },
  
  // ========== OUTPUT OPTIONS ==========
  output: {
    cssFile: 'styles.css',
    classMapFile: 'class-map.json',
    typesFile: 'classes.d.ts',
    minify: true,
    generateGlobalCSS: true
  },
  
  // ========== RESPONSIVE BREAKPOINTS ==========
  breakpoints: {
    sm: '(max-width: 640px)',
    md: '(min-width: 641px) and (max-width: 768px)',
    lg: '(min-width: 769px) and (max-width: 1024px)',
    xl: '(min-width: 1025px)',
    '2xl': '(min-width: 1280px)',
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)'
  },
  
  // ========== DEBUG & TIMELINE ==========
  debug: false,
  sourceComments: true,
  timeline: false,
  
  // ========== FRAMEWORK ==========
  framework: 'auto',
  
  // ========== GENERAL ==========
  namespace: 'chain',
  watch: false,
  verbose: false
};
`;
  } else {
    template = `/**
 * ChainCSS Configuration
 * @type {import('chaincss').ChainCSSConfig}
 */
export default {
  inputs: ['src/**/*.chain.js', 'src/**/*.chain.ts'],
  output: 'dist/styles',
  atomic: {
    enabled: true,
    naming: 'readable',
    minify: true
  },
  prefixer: {
    enabled: true
  },
  breakpoints: {
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)'
  },
  debug: false,
  verbose: false
};
`;
  }
  
  fs.writeFileSync(outputPath, template, 'utf8');
}