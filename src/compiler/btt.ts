import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { tokens as originalToken, DesignTokens } from './tokens.js';
import { COMMON_CSS_PROPERTIES } from './commonProps.js';
import type { AtomicOptimizer } from './atomic-optimizer.js';


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

// Get style history
export function getStyleHistory(): StyleSnapshot[] {
  return styleHistory;
}

// Get style changes
export function getStyleChanges(): StyleChange[] {
  return styleChanges;
}

// Get diff between two snapshots
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

// Take a snapshot of current styles
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
  
  // Track changes compared to previous snapshot
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
    
    // Check for removed properties
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

// Export timeline data as JSON
export function exportTimeline(): string {
  return JSON.stringify({
    history: styleHistory,
    changes: styleChanges,
    exportedAt: Date.now()
  }, null, 2);
}

// Clear timeline
export function clearTimeline(): void {
  styleHistory = [];
  styleChanges = [];
  currentSnapshotId = 0;
}

// ============================================================================
// Suggestion Helper for Invalid Shorthands
// ============================================================================

// Simple Levenshtein distance for finding closest matches
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return matrix[b.length][a.length];
}

// Get suggestion for invalid shorthand or property
function getSuggestion(prop: string, validProperties: string[] = []): string {
  // Known shorthands
  const knownShorthands = Object.keys(shorthandMap);
  
  // Combine shorthands with common CSS properties
  const commonCSS = [
    'display', 'position', 'margin', 'padding', 'color', 'background',
    'background-color', 'border', 'border-radius', 'width', 'height',
    'font-size', 'font-weight', 'text-align', 'cursor', 'opacity',
    'z-index', 'overflow', 'flex', 'grid', 'gap', 'justify-content',
    'align-items', 'transition', 'transform', 'animation'
  ];
  
  const allKnown = [...knownShorthands, ...commonCSS, ...validProperties];
  const uniqueKnown = [...new Set(allKnown)];
  
  // Find closest match (max distance of 3)
  let bestMatch = '';
  let bestDistance = 4;
  
  for (const known of uniqueKnown) {
    const distance = levenshteinDistance(prop.toLowerCase(), known.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = known;
    }
  }
  
  if (bestMatch && bestDistance <= 3) {
    return bestMatch;
  }
  
  return '';
}

// ============================================================================
// Framework Component Generators (Build-time)
// ============================================================================

interface ComponentInfo {
  name: string;
  selector: string;
  styles: Record<string, any>;
  propsDefinition?: Record<string, any>;
  framework: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';
}

// Detect framework from project
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
  return 'react'; // default to react
}

// Generate React component
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

// Generate Vue component
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

// Generate Svelte component
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

// Generate Solid component
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

let enableSourceComments = true; // Enable/disable source comments in CSS

// Function to get current source location from stack trace
function getSourceLocation(): string | null {
  if (!enableSourceComments) return null;
  
  const stack = new Error().stack;
  if (!stack) return null;
  
  const stackLines = stack.split('\n');
  
  // Look for the .chain.js file in the stack trace
  for (let i = 0; i < stackLines.length; i++) {
    const line = stackLines[i];
    // Match pattern like: at file:///path/to/file.chain.js:15:10
    const match = line.match(/([^/]+\.chain\.js):(\d+):\d+/);
    if (match) {
      const fileName = match[1];
      const lineNumber = match[2];
      return `${fileName}:${lineNumber}`;
    }
  }
  
  return null;
}

// Function to enable/disable source comments
export function setSourceComments(enabled: boolean): void {
  enableSourceComments = enabled;
}

// Function to add source comment to CSS
function addSourceComment(css: string, sourceLocation: string | null): string {
  if (!enableSourceComments || !sourceLocation) return css;
  return `/* Generated from: ${sourceLocation} */\n${css}`;
}

// ============================================================================
// Animation Presets
// ============================================================================

// Pre-defined animation keyframes
const animationPresets: Record<string, Record<string, any>> = {
  fadeIn: {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 }
  },
  fadeOut: {
    '0%': { opacity: 1 },
    '100%': { opacity: 0 }
  },
  fadeInUp: {
    '0%': { opacity: 0, transform: 'translateY(20px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  fadeInDown: {
    '0%': { opacity: 0, transform: 'translateY(-20px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  fadeInLeft: {
    '0%': { opacity: 0, transform: 'translateX(-20px)' },
    '100%': { opacity: 1, transform: 'translateX(0)' }
  },
  fadeInRight: {
    '0%': { opacity: 0, transform: 'translateX(20px)' },
    '100%': { opacity: 1, transform: 'translateX(0)' }
  },
  slideInUp: {
    '0%': { transform: 'translateY(100%)' },
    '100%': { transform: 'translateY(0)' }
  },
  slideInDown: {
    '0%': { transform: 'translateY(-100%)' },
    '100%': { transform: 'translateY(0)' }
  },
  slideInLeft: {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(0)' }
  },
  slideInRight: {
    '0%': { transform: 'translateX(100%)' },
    '100%': { transform: 'translateX(0)' }
  },
  zoomIn: {
    '0%': { opacity: 0, transform: 'scale(0.8)' },
    '100%': { opacity: 1, transform: 'scale(1)' }
  },
  zoomOut: {
    '0%': { opacity: 1, transform: 'scale(1)' },
    '100%': { opacity: 0, transform: 'scale(0.8)' }
  },
  bounce: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-20px)' }
  },
  pulse: {
    '0%, 100%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.05)' }
  },
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '25%': { transform: 'translateX(-5px)' },
    '75%': { transform: 'translateX(5px)' }
  },
  rotate: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' }
  },
  spin: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' }
  },
  wiggle: {
    '0%, 100%': { transform: 'rotate(-3deg)' },
    '50%': { transform: 'rotate(3deg)' }
  },
  flip: {
    '0%': { transform: 'perspective(400px) rotateY(0)' },
    '100%': { transform: 'perspective(400px) rotateY(360deg)' }
  }
};

