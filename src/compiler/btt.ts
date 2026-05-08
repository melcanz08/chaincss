// src/compiler/btt.ts
/**
 * ChainCSS Build-Time Compiler
 * Core compilation, AT-rules, CSS property loading, source maps
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import chalk from 'chalk';
import { tokens as originalToken, DesignTokens } from './tokens.js';
import { COMMON_CSS_PROPERTIES } from './commonProps.js';
import type { AtomicOptimizer } from './atomic-optimizer.js';
import { shorthandMap, handleShorthand } from './shorthands.js';
import { getSuggestion } from './suggestions.js';
import { resolveToken } from './token-resolver.js';
import { currentBreakpoints, setBreakpoints } from './breakpoints.js';
import { animationPresets, createAnimation } from './animations.js';
import { helpers } from './helpers.js';
import type { AnimationConfig } from './animations.js';
import { chain, setTokenContext } from './Chain.js';
import type { StyleDefinition } from '../core/types.js';
export type { StyleDefinition };
import { takeSnapshot as ts, isTimelineEnabled as timelineActive } from './timeline.js';

// ============================================================================
// Re-exports from split modules
// ============================================================================
export { setBreakpoints } from './breakpoints.js';
export { chain, enableDebug } from './Chain.js';

// Timeline
export {
  enableTimeline, getStyleHistory, getStyleChanges,
  getStyleDiff, exportTimeline, clearTimeline,
  takeSnapshot, isTimelineEnabled
} from './timeline.js';
export type { StyleSnapshot, StyleChange } from './timeline.js';

// Scanner
export { scanContent, scanFileForStyles } from './scanner.js';

// Recipe System
export { recipe } from './recipe.js';
export type { RecipeOptions, Recipe } from './recipe.js';

// Component Generator
export { generateComponentCode, detectFramework } from './component-generator.js';
export type { ComponentInfo } from './component-generator.js';

// ============================================================================
// Source Maps
// ============================================================================

let enableSourceComments = true;

function getSourceLocation(): string | null {
  if (!enableSourceComments) return null;
  const stack = new Error().stack;
  if (!stack) return null;
  for (const line of stack.split('\n')) {
    const match = line.match(/([^/]+\.chain\.js):(\d+):\d+/);
    if (match) return `${match[1]}:${match[2]}`;
  }
  return null;
}

export function setSourceComments(enabled: boolean): void {
  enableSourceComments = enabled;
}

function addSourceComment(css: string, sourceLocation: string | null): string {
  if (!enableSourceComments || !sourceLocation) return css;
  return `/* Generated from: ${sourceLocation} */\n${css}`;
}

// ============================================================================
// CSS Property Loading
// ============================================================================

const fetchWithHttps = (url: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { req.destroy(); reject(new Error('Request timeout')); }, 3000);
    const req = https.get(url, (response) => {
      clearTimeout(timeout);
      let data = '';
      response.on('data', (chunk: string) => data += chunk);
      response.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (error) { reject(error); }
      });
    });
    req.on('error', (error) => { clearTimeout(timeout); reject(error); });
  });
};

const loadCSSProperties = async (): Promise<string[]> => {
  if (chains.cachedValidProperties?.length > 0) return chains.cachedValidProperties;
  try {
    const url = 'https://raw.githubusercontent.com/mdn/data/main/css/properties.json';
    let data: any;
    if (typeof fetch !== 'undefined') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      data = await response.json();
    } else {
      data = await fetchWithHttps(url);
    }
    const allProperties = Object.keys(data);
    chains.cachedValidProperties = allProperties.map(p => p.replace(/^-(webkit|moz|ms|o)-/, '')).filter((v, i, a) => a.indexOf(v) === i).sort();
    return chains.cachedValidProperties;
  } catch {
    chains.cachedValidProperties = COMMON_CSS_PROPERTIES;
    return chains.cachedValidProperties;
  }
};

// ============================================================================
// Chain Object
// ============================================================================

export interface ChainObject {
  cssOutput: string;
  cachedValidProperties: string[];
  classMap: Record<string, string>;
  atomicStats: any;
  initializeProperties: () => Promise<void>;
  getCachedProperties: () => string[] | null;
}

export const chains: ChainObject = {
  cssOutput: undefined as any,
  cachedValidProperties: [],
  classMap: {},
  atomicStats: null,
  async initializeProperties() {
    if (this.cachedValidProperties?.length > 0) return;
    this.cachedValidProperties = await loadCSSProperties();
  },
  getCachedProperties() { return this.cachedValidProperties; }
};

let atomicOptimizer: AtomicOptimizer | null = null;
export function setAtomicOptimizer(optimizer: AtomicOptimizer | null): void { atomicOptimizer = optimizer; }
export function configureAtomic(opts: Record<string, any>): void {
  if (atomicOptimizer) Object.assign(atomicOptimizer.options, opts);
}

// ============================================================================
// Tokens
// ============================================================================

export const tokens = originalToken;
export function createTokens(tokenValues: Record<string, any>): DesignTokens {
  const tokenObj = new DesignTokens(tokenValues);
  setTokenContext(tokenObj);
  return tokenObj;
}

// ============================================================================
// Types
// ============================================================================

export interface AtRule {
  type: 'media' | 'keyframes' | 'font-face' | 'supports' | 'container' | 'layer' | 'counter-style' | 'property';
  query?: string; condition?: string; name?: string; styles?: any;
  steps?: Record<string, Record<string, string>>;
  properties?: Record<string, string>; descriptors?: Record<string, string>;
}

export interface NestedRule { selector: string; styles: Record<string, string | number>; }
export interface ThemeBlock { name: string; styles: StyleDefinition; tokens: any; fallback: any; }

// StyleDefinition imported from core/types.ts

// ============================================================================
// AT-Rule Processing
// ============================================================================

function processAtRule(rule: AtRule, parentSelectors: string[] | null = null): string {
  let output = '';
  switch (rule.type) {
    case 'media':
      output = `@media ${rule.query} {\n`;
      if (rule.styles && typeof rule.styles === 'object') {
        let body = '';
        for (const prop in rule.styles) body += `    ${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${rule.styles[prop]};\n`;
        if (body.trim()) {
          const sel = parentSelectors?.length ? parentSelectors.join(', ') : '.unknown-selector';
          output += `  ${sel} {\n${body}  }\n`;
        }
      }
      output += '}\n';
      break;
    case 'keyframes':
      output = `@keyframes ${rule.name} {\n`;
      for (const step in rule.steps) {
        output += `  ${step} {\n`;
        for (const prop in rule.steps[step]) {
          if (prop !== 'selectors') output += `    ${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${rule.steps[step][prop]};\n`;
        }
        output += '  }\n';
      }
      output += '}\n';
      break;
    case 'font-face':
      output = '@font-face {\n';
      for (const prop in rule.properties) {
        if (prop !== 'selectors') output += `  ${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${rule.properties[prop]};\n`;
      }
      output += '}\n';
      break;
  }
  return output;
}

// ============================================================================
// Compile & Run
// ============================================================================

export const run = (...args: any[]): string => {
  if (args.length === 0) return '';
  const validStyles = args.filter(v => v && typeof v === 'object');
  if (validStyles.length === 0) return '';
  
  let cssOutput = '';
  const styleObjs: any[] = [];
  
  args.forEach((value) => {
    if (!value) return;
    styleObjs.push(value);
    
    if (value.type && !value.selectors) { cssOutput += processAtRule(value) + '\n'; return; }
    if (!value.selectors) return;
    
    let mainBody = '', subOutput = '';
    for (const key in value) {
      if (!value.hasOwnProperty(key)) continue;
      if (['selectors','atRules','hover','nestedRules','use','nest','themes','_componentName','_generateComponent','_framework','_propsDefinition'].includes(key)) continue;
      
      if (key === 'atRules' && Array.isArray(value[key])) {
        value[key].forEach((r: any) => { subOutput += processAtRule(r, value.selectors); });
        continue;
      }
      if (key === 'nestedRules' && Array.isArray(value[key])) {
        value[key].forEach((r: any) => {
          let nb = '';
          for (const p in r.styles) nb += `    ${p.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${r.styles[p]};\n`;
          if (nb) subOutput += `${value.selectors.join(', ')} ${r.selector} {\n${nb}  }\n`;
        });
        continue;
      }
      if (key === 'hover' && typeof value[key] === 'object') {
        let hb = '';
        for (const hk in value[key]) hb += `  ${hk.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value[key][hk]};\n`;
        if (hb) subOutput += `${value.selectors.join(', ')}:hover {\n${hb}}\n`;
        continue;
      }
      mainBody += `  ${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value[key]};\n`;
    }
    if (mainBody.trim()) cssOutput += `${value.selectors.join(', ')} {\n${mainBody}}\n`;
    cssOutput += subOutput;
  });
  
  cssOutput = cssOutput.replace(/\n{3,}/g, '\n\n').trim();
  if (atomicOptimizer?.options.enabled) return atomicOptimizer.optimize(styleObjs).css;
  return cssOutput;
};

export const compile = (obj: Record<string, StyleDefinition>): string => {
  let cssString = '';
  const collected: StyleDefinition[] = [];
  const processedSelectors = new Set<string>();
  
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    const element = obj[key];
    
    if (element && (element as any).variants && typeof (element as any).compileAll === 'function') {
      cssString += (element as any).compileAll(key.includes('_') ? key.split('_').pop() : key) + '\n';
      continue;
    }
    if (!element?.selectors?.[0]) continue;
    
    const selectorKey = element.selectors.join(',');
    if (processedSelectors.has(selectorKey)) continue;
    processedSelectors.add(selectorKey);
    collected.push(element);
    
    const sourceLocation = getSourceLocation();
    let elementCSS = '', subRulesCSS = '';
    
    // Timeline snapshot
    if (timelineActive()) {
      const styles: Record<string, any> = {};
      for (const prop in element) {
        if (!['selectors','atRules','hover','nestedRules','use','nest','themes'].includes(prop)) styles[prop] = element[prop];
      }
      ts(element.selectors[0], styles, sourceLocation || 'unknown');
    }
    
    for (const prop in element) {
      if (prop.startsWith('.') || prop.startsWith('&')) continue;
      if (['selectors','atRules','hover','use','nest','themes','nestedRules','_componentName','_generateComponent','_framework'].includes(prop)) continue;
      if (prop.startsWith('_') || !element.hasOwnProperty(prop)) continue;
      const value = element[prop];
      if (value === undefined || value === null) continue;
      elementCSS += `  ${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};\n`;
    }
    
    if (elementCSS.trim()) cssString += addSourceComment(`${element.selectors.join(', ')} {\n${elementCSS}}\n`, sourceLocation);
    
    if (element.hover && typeof element.hover === 'object') {
      let hb = '';
      for (const hp in element.hover) hb += `  ${hp.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${element.hover[hp]};\n`;
      if (hb) cssString += addSourceComment(`${element.selectors.join(', ')}:hover {\n${hb}}\n`, sourceLocation);
    }
    
    for (const prop in element) {
      if ((prop.startsWith('.') || prop.startsWith('&')) && typeof element[prop] === 'object') {
        const parentSel = element.selectors[0];
        const subSel = prop.startsWith('&') ? prop.replace('&', parentSel) : `${parentSel} ${prop}`;
        cssString += compile({ [subSel]: { selectors: [subSel], ...element[prop] } }) + '\n';
      }
    }
    
    if (element.atRules && Array.isArray(element.atRules)) {
      element.atRules.forEach((rule: AtRule) => { subRulesCSS += processAtRule(rule, element.selectors); });
    }
    
    if (element.themes && Array.isArray(element.themes)) {
      element.themes.forEach((theme: ThemeBlock) => {
        if (theme.styles) {
          let tc = '';
          for (const tp in theme.styles) {
            if (tp === 'selectors') continue;
            tc += `  ${tp.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${theme.styles[tp]};\n`;
          }
          if (tc) subRulesCSS += addSourceComment(`${theme.styles.selectors?.join(', ') || element.selectors.join(', ')} {\n${tc}}\n`, sourceLocation);
        }
      });
    }
    
    cssString += subRulesCSS;
  }
  
  if (atomicOptimizer?.options.enabled) {
    const result = atomicOptimizer.optimize(collected);
    chains.cssOutput = result.css;
    return result.css;
  }
  
  chains.cssOutput = cssString.trim();
  return chains.cssOutput;
};

// ============================================================================
// Initialize
// ============================================================================

chains.initializeProperties().catch((err: Error) => {
  if (process.env.DEBUG) console.error('Failed to load CSS properties:', err.message);
});

export { atomicOptimizer, chains as chainObject };
