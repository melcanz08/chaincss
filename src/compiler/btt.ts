import fs from 'fs';
import path from 'path';
import https from 'https';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
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

// ============================================================================
// Re-export Chain API from Chain.ts
// ============================================================================
export { setBreakpoints } from './breakpoints.js';
export { chain, enableDebug } from './Chain.js';

// ============================================================================
// Style Timeline / Diff Viewer
// ============================================================================

interface StyleSnapshot {
  id: string;
  timestamp: number;
  selector: string;
  styles: Record<string, any>;
  source: string;
  hash: string;
}

interface StyleChange {
  id: string;
  timestamp: number;
  selector: string;
  property: string;
  oldValue: any;
  newValue: any;
  type: 'add' | 'remove' | 'modify';
}

let styleHistory: StyleSnapshot[] = [];
let styleChanges: StyleChange[] = [];
let timelineEnabled = false;
let currentSnapshotId = 0;

// Enable/disable timeline tracking
export function enableTimeline(enable: boolean = true): void {
  timelineEnabled = enable;
  if (!enable) {
    styleHistory = [];
    styleChanges = [];
  }
}

export function getStyleHistory(): StyleSnapshot[] {
  return styleHistory;
}

export function getStyleChanges(): StyleChange[] {
  return styleChanges;
}

export function getStyleDiff(snapshotId1: string, snapshotId2: string): Record<string, any> {
  const snapshot1 = styleHistory.find(s => s.id === snapshotId1);
  const snapshot2 = styleHistory.find(s => s.id === snapshotId2);
  
  if (!snapshot1 || !snapshot2) {
    return { error: 'Snapshot not found' };
  }
  
  const diff: Record<string, any> = {
    added: {},
    removed: {},
    modified: {}
  };
  
  // Find added and modified properties
  for (const [key, value] of Object.entries(snapshot2.styles)) {
    if (!(key in snapshot1.styles)) {
      diff.added[key] = value;
    } else if (JSON.stringify(snapshot1.styles[key]) !== JSON.stringify(value)) {
      diff.modified[key] = {
        old: snapshot1.styles[key],
        new: value
      };
    }
  }
  
  // Find removed properties
  for (const [key, value] of Object.entries(snapshot1.styles)) {
    if (!(key in snapshot2.styles)) {
      diff.removed[key] = value;
    }
  }
  
  return diff;
}

function takeSnapshot(selector: string, styles: Record<string, any>, source: string): string {
  if (!timelineEnabled) return '';
  
  const hash = JSON.stringify(styles);
  const existing = styleHistory.find(s => s.selector === selector && s.hash === hash);
  if (existing) return existing.id;
  
  const id = `snapshot_${currentSnapshotId++}`;
  const snapshot: StyleSnapshot = {
    id,
    timestamp: Date.now(),
    selector,
    styles: { ...styles },
    source,
    hash
  };
  
  styleHistory.push(snapshot);
  
  const previousSnapshot = styleHistory.slice(-2)[0];
  if (previousSnapshot && previousSnapshot.selector === selector) {
    for (const [key, value] of Object.entries(styles)) {
      const oldValue = previousSnapshot.styles[key];
      if (!(key in previousSnapshot.styles)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          selector,
          property: key,
          oldValue: undefined,
          newValue: value,
          type: 'add'
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          selector,
          property: key,
          oldValue,
          newValue: value,
          type: 'modify'
        });
      }
    }
    
    for (const [key] of Object.entries(previousSnapshot.styles)) {
      if (!(key in styles)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          selector,
          property: key,
          oldValue: previousSnapshot.styles[key],
          newValue: undefined,
          type: 'remove'
        });
      }
    }
  }
  
  return id;
}

export function exportTimeline(): string {
  return JSON.stringify({
    history: styleHistory,
    changes: styleChanges,
    exportedAt: Date.now()
  }, null, 2);
}