// Animation configuration interface
interface AnimationConfig {
  duration?: string;
  delay?: string;
  timing?: string;
  iteration?: string | number;
  direction?: string;
  fillMode?: string;
}

// Helper to create animation style
function createAnimation(animationName: string, config: AnimationConfig = {}): Record<string, any> {
  const duration = config.duration || '0.3s';
  const delay = config.delay || '0s';
  const timing = config.timing || 'ease';
  const iteration = config.iteration || 1;
  const direction = config.direction || 'normal';
  const fillMode = config.fillMode || 'both';
  
  return {
    animation: `${animationName} ${duration} ${timing} ${delay} ${iteration} ${direction}`,
    animationFillMode: fillMode
  };
}

// ============================================================================
// Math/Calc Helpers
// ============================================================================

// Calc helper for CSS calc() expressions
function calc(expression: string): string {
  return `calc(${expression})`;
}

// Math helpers that return calc() expressions
function add(a: string | number, b: string | number): string {
  return `calc(${a} + ${b})`;
}

function subtract(a: string | number, b: string | number): string {
  return `calc(${a} - ${b})`;
}

function multiply(a: string | number, b: string | number): string {
  return `calc(${a} * ${b})`;
}

function divide(a: string | number, b: string | number): string {
  return `calc(${a} / ${b})`;
}

// Percentage helpers
function percent(value: number): string {
  return `${value}%`;
}

function vw(value: number): string {
  return `${value}vw`;
}

function vh(value: number): string {
  return `${value}vh`;
}

function rem(value: number): string {
  return `${value}rem`;
}

function em(value: number): string {
  return `${value}em`;
}

function px(value: number): string {
  return `${value}px`;
}

// Min/Max helpers
function min(...values: (string | number)[]): string {
  return `min(${values.join(', ')})`;
}

function max(...values: (string | number)[]): string {
  return `max(${values.join(', ')})`;
}

function clamp(min: string | number, preferred: string | number, max: string | number): string {
  return `clamp(${min}, ${preferred}, ${max})`;
}

// Export helpers for use in chain API
const helpers = {
  calc,
  add,
  subtract,
  sub: subtract,  // alias
  multiply,
  mul: multiply,  // alias
  divide,
  div: divide,    // alias
  percent,
  vw,
  vh,
  rem,
  em,
  px,
  min,
  max,
  clamp,
};


// ============================================================================
// Chain API Debugging 
// ============================================================================

// Add this after the imports, near the top of the file
let debugMode = false;
let currentDebugSelector = '';

// Function to enable debug mode
function enableDebug(enable: boolean = true): void {
  debugMode = enable;
  if (debugMode) {
    console.log('🔍 ChainCSS Debug Mode Enabled');
  }
}

// ============================================================================
// Responsive Breakpoint Methods
// ============================================================================

// Add breakpoint presets at the top of chaincssv2 function
const DEFAULT_BREAKPOINTS = {
  mobile: '(max-width: 768px)',
  tablet: '(min-width: 769px) and (max-width: 1024px)',
  desktop: '(min-width: 1025px)',
  sm: '(max-width: 640px)',
  md: '(min-width: 641px) and (max-width: 768px)',
  lg: '(min-width: 769px) and (max-width: 1024px)',
  xl: '(min-width: 1025px)',
  '2xl': '(min-width: 1280px)',
};

// Global breakpoints configuration
let currentBreakpoints: Record<string, string> = DEFAULT_BREAKPOINTS;

// Function to set breakpoints from config
function setBreakpoints(breakpoints: Record<string, string>): void {
  currentBreakpoints = { ...DEFAULT_BREAKPOINTS, ...breakpoints };
}



// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types
export interface StyleDefinition {
  selectors: string[];
  hover?: Record<string, string | number>;
  atRules?: AtRule[];
  nestedRules?: NestedRule[];
  themes?: ThemeBlock[];
  [cssProperty: string]: any;
}

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

export interface ChainObject {
  cssOutput: string;
  catcher: any;
  cachedValidProperties: string[];
  classMap: Record<string, string>;
  atomicStats: any;
  componentMap?: Map<string, any>;
  initializeProperties: () => Promise<void>;
  getCachedProperties: () => string[] | null;
}

