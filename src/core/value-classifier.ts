// src/core/value-classifier.ts

/**
 * ChainCSS Value Classifier
 * 
 * Single source of truth for classifying style values as static or dynamic.
 * Used by both the build compiler and runtime injector to determine
 * what can be extracted to static CSS vs what needs runtime resolution.
 * 
 * This replaces: auto-detector.ts, smart-analyzer.ts (PatternDetector + SmartAnalyzer)
 */

export type ValueClass = 'static' | 'dynamic';

/**
 * Classify a style value.
 * 
 * Rules (in order):
 * 1. Functions → dynamic (need runtime execution)
 * 2. Strings containing template literals, theme/props/state references → dynamic
 * 3. Everything else → static (safe to compile to CSS)
 */
export function classifyValue(value: any): ValueClass {
  // Functions always need runtime evaluation
  if (typeof value === 'function') {
    return 'dynamic';
  }
  
  // Strings that reference runtime values
  if (typeof value === 'string') {
    // Template literals: `${props.color}`
    if (value.includes('${')) return 'dynamic';
    
    // Token references: theme.primary, $colors.blue, var(--token)
    if (/\btheme\.|\$\w|var\(--|props\.|state\.|context\./.test(value)) {
      return 'dynamic';
    }
  }
  
  // Numbers, booleans, plain strings, null, undefined → static
  return 'static';
}

/**
 * Partition a style object into static and dynamic properties.
 * Used at compile time to extract static CSS while preserving dynamic values.
 */
export function partitionStyles(styles: Record<string, any>): {
  static: Record<string, any>;
  dynamic: Record<string, any>;
} {
  const staticStyles: Record<string, any> = {};
  const dynamicStyles: Record<string, any> = {};
  
  for (const [prop, value] of Object.entries(styles)) {
    // Skip internal metadata keys
    if (prop.startsWith('_')) continue;
    
    if (classifyValue(value) === 'dynamic') {
      dynamicStyles[prop] = value;
    } else {
      staticStyles[prop] = value;
    }
  }
  
  return { static: staticStyles, dynamic: dynamicStyles };
}

/**
 * Check if a style object has any dynamic values.
 * Fast path — returns early on first dynamic found.
 */
export function hasDynamicValues(styles: Record<string, any>): boolean {
  for (const value of Object.values(styles)) {
    if (classifyValue(value) === 'dynamic') return true;
  }
  return false;
}