export function clearTimeline(): void {
  styleHistory = [];
  styleChanges = [];
  currentSnapshotId = 0;
}

// ============================================================================
// Framework Component Generators
// ============================================================================

interface ComponentInfo {
  name: string;
  selector: string;
  styles: Record<string, any>;
  propsDefinition?: Record<string, any>;
  framework: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';
}

function detectFrameworkFromProject(): 'react' | 'vue' | 'svelte' | 'solid' {
  try {
    require.resolve('react/package.json');
    return 'react';
  } catch (e) {}
  try {
    require.resolve('vue/package.json');
    return 'vue';
  } catch (e) {}
  try {
    require.resolve('svelte/package.json');
    return 'svelte';
  } catch (e) {}
  try {
    require.resolve('solid-js/package.json');
    return 'solid';
  } catch (e) {}
  return 'react';
}

function generateReactComponent(info: ComponentInfo): string {
  const propsInterface = info.propsDefinition 
    ? Object.entries(info.propsDefinition)
        .map(([key, type]) => `  ${key}?: ${type};`)
        .join('\n')
    : '  [key: string]: any;';
  
  return `// Auto-generated by ChainCSS
import React from 'react';
import styles from './${info.name}.class.js';
import './${info.name}.css';

export interface ${info.name}Props {
  className?: string;
  children?: React.ReactNode;
${propsInterface}
}

export const ${info.name}: React.FC<${info.name}Props> = ({ 
  className, 
  children, 
  ...props 
}) => {
  const combinedClassName = [styles.${info.selector.replace(/^\./, '')}, className]
    .filter(Boolean)
    .join(' ');
    
  return (
    <div className={combinedClassName} {...props}>
      {children}
    </div>
  );
};

${info.name}.displayName = 'ChainCSS${info.name}';

export default ${info.name};
`;
}

function generateVueComponent(info: ComponentInfo): string {
  const propsDefinition = info.propsDefinition
    ? Object.entries(info.propsDefinition)
        .map(([key, type]) => `    ${key}: { type: ${type}, default: null },`)
        .join('\n')
    : '';
  
  return `<!-- Auto-generated by ChainCSS -->
<template>
  <component 
    :is="tag" 
    :class="combinedClass"
    v-bind="$attrs"
  >
    <slot />
  </component>
</template>

<script>
import styles from './${info.name}.class.js';
import './${info.name}.css';

export default {
  name: 'ChainCSS${info.name}',
  props: {
    tag: {
      type: String,
      default: 'div'
    },
    className: {
      type: String,
      default: ''
    },
${propsDefinition}
  },
  computed: {
    combinedClass() {
      return [styles.${info.selector.replace(/^\./, '')}, this.className]
        .filter(Boolean)
        .join(' ');
    }
  }
};
</script>
`;
}

function generateSvelteComponent(info: ComponentInfo): string {
  return `<!-- Auto-generated by ChainCSS -->
<script>
  import styles from './${info.name}.class.js';
  import './${info.name}.css';
  
  export let className = '';
  export let tag = 'div';
  
  $: combinedClass = [styles.${info.selector.replace(/^\./, '')}, className]
    .filter(Boolean)
    .join(' ');
</script>

<svelte:element this={tag} class={combinedClass}>
  <slot />
</svelte:element>
`;
}

function generateSolidComponent(info: ComponentInfo): string {
  return `// Auto-generated by ChainCSS
import { splitProps } from 'solid-js';
import styles from './${info.name}.class.js';
import './${info.name}.css';

export function ${info.name}(props) {
  const [local, others] = splitProps(props, ['class', 'children']);
  const combinedClass = () => [styles.${info.selector.replace(/^\./, '')}, local.class]
    .filter(Boolean)
    .join(' ');
    
  return (
    <div class={combinedClass()} {...others}>
      {local.children}
    </div>
  );
}
`;
}