// Chain object (same as original)
export const chain: ChainObject = {
  cssOutput: undefined as any,
  catcher: {},
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

// Function to set the atomic optimizer from outside
export function setAtomicOptimizer(optimizer: AtomicOptimizer | null): void {
  atomicOptimizer = optimizer;
}

export function configureAtomic(opts: Record<string, any>): void {
  if (atomicOptimizer) {
    Object.assign(atomicOptimizer.options, opts);
  }
}

// Helper function for Node.js HTTP requests (for older Node versions)
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
  // Return cached if already loaded
  if (chain.cachedValidProperties !== null && chain.cachedValidProperties.length > 0) {
    return chain.cachedValidProperties;
  }
  
  // Try CDN first (only once) - same as runtime
  try {
    const url = 'https://raw.githubusercontent.com/mdn/data/main/css/properties.json';
    let data: any;
    
    // Use fetch if available (Node 18+), otherwise use https
    if (typeof fetch !== 'undefined') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      data = await response.json();
    } else {
      // Fallback for older Node versions
      data = await fetchWithHttps(url);
    }
    
    const allProperties = Object.keys(data);
    const baseProperties = new Set<string>();
    
    allProperties.forEach(prop => {
      const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
      baseProperties.add(baseProp);
    });
    
    chain.cachedValidProperties = Array.from(baseProperties).sort();
    return chain.cachedValidProperties;
    
  } catch (error) {
    // Use imported fallback (clean and separate)
    chain.cachedValidProperties = COMMON_CSS_PROPERTIES;
    return chain.cachedValidProperties;
  }
};

// Initialize properties (non-blocking)
chain.initializeProperties().catch((err: Error) => {
  console.error('Failed to load CSS properties:', err.message);
});

// Token pointer
export const tokens = originalToken;

let currentTokenContext: DesignTokens | null = null;

// Create tokens pointer
export function createTokens(tokenValues: Record<string, any>): DesignTokens {
  const tokenObj = new DesignTokens(tokenValues);
  currentTokenContext = tokenObj;
  return tokenObj;
}

// Resolve token helper
function resolveToken(value: any, useTokens: boolean, tokenContext: DesignTokens | null): any {
  if (!useTokens || typeof value !== 'string') return value;
  
  // Check if string contains any token patterns
  if (value.includes('$')) {
    // Replace all $token.path patterns with their resolved values
    return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match: string, path: string) => {
      if (tokenContext) {
        const resolved = tokenContext.get(path);
        if (resolved !== undefined) {
          return resolved;
        }
      }
      // Also try global tokens as fallback
      const globalResolved = tokens.get(path);
      if (globalResolved !== undefined) {
        return globalResolved;
      }
      return match; // Return original if not found
    });
  }
  
  return value;
}

// ============================================================================
// Shorthand Properties
// ============================================================================

// Mapping object for shorthand Properties
const shorthandMap: Record<string, string> = {
  // Layout
  'm': 'margin',
  'mt': 'marginTop',
  'mr': 'marginRight',
  'mb': 'marginBottom',
  'ml': 'marginLeft',
  'p': 'padding',
  'pt': 'paddingTop',
  'pr': 'paddingRight',
  'pb': 'paddingBottom',
  'pl': 'paddingLeft',
  
  // Display & Position
  'd': 'display',
  'pos': 'position',
  
  // Sizing
  'w': 'width',
  'h': 'height',
  'minW': 'minWidth',
  'maxW': 'maxWidth',
  'minH': 'minHeight',
  'maxH': 'maxHeight',
  
  // Colors & Background
  'bg': 'backgroundColor',
  'c': 'color',
  
  // Flexbox
  'flexDir': 'flexDirection',
  'flexWrap': 'flexWrap',
  'justify': 'justifyContent',
  'items': 'alignItems',
  'align': 'alignSelf',
  'gap': 'gap',
  'gapX': 'columnGap',
  'gapY': 'rowGap',
  
  // Grid
  'gridCols': 'gridTemplateColumns',
  'gridRows': 'gridTemplateRows',
  
  // Borders
  'rounded': 'borderRadius',
  'roundedT': 'borderTopLeftRadius',
  'roundedR': 'borderTopRightRadius',
  'roundedB': 'borderBottomRightRadius',
  'roundedL': 'borderBottomLeftRadius',
  'border': 'border',
  'borderW': 'borderWidth',
  'borderC': 'borderColor',
  
  // Typography
  'font': 'fontFamily',
  'text': 'color',
  'textAlign': 'textAlign',
  'textSize': 'fontSize',
  'weight': 'fontWeight',
  
  // Spacing (margin/padding shortcuts)
  'mx': 'marginHorizontal', // Need to handle this specially
  'my': 'marginVertical',   // Need to handle this specially
  'px': 'paddingHorizontal', // Need to handle this specially
  'py': 'paddingVertical',   // Need to handle this specially
};

// Also add special handlers for combined properties
const handleShorthand = (prop: string, value: any, catcher: Record<string, any>) => {
  // Handle mx (margin left + right)
  if (prop === 'mx') {
    catcher.marginLeft = value;
    catcher.marginRight = value;
    return true;
  }
  // Handle my (margin top + bottom)
  if (prop === 'my') {
    catcher.marginTop = value;
    catcher.marginBottom = value;
    return true;
  }
  // Handle px (padding left + right)
  if (prop === 'px') {
    catcher.paddingLeft = value;
    catcher.paddingRight = value;
    return true;
  }
  // Handle py (padding top + bottom)
  if (prop === 'py') {
    catcher.paddingTop = value;
    catcher.paddingBottom = value;
    return true;
  }
  return false;
};


// Chainable API
function chaincssv2(useTokens: boolean = true): any {
  const catcher: Record<string, any> = {};
  let validProperties = chain.cachedValidProperties;
  const tokenContext = currentTokenContext || null;

  // Helper function to create responsive method
  const createResponsiveMethod = (breakpointName: string, query: string) => {
    return function(callback: (css: any) => any): any {
      // Create a sub-chain for the responsive styles
      const subChain = chaincssv2(useTokens);
      let result = callback(subChain);
      
      // Auto-extract if needed
      if (result && typeof result.$el === 'function') {
        result = result.$el();
      }
      
      // Clean up result
      const { selectors, ...pureStyles } = result || {};
      
      // Add to atRules
      if (!catcher.atRules) catcher.atRules = [];
      catcher.atRules.push({
        type: 'media',
        query: query,
        styles: pureStyles
      });
      
      return proxy;
    };
  };

  const handler: ProxyHandler<object> = {
    get: (target: any, prop: string) => {

      // Handle .componentName() - set component name
      if (prop === 'componentName') {
        return (name: string) => {
          catcher._componentName = name;
          return proxy;
        };
      }

      // Handle .component() - generate framework component
      if (prop === 'component') {
        return (framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'auto') => {
          // Mark that this style should generate a component
          catcher._generateComponent = true;
          catcher._framework = framework || 'auto';
          return proxy;
        };
      }

      // Handle .props() - define component props interface
      if (prop === 'props') {
        return (propsDefinition: Record<string, any>) => {
          catcher._propsDefinition = propsDefinition;
          return proxy;
        };
      }

      // Handle .debug() - enables debug mode for this chain
      if (prop === 'debug') {
        return () => {
          debugMode = true;
          currentDebugSelector = '';
          return proxy;
        };
      }

      // Handle .debug('selector') - debug with specific selector
      if (prop === 'debugWith') {
        return (selector: string) => {
          debugMode = true;
          currentDebugSelector = selector;
          return proxy;
        };
      }

      // Handle .$el()
      if (prop === '$el') {
        return function(...args: string[]): any {
          if (args.length === 0) {
            const result = { ...catcher };
            Object.keys(catcher).forEach(key => delete catcher[key]);
            return result;
          }
          
          const selector = args[0];  // ← ADD THIS LINE - define selector
          const result = {
            selectors: args,
            ...catcher
          };
          
          // Debug output when $el is called
          if (debugMode) {
            const debugSelector = currentDebugSelector || selector;
            console.group(`🔍 ChainCSS Debug: ${debugSelector}`);
            console.log('📦 Selector:', selector);
            console.log('🎨 Styles:', catcher);
            
            // Log source location if available
            const stack = new Error().stack;
            if (stack) {
              const stackLines = stack.split('\n');
              for (let i = 3; i < Math.min(stackLines.length, 8); i++) {
                if (stackLines[i] && !stackLines[i].includes('btt.ts')) {
                  console.log('📍 Source:', stackLines[i].trim());
                  break;
                }
              }
            }
            console.groupEnd();
            
            // Reset debug after output
            debugMode = false;
            currentDebugSelector = '';
          }
          
          Object.keys(catcher).forEach(key => delete catcher[key]);
          return result;
        };
      }

      // ========== ANIMATION PRESETS ==========
      // Check if prop is an animation preset
      if (animationPresets[prop]) {
        return (config?: AnimationConfig) => {
          // Add keyframes to atRules
          if (!catcher.atRules) catcher.atRules = [];
          
          // Check if keyframes already added
          const hasKeyframes = catcher.atRules.some(
            (rule: any) => rule.type === 'keyframes' && rule.name === prop
          );
          
          if (!hasKeyframes) {
            catcher.atRules.push({
              type: 'keyframes',
              name: prop,
              steps: animationPresets[prop]
            });
          }
          
          // Apply animation properties
          const animationStyles = createAnimation(prop, config);
          Object.assign(catcher, animationStyles);
          
          return proxy;
        };
      }
      
      // Animation duration helper
      if (prop === 'duration') {
        return (value: string) => {
          if (catcher.animation) {
            // Replace duration in existing animation string
            catcher.animation = catcher.animation.replace(/(\d+(?:\.\d+)?(?:ms|s))/, value);
          } else {
            catcher.animationDuration = value;
          }
          return proxy;
        };
      }
      
      // Animation delay helper
      if (prop === 'delay') {
        return (value: string) => {
          if (catcher.animation) {
            // Insert delay into animation string
            const parts = catcher.animation.split(' ');
            parts.splice(3, 0, value);
            catcher.animation = parts.join(' ');
          } else {
            catcher.animationDelay = value;
          }
          return proxy;
        };
      }
      
      // Animation timing helper
      if (prop === 'timing') {
        return (value: string) => {
          if (catcher.animation) {
            catcher.animation = catcher.animation.replace(/(ease|linear|ease-in|ease-out|ease-in-out|cubic-bezier\([^)]+\))/, value);
          } else {
            catcher.animationTimingFunction = value;
          }
          return proxy;
        };
      }
      
      // Animation iteration helper
      if (prop === 'iteration') {
        return (value: string | number) => {
          if (catcher.animation) {
            catcher.animation = catcher.animation.replace(/\d+|infinite/, String(value));
          } else {
            catcher.animationIterationCount = value;
          }
          return proxy;
        };
      }
      
      // Infinite animation helper
      if (prop === 'infinite') {
        return () => {
          if (catcher.animation) {
            catcher.animation = catcher.animation.replace(/\d+/, 'infinite');
          } else {
            catcher.animationIterationCount = 'infinite';
          }
          return proxy;
        };
      }

      // Custom animation method
      if (prop === 'animate') {
        return (name: string, keyframes: Record<string, any>, config?: AnimationConfig) => {
          if (!catcher.atRules) catcher.atRules = [];
          
          catcher.atRules.push({
            type: 'keyframes',
            name: name,
            steps: keyframes
          });
          
          const animationStyles = createAnimation(name, config);
          Object.assign(catcher, animationStyles);
          
          return proxy;
        };
      }

      // Return helpers if accessed via $.calc, $.add, etc.
      if (prop === 'calc') return helpers.calc;
      if (prop === 'add') return helpers.add;
      if (prop === 'subtract' || prop === 'sub') return helpers.subtract;
      if (prop === 'multiply' || prop === 'mul') return helpers.multiply;
      if (prop === 'divide' || prop === 'div') return helpers.divide;
      if (prop === 'percent') return helpers.percent;
      if (prop === 'vw') return helpers.vw;
      if (prop === 'vh') return helpers.vh;
      if (prop === 'rem') return helpers.rem;
      if (prop === 'em') return helpers.em;
      if (prop === 'px') return helpers.px;
      if (prop === 'min') return helpers.min;
      if (prop === 'max') return helpers.max;
      if (prop === 'clamp') return helpers.clamp;


       // ========== RESPONSIVE BREAKPOINT METHODS ==========
      // Check if prop is a breakpoint name
      if (currentBreakpoints && currentBreakpoints[prop as keyof typeof currentBreakpoints]) {
        return createResponsiveMethod(prop, currentBreakpoints[prop as keyof typeof currentBreakpoints]);
      }

      // Handle .hover()
      if (prop === 'hover') {
        return () => {
          if (debugMode) {
            console.log(`  🖱️ Hover styles added`);
          }
          const hoverCatcher: Record<string, any> = {};
          const hoverHandler: ProxyHandler<object> = {
            get: (hoverTarget: any, hoverProp: string) => {
              if (hoverProp === 'end') {
                return () => {
                  catcher.hover = { ...hoverCatcher };
                  Object.keys(hoverCatcher).forEach(key => delete hoverCatcher[key]);
                  return proxy;
                };
              }
              // Check if hover prop is a shorthand
              const mappedProp = shorthandMap[hoverProp] || hoverProp;
              const cssProperty = mappedProp.replace(/([A-Z])/g, '-$1').toLowerCase();
              if (validProperties && validProperties.length > 0 && !validProperties.includes(cssProperty)) {
                console.warn(`Warning: '${cssProperty}' may not be a valid CSS property`);
              }
              return (value: any) => {
                hoverCatcher[mappedProp] = resolveToken(value, useTokens, tokenContext);
                return hoverProxy;
              };
            }
          };
          const hoverProxy = new Proxy({}, hoverHandler);
          return hoverProxy;
        };
      }

      // CHECK SHORTHANDS FIRST
      // Handle combined shorthands (mx, my, px, py)
      if (handleShorthand(prop, null, catcher)) {
        return (value: any) => {
          handleShorthand(prop, resolveToken(value, useTokens, tokenContext), catcher);
          return proxy;
        };
      }
      
      // Handle single shorthands
      const mappedProp = shorthandMap[prop] || prop;
      const cssProperty = mappedProp.replace(/([A-Z])/g, '-$1').toLowerCase();

      // Add validation warning for unknown shorthands/properties
      if (!shorthandMap[prop] && prop !== mappedProp) {
        const suggestion = getSuggestion(prop, validProperties);
        if (suggestion) {
          console.warn(`⚠️ ChainCSS: '${prop}' is not a recognized shorthand or CSS property. Did you mean '${suggestion}'?`);
        } else {
          console.warn(`⚠️ ChainCSS: '${prop}' is not a recognized shorthand or CSS property. It will be used as-is.`);
        }
      }

      // For debugging in development
      if (debugMode && mappedProp !== prop) {
        console.log(`  🔄 Shortcut: .${prop}() → ${mappedProp}`);
      }

      // Handle .select() - nested selectors
      if (prop === 'select') {
        return function(selector: string): any {
          const nestedStyles: Record<string, any> = {};
          const nestedHandler: ProxyHandler<object> = {
            get: (nestedTarget: any, nestedProp: string) => {
              if (nestedProp === 'block') {
                return () => {
                  if (!catcher.nestedRules) catcher.nestedRules = [];
                  catcher.nestedRules.push({
                    selector: selector,
                    styles: { ...nestedStyles }
                  });
                  return proxy;
                };
              }
              return (value: any) => {
                nestedStyles[nestedProp] = resolveToken(value, useTokens, tokenContext);
                return nestedProxy;
              };
            }
          };
          const nestedProxy = new Proxy({}, nestedHandler);
          return nestedProxy;
        };
      }

      // ========== AT-RULES ==========
      
      // @media handler inside chaincssv2
      if (prop === 'media') {
        return function(query: string, callback: (css: any) => any): any {
          if (debugMode) {
            console.log(`  📱 Media Query: ${query}`);
          }
          // 1. Create a fresh sub-chain instance
          const subChain = chaincssv2(useTokens); 
          
          // 2. Execute the callback using the sub-chain
          let result = callback(subChain);

          // 3. AUTO-EXTRACT: If the callback returned the proxy instead of the plain object
          if (result && typeof result.$el === 'function') {
            result = result.$el(); // This triggers the catcher cleanup and returns the object
          }

          if (!catcher.atRules) catcher.atRules = [];
          
          // 4. Clean up result: Remove 'selectors' if present to avoid invalid CSS properties
          const { selectors, ...pureStyles } = result || {};

          catcher.atRules.push({
            type: 'media',
            query: query,
            styles: pureStyles 
          });
          
          return proxy;
        };
      }

      // @keyframes
      if (prop === 'keyframes') {
        return function(name: string, callback: (keyframes: any) => void): any {
          const keyframeContext: { _keyframeSteps: Record<string, any> } = { _keyframeSteps: {} };
          const keyframeProxy = new Proxy(keyframeContext, {
            get: (target: any, stepProp: string) => {
              if (stepProp === 'from' || stepProp === 'to') {
                return function(stepCallback: (chain: any) => any): any {
                  const subChain = chaincssv2(useTokens);
                  const properties = stepCallback(subChain).$el();
                  target._keyframeSteps[stepProp] = properties;
                  return keyframeProxy;
                };
              }
              if (stepProp === 'percent') {
                return function(value: number, stepCallback: (chain: any) => any): any {
                  const subChain = chaincssv2(useTokens);
                  const properties = stepCallback(subChain).$el();
                  target._keyframeSteps[`${value}%`] = properties;
                  return keyframeProxy;
                };
              }
              return undefined;
            }
          });
          callback(keyframeProxy);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'keyframes',
            name: name,
            steps: keyframeContext._keyframeSteps
          });
          return proxy;
        };
      }

      // @font-face
      if (prop === 'fontFace') {
        return function(callback: (chain: any) => void): any {
          const fontProps: Record<string, any> = {};
          const fontHandler: ProxyHandler<object> = {
            get: (target: any, fontProp: string) => {
              return (value: any) => {
                fontProps[fontProp] = resolveToken(value, useTokens, tokenContext);
                return fontProxy;
              };
            }
          };
          const fontProxy = new Proxy({}, fontHandler);
          callback(fontProxy);
          
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'font-face',
            properties: fontProps
          });
          return proxy;
        };
      }

      // @supports
      if (prop === 'supports') {
        return function(condition: string, callback: (chain: any) => void): any {
          const subChain = chaincssv2(useTokens);
          const result = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'supports',
            condition: condition,
            styles: result
          });
          return proxy;
        };
      }

      // @container
      if (prop === 'container') {
        return function(condition: string, callback: (chain: any) => void): any {
          const subChain = chaincssv2(useTokens);
          const result = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'container',
            condition: condition,
            styles: result
          });
          return proxy;
        };
      }

      // @layer
      if (prop === 'layer') {
        return function(name: string, callback: (chain: any) => void): any {
          const subChain = chaincssv2(useTokens);
          const result = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'layer',
            name: name,
            styles: result
          });
          return proxy;
        };
      }

      // @counter-style
      if (prop === 'counterStyle') {
        return function(name: string, callback: (chain: any) => void): any {
          const counterProps: Record<string, any> = {};
          const counterHandler: ProxyHandler<object> = {
            get: (target: any, counterProp: string) => {
              return (value: any) => {
                counterProps[counterProp] = resolveToken(value, useTokens, tokenContext);
                return counterProxy;
              };
            }
          };
          const counterProxy = new Proxy({}, counterHandler);
          callback(counterProxy);
          
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'counter-style',
            name: name,
            properties: counterProps
          });
          return proxy;
        };
      }

      // @property
      if (prop === 'property') {
        return function(name: string, callback: (chain: any) => void): any {
          const propertyDescs: Record<string, any> = {};
          const propertyHandler: ProxyHandler<object> = {
            get: (target: any, descProp: string) => {
              return (value: any) => {
                propertyDescs[descProp] = resolveToken(value, useTokens, tokenContext);
                return propertyProxy;
              };
            }
          };
          const propertyProxy = new Proxy({}, propertyHandler);
          callback(propertyProxy);
          
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'property',
            name: name,
            descriptors: propertyDescs
          });
          return proxy;
        };
      }

      // theme method
      if (prop === 'theme') {
        return function(themeTokens: any, callback: (chain: any) => void): any {
          const originalTokens = tokens;
          
          const themeTokenStore = {
            get: (path: string) => {
              const themeValue = themeTokens.get ? themeTokens.get(path) : null;
              if (themeValue !== null && themeValue !== undefined) {
                return themeValue;
              }
              return originalTokens.get(path);
            },
            ...themeTokens
          };
          
          const tempTokens = themeTokenStore;
          
          const themed$ = (useTokensFlag: boolean = true) => {
            const result = $(useTokensFlag);
            return result;
          };
          
          const result = callback(themed$);
          
          if (!catcher.themes) catcher.themes = [];
          catcher.themes.push({
            name: `theme-${Date.now()}`,
            styles: result,
            tokens: themeTokens,
            fallback: originalTokens
          });
          
          return proxy;
        };
      }

      // Regular CSS properties
      /*if (validProperties && validProperties.length > 0 && !validProperties.includes(cssProperty)) {
        console.warn(`Warning: '${cssProperty}' may not be a valid CSS property`);
      }*/
      
      return function(value: any): any {
        if (typeof value === 'function') {
          value = value(helpers);
        }
         // Debug log for property assignment
        if (debugMode) {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          console.log(`  🎨 ${cssProp}: ${value}`);
        }

        catcher[mappedProp] = resolveToken(value, useTokens, tokenContext);
        return proxy;
      };
    }
  };
  
  const proxy = new Proxy({}, handler);
  return proxy;
}