// Main function to generate component code
export function generateComponentCode(info: ComponentInfo): string {
  let framework = info.framework;
  if (framework === 'auto') {
    framework = detectFrameworkFromProject();
  }
  
  switch (framework) {
    case 'react':
      return generateReactComponent(info);
    case 'vue':
      return generateVueComponent(info);
    case 'svelte':
      return generateSvelteComponent(info);
    case 'solid':
      return generateSolidComponent(info);
    default:
      return generateReactComponent(info);
  }
}

// ============================================================================
// Style Versioning / Source Maps
// ============================================================================

let enableSourceComments = true;

function getSourceLocation(): string | null {
  if (!enableSourceComments) return null;
  
  const stack = new Error().stack;
  if (!stack) return null;
  
  const stackLines = stack.split('\n');
  
  for (let i = 0; i < stackLines.length; i++) {
    const line = stackLines[i];
    const match = line.match(/([^/]+\.chain\.js):(\d+):\d+/);
    if (match) {
      const fileName = match[1];
      const lineNumber = match[2];
      return `${fileName}:${lineNumber}`;
    }
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
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout'));
    }, 3000);
    
    const req = https.get(url, (response) => {
      clearTimeout(timeout);
      let data = '';
      response.on('data', (chunk: string) => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

const loadCSSProperties = async (): Promise<string[]> => {
  if (chains.cachedValidProperties !== null && chains.cachedValidProperties.length > 0) {
    return chains.cachedValidProperties;
  }
  
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
    const baseProperties = new Set<string>();
    
    allProperties.forEach(prop => {
      const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
      baseProperties.add(baseProp);
    });
    
    chains.cachedValidProperties = Array.from(baseProperties).sort();
    return chains.cachedValidProperties;
    
  } catch (error) {
    chains.cachedValidProperties = COMMON_CSS_PROPERTIES;
    return chains.cachedValidProperties;
  }
};

// ============================================================================
// Chain Object & Properties
// ============================================================================

export interface ChainObject {
  cssOutput: string;
  cachedValidProperties: string[];
  classMap: Record<string, string>;
  atomicStats: any;
  componentMap?: Map<string, any>;
  initializeProperties: () => Promise<void>;
  getCachedProperties: () => string[] | null;
}

export const chains: ChainObject = {
  cssOutput: undefined as any,
  cachedValidProperties: [],
  classMap: {},
  atomicStats: null,

  async initializeProperties() {
    if (this.cachedValidProperties && this.cachedValidProperties.length > 0) {
      return;
    }
    const properties = await loadCSSProperties();
    this.cachedValidProperties = properties;
  },

  getCachedProperties() {
    return this.cachedValidProperties;
  }
};

let atomicOptimizer: AtomicOptimizer | null = null;

export function setAtomicOptimizer(optimizer: AtomicOptimizer | null): void {
  atomicOptimizer = optimizer;
}

export function configureAtomic(opts: Record<string, any>): void {
  if (atomicOptimizer) {
    Object.assign(atomicOptimizer.options, opts);
  }
}

// ============================================================================
// Tokens
// ============================================================================

export const tokens = originalToken;

export function createTokens(tokenValues: Record<string, any>): DesignTokens {
  const tokenObj = new DesignTokens(tokenValues);
  // Also set the token context in Chain.ts
  setTokenContext(tokenObj);
  return tokenObj;
}

// ============================================================================
// AT-Rule Processing
// ============================================================================

export interface AtRule {
  type: 'media' | 'keyframes' | 'font-face' | 'supports' | 'container' | 'layer' | 'counter-style' | 'property';
  query?: string;
  condition?: string;
  name?: string;
  styles?: any;
  steps?: Record<string, Record<string, string>>;
  properties?: Record<string, string>;
  descriptors?: Record<string, string>;
}

export interface NestedRule {
  selector: string;
  styles: Record<string, string | number>;
}

export interface ThemeBlock {
  name: string;
  styles: StyleDefinition;
  tokens: any;
  fallback: any;
}

export interface StyleDefinition {
  selectors: string[];
  hover?: Record<string, string | number>;
  atRules?: AtRule[];
  nestedRules?: NestedRule[];
  themes?: ThemeBlock[];
  [cssProperty: string]: any;
}

function processAtRule(rule: AtRule, parentSelectors: string[] | null = null): string {
  let output = '';
  
  switch(rule.type) {
    case 'media':
      output = `@media ${rule.query} {\n`;
      if (rule.styles && typeof rule.styles === 'object') {
        let ruleBody = '';
        for (const prop in rule.styles) {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          ruleBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
        }
        if (ruleBody.trim()) {
          const selector = (parentSelectors && parentSelectors.length > 0) 
            ? parentSelectors.join(', ') 
            : '.unknown-selector';
          const sourceLocation = getSourceLocation();
          if (enableSourceComments && sourceLocation) {
            output += `  /* Generated from: ${sourceLocation} */\n`;
          }
          output += `  ${selector} {\n${ruleBody}  }\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'keyframes':
      output = `@keyframes ${rule.name} {\n`;
      for (const step in rule.steps) {
        output += `  ${step} {\n`;
        for (const prop in rule.steps[step]) {
          if (prop !== 'selectors') {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            output += `    ${kebabKey}: ${rule.steps[step][prop]};\n`;
          }
        }
        output += '  }\n';
      }
      output += '}\n';
      break;
      
    case 'font-face':
      output = '@font-face {\n';
      for (const prop in rule.properties) {
        if (prop !== 'selectors') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
        }
      }
      output += '}\n';
      break;
      
    default:
      // Handle other AT-rules
      output = '';
      break;
  }
  
  return output;
}

// ============================================================================
// Run & Compile Functions
// ============================================================================

export const run = (...args: any[]): string => {
  // Validate inputs
  if (args.length === 0) return '';
  
  const validStyles = args.filter(value => value && typeof value === 'object');
  if (validStyles.length === 0) return '';
  
  let cssOutput = '';
  const styleObjs: any[] = [];

  args.forEach((value) => {
    if (!value) return;
    styleObjs.push(value);

    // Standalone at-rules (keyframes, etc.)
    if (value.type && !value.selectors) {
      cssOutput += processAtRule(value) + '\n';
      return;
    }

    if (value.selectors) {
      let mainRuleBody = '';
      let subRulesOutput = '';
      
      for (const key in value) {
        if (!value.hasOwnProperty(key)) continue;

        // Skip metadata and handled special keys
        if ([
          'selectors', 'atRules', 'hover', 'nestedRules', 'use', 'nest', 'themes',
          '_componentName', '_generateComponent', '_framework', '_propsDefinition'
        ].includes(key)) continue;

        // Handle AT-rules
        if (key === 'atRules' && Array.isArray(value[key])) {
          value[key].forEach((rule: any) => { 
            subRulesOutput += processAtRule(rule, value.selectors); 
          });
          continue;
        }

        // Handle Nested Rules
        if (key === 'nestedRules' && Array.isArray(value[key])) {
          value[key].forEach((rule: any) => {
            let nestedBody = '';
            for (const prop in rule.styles) {
              const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              nestedBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
            }
            if (nestedBody) {
              subRulesOutput += `${value.selectors.join(', ')} ${rule.selector} {\n${nestedBody}  }\n`;
            }
          });
          continue;
        }

        // Handle Hover State
        if (key === 'hover' && typeof value[key] === 'object') {
          let hoverBody = '';
          for (const hoverKey in value[key]) {
            const kebabKey = hoverKey.replace(/([A-Z])/g, '-$1').toLowerCase();
            hoverBody += `  ${kebabKey}: ${value[key][hoverKey]};\n`;
          }
          if (hoverBody) {
            subRulesOutput += `${value.selectors.join(', ')}:hover {\n${hoverBody}}\n`;
          }
          continue;
        }

        // Standard CSS Property
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        mainRuleBody += `  ${kebabKey}: ${value[key]};\n`;
      }
      
      if (mainRuleBody.trim()) {
        cssOutput += `${value.selectors.join(', ')} {\n${mainRuleBody}}\n`;
      }
      cssOutput += subRulesOutput;
    }
  });

  // Cleanup whitespace
  cssOutput = cssOutput.replace(/\n{3,}/g, '\n\n').trim();

  // Handle Atomic Optimization inside recipes/runs
  if (atomicOptimizer && atomicOptimizer.options.enabled) {
    const result = atomicOptimizer.optimize(styleObjs);
    return result.css;
  }
  
  return cssOutput;
};

function generateCSSFromCollected(collected: StyleDefinition[]): string {
  let css = '';
  for (const style of collected) {
    if (!style.selectors) continue;
    
    let normalStyles = '';
    let hoverStyles = '';
    
    for (const [key, value] of Object.entries(style)) {
      if (key === 'selectors') continue;
      
      if (key === 'hover' && typeof value === 'object') {
        for (const [hoverKey, hoverValue] of Object.entries(value)) {
          const kebabKey = hoverKey.replace(/([A-Z])/g, '-$1').toLowerCase();
          hoverStyles += `  ${kebabKey}: ${hoverValue};\n`;
        }
      } else {
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        normalStyles += `  ${kebabKey}: ${value};\n`;
      }
    }
    
    if (normalStyles) {
      css += `${style.selectors.join(', ')} {\n${normalStyles}}\n`;
    }
    if (hoverStyles) {
      css += `${style.selectors.join(', ')}:hover {\n${hoverStyles}}\n`;
    }
  }
  return css;
}

export const compile = (obj: Record<string, StyleDefinition>): string => {
  let cssString = '';
  const collected: StyleDefinition[] = [];
  const processedSelectors = new Set<string>();

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    const element = obj[key];

    if (element && (element as any).variants && typeof (element as any).compileAll === 'function') {
      const cleanKey = key.includes('_') ? key.split('_').pop() : key;
      const recipeOutput = (element as any).compileAll(cleanKey);
      cssString += recipeOutput + '\n';
      continue;
    }
    
    // 1. Basic Validation
    if (!element || !element.selectors || !element.selectors[0]) continue;

    const selectorKey = element.selectors.join(',');
    if (processedSelectors.has(selectorKey)) continue;
    
    processedSelectors.add(selectorKey);
    collected.push(element);

    const sourceLocation = getSourceLocation();
    let elementCSS = '';
    let subRulesCSS = '';

    // 2. Timeline Snapshot (Internal Debugging)
    if (timelineEnabled) {
      const styles: Record<string, any> = {};
      for (const prop in element) {
        if (!['selectors', 'atRules', 'hover', 'nestedRules', 'use', 'nest', 'themes'].includes(prop)) {
          styles[prop] = element[prop];
        }
      }
      takeSnapshot(element.selectors[0], styles, sourceLocation || 'unknown');
    }

    // 3. Process Standard CSS Properties
    for (const prop in element) {
      if (prop.startsWith('.') || prop.startsWith('&')) continue;
      // Skip metadata and special blocks
      if (['selectors', 'atRules', 'hover', 'use', 'nest', 'themes', 'nestedRules', '_componentName', '_generateComponent', '_framework'].includes(prop)) continue;
      if (prop.startsWith('_') || !element.hasOwnProperty(prop)) continue;

      const value = element[prop];
      if (value === undefined || value === null) continue;

      const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      elementCSS += `  ${kebabKey}: ${value};\n`;
    }

    // 4. Generate Main Selector Block
    if (elementCSS.trim()) {
      let block = `${element.selectors.join(', ')} {\n${elementCSS}}\n`;
      cssString += addSourceComment(block, sourceLocation);
    }

    // 5. Process Hover State
    if (element.hover && typeof element.hover === 'object') {
      let hoverBody = '';
      for (const hProp in element.hover) {
        const hKebab = hProp.replace(/([A-Z])/g, '-$1').toLowerCase();
        hoverBody += `  ${hKebab}: ${element.hover[hProp]};\n`;
      }
      if (hoverBody) {
        let block = `${element.selectors.join(', ')}:hover {\n${hoverBody}}\n`;
        cssString += addSourceComment(block, sourceLocation);
      }
    }

    // 5.5 Process Nested Selectors (The missing link!)
    for (const prop in element) {
      // If the property starts with . or &, it's a nested selector
      if ((prop.startsWith('.') || prop.startsWith('&')) && typeof element[prop] === 'object') {
        const subElement = element[prop];
        
        // Resolve selector: replace '&' with parent selector or prepend parent
        const parentSelector = element.selectors[0];
        const subSelector = prop.startsWith('&') 
          ? prop.replace('&', parentSelector) 
          : `${parentSelector} ${prop}`;

        // Recursively compile this sub-block
        // We wrap it in a mock StyleDefinition object so compile can eat it
        cssString += compile({
          [subSelector]: {
            selectors: [subSelector],
            ...subElement
          }
        }) + '\n';
      }
    }

    // 6. Process At-Rules (Media Queries, Keyframes)
    if (element.atRules && Array.isArray(element.atRules)) {
      element.atRules.forEach((rule: AtRule) => {
        subRulesCSS += processAtRule(rule, element.selectors);
      });
    }

    // 7. Process Themes
    if (element.themes && Array.isArray(element.themes)) {
      element.themes.forEach((theme: ThemeBlock) => {
        if (theme.styles) {
          let themeCSS = '';
          for (const tProp in theme.styles) {
            if (tProp === 'selectors') continue;
            const tKebab = tProp.replace(/([A-Z])/g, '-$1').toLowerCase();
            themeCSS += `  ${tKebab}: ${theme.styles[tProp]};\n`;
          }
          if (themeCSS) {
            let block = `${theme.styles.selectors?.join(', ') || element.selectors.join(', ')} {\n${themeCSS}}\n`;
            subRulesCSS += addSourceComment(block, sourceLocation);
          }
        }
      });
    }

    cssString += subRulesCSS;
  }

  // 8. Handle Atomic Optimization or Final Output
  if (atomicOptimizer && atomicOptimizer.options.enabled) {
    const result = atomicOptimizer.optimize(collected);
    chains.cssOutput = result.css;
    return result.css;
  }

  chains.cssOutput = cssString.trim();
  return chains.cssOutput;
};

// ============================================================================
// Recipe System
// ============================================================================

export interface RecipeOptions<TVariants extends Record<string, Record<string, any>>> {
  base?: StyleDefinition | (() => StyleDefinition);
  variants?: TVariants;
  defaultVariants?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
  compoundVariants?: Array<{
    variants: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
    style: StyleDefinition | (() => StyleDefinition);
  }>;
}

export type Recipe<TVariants extends Record<string, Record<string, any>>> = {
  (selection?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>): StyleDefinition;
  variants: TVariants;
  defaultVariants: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
  base: StyleDefinition;
  getAllVariants: () => Array<Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>>;
  compileAll: () => string;
  getVariantClassNames: () => Record<string, string>;
};

export function recipe<TVariants extends Record<string, Record<string, any>>>(
  options: RecipeOptions<TVariants>
): Recipe<TVariants> {
  const {
    base,
    variants = {} as TVariants,
    defaultVariants = {},
    compoundVariants = []
  } = options;

  const baseStyle = typeof base === 'function' ? (base as () => StyleDefinition)() : base;
  const variantStyles: Record<string, Record<string, StyleDefinition>> = {};
  
  for (const [variantName, variantMap] of Object.entries(variants)) {
    variantStyles[variantName] = {};
    for (const [variantKey, variantStyle] of Object.entries(variantMap as Record<string, any>)) {
      variantStyles[variantName][variantKey] = typeof variantStyle === 'function' 
        ? (variantStyle as () => StyleDefinition)() 
        : variantStyle;
    }
  }

  const compoundStyles = compoundVariants.map(cv => ({
    condition: cv.variants || cv,
    style: typeof cv.style === 'function' ? (cv.style as () => StyleDefinition)() : cv.style
  }));

  function mergeStyles(...styles: (StyleDefinition | undefined)[]): StyleDefinition {
    const merged: StyleDefinition = { selectors: [] } as StyleDefinition;
    for (const style of styles) {
      if (!style) continue;
      for (const [key, value] of Object.entries(style)) {
        if (key === 'selectors') {
          // Prevent duplicate selectors
          const newSelectors = Array.isArray(value) ? value : [value];
          merged.selectors = [...new Set([...(merged.selectors || []), ...newSelectors])];
        } else if (key === 'hover' && typeof value === 'object') {
          if (!merged.hover) merged.hover = {};
          Object.assign(merged.hover, value);
        } else if (key !== 'selectors') {
          (merged as any)[key] = value;
        }
      }
    }
    return merged;
  }

  function pick(variantSelection: Partial<Record<keyof TVariants, any>> = {}): StyleDefinition {
    const selected = { ...defaultVariants, ...variantSelection } as Record<string, any>;
    const stylesToMerge: StyleDefinition[] = [];
    
    if (baseStyle) stylesToMerge.push(baseStyle);
    for (const [variantName, variantValue] of Object.entries(selected)) {
      const variantStyle = variantStyles[variantName]?.[variantValue];
      if (variantStyle) stylesToMerge.push(variantStyle);
    }
    for (const cv of compoundStyles) {
      const matches = Object.entries(cv.condition).every(
        ([key, value]) => selected[key] === value
      );
      if (matches && cv.style) stylesToMerge.push(cv.style);
    }
    
    const merged = mergeStyles(...stylesToMerge);
    let styleBuilder: any = chain();
    
    for (const [prop, value] of Object.entries(merged)) {
      if (prop === 'selectors' || prop === 'hover') continue;
      if (styleBuilder[prop]) {
        styleBuilder = styleBuilder[prop](value);
      }
    }
    
    if (merged.hover) {
      styleBuilder = styleBuilder.hover();
      for (const [hoverProp, hoverValue] of Object.entries(merged.hover)) {
        if (styleBuilder[hoverProp]) {
          styleBuilder = styleBuilder[hoverProp](hoverValue);
        }
      }
      styleBuilder = styleBuilder.end();
    }
    
    const selectors = merged.selectors || [];
    return styleBuilder.$el(...selectors);
  }
  
  (pick as any).variants = variants;
  (pick as any).defaultVariants = defaultVariants;
  (pick as any).base = baseStyle;
  
  (pick as any).getAllVariants = (): Array<Partial<Record<keyof TVariants, any>>> => {
    const result: Array<Partial<Record<keyof TVariants, any>>> = [];
    const variantKeys = Object.keys(variants) as (keyof TVariants)[];
    
    function generate(current: Partial<Record<keyof TVariants, any>>, index: number): void {
      if (index === variantKeys.length) {
        result.push({ ...current });
        return;
      }
      const variantName = variantKeys[index];
      for (const variantValue of Object.keys(variants[variantName] as Record<string, any>)) {
        current[variantName] = variantValue as any;
        generate(current, index + 1);
      }
    }
    
    generate({}, 0);
    return result;
  };
  
  // Get class names for all variants (useful for component libraries)
  (pick as any).getVariantClassNames = (): Record<string, string> => {
    const allVariants = (pick as any).getAllVariants();
    const classNames: Record<string, string> = {};
    
    for (const variant of allVariants) {
      const variantKey = Object.entries(variant).map(([k, v]) => `${k}-${v}`).join('_');
      const styleDef = pick(variant);
      // Extract class name from selectors
      if (styleDef.selectors && styleDef.selectors[0]) {
        classNames[variantKey] = styleDef.selectors[0].replace(/^\./, '');
      }
    }
    
    return classNames;
  };
  
  (pick as any).compileAll = (): string => {
    const allVariants = (pick as any).getAllVariants();
    const styles: StyleDefinition[] = [];
    
    // Add base style
    if (baseStyle && baseStyle.selectors) {
      styles.push(baseStyle);
    }
    
    // Add all variant styles
    for (const variant of allVariants) {
      const styleDef = pick(variant);
      if (styleDef && styleDef.selectors) {
        styles.push(styleDef);
      }
    }
    
    // Also add individual variant styles for completeness
    for (const variantName of Object.keys(variants)) {
      for (const variantKey of Object.keys(variants[variantName])) {
        const variantStyle = variantStyles[variantName]?.[variantKey];
        if (variantStyle && variantStyle.selectors) {
          styles.push(variantStyle);
        }
      }
    }
    
    // Run compilation
    return run(...styles);
  };
  
  return pick as Recipe<TVariants>;
}

/**
 * The "Brain": Extracts ChainCSS calls from raw text
 */
export const scanContent = (text: string): string[] => {
  // FIXED: Better regex for matching nested parentheses
  const regex = /(?:chain|\$t?)\(((?:[^()]|\([^()]*\))*)\)(?:\s*\.\s*[a-zA-Z0-9]+\s*\([^)]*\))*/g;
  const matches = text.match(regex) || [];
  return matches.map(m => m.replace(/\s+/g, ''));
};

/**
 * The "Worker": Reads the file, uses the Brain, feeds the Optimizer
 */
export function scanFileForStyles(
  filePath: string, 
  optimizer: any, 
  source: string | null = null
): { foundCount: number; errors: Error[] } {
  const errors: Error[] = [];
  let foundCount = 0;
  
  try {
    const content = source !== null ? source : fs.readFileSync(filePath, 'utf8');
    if (!content || content.trim().length === 0) {
      return { foundCount: 0, errors };
    }

    // FIXED: Better regex that matches nested parentheses
    const styleRegex = /(?:chain|\$)\(((?:[^()]|\([^()]*\))*)\)/g;
    
    let match;
    
    while ((match = styleRegex.exec(content)) !== null) {
      try {
        const styleBody = match[1].trim();
        
        // Clean up quotes if it's a string inside the parens
        const cleanBody = styleBody.replace(/^['"`]|['"`]$/g, '');

        if (cleanBody) {
          // Feed into the optimizer
          if (optimizer && typeof optimizer.trackStyles === 'function') {
            optimizer.trackStyles([{ selectors: { '&': cleanBody } }]);
          }
          foundCount++;
        }
      } catch (parseError) {
        errors.push(parseError as Error);
        if (process.env.DEBUG) {
          console.error(`[Scanner] Parse error in ${filePath}:`, parseError);
        }
      }
    }
    
    if (foundCount > 0 && process.env.DEBUG) {
      console.log(chalk.magenta(`[Scanner] Found ${foundCount} styles in ${filePath}`));
    }
  } catch (err) {
    errors.push(err as Error);
    if (process.env.DEBUG) {
      console.error(`[Scanner] Error processing ${filePath}:`, err);
    }
  }
  
  return { foundCount, errors };
}

// Initialize properties (non-blocking)
chains.initializeProperties().catch((err: Error) => {
  if (process.env.DEBUG) {
    console.error('Failed to load CSS properties:', err.message);
  }
});

// Exports
export { atomicOptimizer, chains as chainObject };