export const $ = chaincssv2();

// Process at-rules for CSS generation
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
        
        // Add source comment for media query
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
      
    case 'supports':
      output = `@supports ${rule.condition} {\n`;
      if (rule.styles && rule.styles.selectors) {
        let ruleBody = '';
        for (const prop in rule.styles) {
          if (prop !== 'selectors' && rule.styles.hasOwnProperty(prop)) {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            ruleBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
          }
        }
        if (ruleBody.trim()) {
          output += `  ${rule.styles.selectors.join(', ')} {\n${ruleBody}  }\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'container':
      output = `@container ${rule.condition} {\n`;
      if (rule.styles && rule.styles.selectors) {
        let ruleBody = '';
        for (const prop in rule.styles) {
          if (prop !== 'selectors' && rule.styles.hasOwnProperty(prop)) {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            ruleBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
          }
        }
        if (ruleBody.trim()) {
          output += `  ${rule.styles.selectors.join(', ')} {\n${ruleBody}  }\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'layer':
      output = `@layer ${rule.name} {\n`;
      if (rule.styles && rule.styles.selectors) {
        let ruleBody = '';
        for (const prop in rule.styles) {
          if (prop !== 'selectors' && rule.styles.hasOwnProperty(prop)) {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            ruleBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
          }
        }
        if (ruleBody.trim()) {
          output += `  ${rule.styles.selectors.join(', ')} {\n${ruleBody}  }\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'counter-style':
      output = `@counter-style ${rule.name} {\n`;
      for (const prop in rule.properties) {
        if (prop !== 'selectors') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'property':
      output = `@property ${rule.name} {\n`;
      for (const desc in rule.descriptors) {
        if (desc !== 'selectors') {
          const kebabKey = desc.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.descriptors[desc]};\n`;
        }
      }
      output += '}\n';
      break;
  }
  
  return output;
}

function processStandaloneAtRule(rule: AtRule): string {
  let output = '';
  
  switch(rule.type) {
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
      
    case 'counter-style':
      output = `@counter-style ${rule.name} {\n`;
      for (const prop in rule.properties) {
        if (prop !== 'selectors') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'property':
      output = `@property ${rule.name} {\n`;
      for (const desc in rule.descriptors) {
        if (desc !== 'selectors') {
          const kebabKey = desc.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.descriptors[desc]};\n`;
        }
      }
      output += '}\n';
      break;
  }
  
  return output;
}

// Run function
export const run = (...args: any[]): string => {
  let cssOutput = '';
  const styleObjs: any[] = [];

  args.forEach((value) => {
    if (!value) return;
    styleObjs.push(value);

    if (value.selectors) {
      let mainRuleBody = '';
      let atRulesOutput = '';
      
      for (const key in value) {
        if (key === 'selectors' || !value.hasOwnProperty(key)) continue;
        
        if (key === 'atRules' && Array.isArray(value[key])) {
          value[key].forEach((rule: AtRule) => { 
            atRulesOutput += processAtRule(rule, value.selectors); 
          });
          continue;
        }
        
        if (key === 'nestedRules' && Array.isArray(value[key])) {
          value[key].forEach((rule: NestedRule) => {
            let nestedBody = '';
            for (const prop in rule.styles) {
              const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              nestedBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
            }
            if (nestedBody) {
              atRulesOutput += `${value.selectors.join(', ')} ${rule.selector} {\n${nestedBody}  }\n`;
            }
          });
          continue;
        }
        
        if (key === 'hover' && typeof value[key] === 'object') {
          let hoverBody = '';
          for (const hoverKey in value[key]) {
            const kebabKey = hoverKey.replace(/([A-Z])/g, '-$1').toLowerCase();
            hoverBody += `  ${kebabKey}: ${value[key][hoverKey]};\n`;
          }
          if (hoverBody) {
            cssOutput += `${value.selectors.join(', ')}:hover {\n${hoverBody}}\n`;
          }
          continue;
        }
        
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        mainRuleBody += `  ${kebabKey}: ${value[key]};\n`;
      }
      
      if (mainRuleBody.trim()) {
        cssOutput += `${value.selectors.join(', ')} {\n${mainRuleBody}}\n`;
      }
      cssOutput += atRulesOutput;
      
    } else if (value.type) {
      cssOutput += processStandaloneAtRule(value);
    }
  });

  cssOutput = cssOutput.replace(/\n{3,}/g, '\n\n').trim();
  chain.cssOutput = cssOutput;

  // Use the injected atomic optimizer
  if (atomicOptimizer && atomicOptimizer.options.enabled) {
    const result = atomicOptimizer.optimize(styleObjs);
    
    // IMPORTANT: In component-first mode, we need to combine
    // atomic utilities with the component CSS
    if (atomicOptimizer.options.outputStrategy === 'component-first') {
      // Component CSS already contains all styles, but we want to add
      // atomic utilities as optional extras. The atomic optimizer's result.css
      // already includes atomicCSS + componentCSS (with all styles)
      chain.cssOutput = result.css;
    } else {
      // utility-first mode
      chain.cssOutput = result.css;
    }
    
    chain.classMap = result.map;
    chain.atomicStats = result.stats;
    return chain.cssOutput;
  }
  
  return cssOutput;
};

// Compile function
export const compile = (obj: Record<string, StyleDefinition>): string => {
  let cssString = '';
  const collected: StyleDefinition[] = [];

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    const element = obj[key];

    // Get source location for this style
    const sourceLocation = getSourceLocation();

    // Take snapshot for timeline
    if (timelineEnabled && element.selectors) {
      const styles: Record<string, any> = {};
      for (const prop in element) {
        if (prop !== 'selectors' && prop !== 'atRules' && prop !== 'hover' && prop !== 'nestedRules') {
          styles[prop] = element[prop];
        }
      }
      takeSnapshot(element.selectors[0], styles, sourceLocation || 'unknown');
    }

    // Handle themes
    if (element.themes && Array.isArray(element.themes)) {
      element.themes.forEach((theme: ThemeBlock) => {
        if (theme.styles && theme.styles.selectors) {
          let themeCSS = '';
          const themeSelectors = theme.styles.selectors || [];
          
          for (const prop in theme.styles) {
            if (prop !== 'selectors' && theme.styles.hasOwnProperty(prop)) {
              const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              themeCSS += `  ${kebabKey}: ${theme.styles[prop]};\n`;
            }
          }
          
          if (themeCSS) {
            let block = `${themeSelectors.join(', ')} {\n${themeCSS}}\n`;
            block = addSourceComment(block, sourceLocation);
            cssString += block;
          }
        }
      });
      continue;
    }

    if (element.atRules && Array.isArray(element.atRules)) {
      // Process base styles FIRST
      let elementCSS = '';
      for (const prop in element) {
        if (prop === 'selectors' || prop === 'atRules' || prop === 'hover' || !element.hasOwnProperty(prop)) continue;
        const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        elementCSS += `  ${kebabKey}: ${element[prop]};\n`;
      }
      
      if (elementCSS.trim()) {
        let block = `${element.selectors.join(', ')} {\n${elementCSS}}\n`;
        block = addSourceComment(block, sourceLocation);
        cssString += block;
      }
      
      // THEN process atRules
      element.atRules.forEach((rule: AtRule) => { 
        cssString += processAtRule(rule, element.selectors); 
      });
      
      continue;
    }
    
    if (element.selectors) {
      collected.push(element);
      let elementCSS = '';
      let atRulesCSS = '';
      
      for (const prop in element) {
        if (prop === 'selectors' || !element.hasOwnProperty(prop)) continue;
        
        if (prop === 'atRules' && Array.isArray(element[prop])) {
          element[prop].forEach((rule: AtRule) => { 
            atRulesCSS += processAtRule(rule, element.selectors); 
          });
        } else if (prop === 'themes' && Array.isArray(element[prop])) {
          continue;
        } else if (prop === 'hover' && typeof element[prop] === 'object') {
          let hoverBody = '';
          for (const hoverKey in element[prop]) {
            const kebabKey = hoverKey.replace(/([A-Z])/g, '-$1').toLowerCase();
            hoverBody += `  ${kebabKey}: ${element[prop][hoverKey]};\n`;
          }
          if (hoverBody) {
            let block = `${element.selectors.join(', ')}:hover {\n${hoverBody}}\n`;
            block = addSourceComment(block, sourceLocation);
            cssString += block;
          }
        } else {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          elementCSS += `  ${kebabKey}: ${element[prop]};\n`;
        }
      }
      
      if (elementCSS.trim()) {
        let block = `${element.selectors.join(', ')} {\n${elementCSS}}\n`;
        block = addSourceComment(block, sourceLocation);
        cssString += block;
      }
      cssString += atRulesCSS;
    }
  }

  chain.cssOutput = cssString.trim();

  // Use the injected atomic optimizer instead of a local instance
  if (atomicOptimizer && atomicOptimizer.options.enabled) {
    const result = atomicOptimizer.optimize(collected);
    chain.cssOutput = result.css;
    chain.classMap = result.map;
    chain.atomicStats = result.stats;
    chain.componentMap = result.componentMap; 
    return result.css;
  }
  
  return chain.cssOutput;
};

// Recipe system
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
    const merged: StyleDefinition = {} as StyleDefinition;
    for (const style of styles) {
      if (!style) continue;
      for (const [key, value] of Object.entries(style)) {
        if (key === 'selectors') {
          merged.selectors = merged.selectors || [];
          merged.selectors.push(...(Array.isArray(value) ? value : [value]));
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
    
    const styleBuilder = $(true);
    for (const [prop, value] of Object.entries(merged)) {
      if (prop === 'selectors' || prop === 'hover') continue;
      if ((styleBuilder as any)[prop]) (styleBuilder as any)[prop](value);
    }
    
    if (merged.hover) {
      styleBuilder.hover();
      for (const [hoverProp, hoverValue] of Object.entries(merged.hover)) {
        if ((styleBuilder as any)[hoverProp]) (styleBuilder as any)[hoverProp](hoverValue);
      }
      styleBuilder.end();
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
  
  (pick as any).compileAll = (): string => {
    const allVariants = (pick as any).getAllVariants();
    const styles: StyleDefinition[] = [];
    
    if (baseStyle) styles.push(baseStyle);
    for (const variantMap of Object.values(variants)) {
      for (const variantStyle of Object.values(variantMap as Record<string, StyleDefinition>)) {
        if (variantStyle) styles.push(variantStyle);
      }
    }
    for (const cv of compoundStyles) {
      if (cv.style) styles.push(cv.style);
    }
    
    if (atomicOptimizer && atomicOptimizer.options.enabled) {
      const styleObj: Record<string, StyleDefinition> = {};
      styles.forEach((style, i) => {
        const selectors = style.selectors || [`variant-${i}`];
        styleObj[selectors[0].replace(/^\./, '')] = style;
      });
      const result = atomicOptimizer.optimize(styleObj);
      chain.cssOutput = (chain.cssOutput || '') + result.css;
      chain.classMap = { ...chain.classMap, ...result.map };
      return result.css;
    }
    
    return run(...styles);
  };
  
  return pick as Recipe<TVariants>;
}

// Exports
export { atomicOptimizer, chain as chainObject, setBreakpoints, enableDebug, helpers };