// src/compiler/breakpoints.ts

// Types
export interface BreakpointConfig {
  name: string;
  minWidth?: number;
  maxWidth?: number;
  query: string;
  priority?: number;
}

export type BreakpointsMap = Record<string, string>;
export type BreakpointValues = Record<string, number>;

// Default responsive breakpoints
const DEFAULT_BREAKPOINTS: BreakpointsMap = {
  // Mobile-first breakpoints
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
  '2xl': '(min-width: 1536px)',
  
  // Desktop-first breakpoints (alternative naming)
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
  
  // Specific device breakpoints
  'mobile-sm': '(max-width: 375px)',
  'mobile-md': '(min-width: 376px) and (max-width: 768px)',
  'tablet-sm': '(min-width: 769px) and (max-width: 834px)',
  'tablet-lg': '(min-width: 835px) and (max-width: 1024px)',
  'desktop-sm': '(min-width: 1025px) and (max-width: 1280px)',
  'desktop-md': '(min-width: 1281px) and (max-width: 1440px)',
  'desktop-lg': '(min-width: 1441px)',
  
  // Orientation breakpoints
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
  
  // Feature breakpoints
  dark: '(prefers-color-scheme: dark)',
  light: '(prefers-color-scheme: light)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  highContrast: '(prefers-contrast: high)',
  
  // Print
  print: 'print',
  
  // Hover capabilities
  hover: '(hover: hover)',
  'no-hover': '(hover: none)',
  
  // Pointer capabilities
  fine: '(pointer: fine)',
  coarse: '(pointer: coarse)',
};

// Numerical values for breakpoints (for programmatic use)
export const BREAKPOINT_VALUES: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  mobile: 767,
  tablet: 1023,
  desktop: 1024,
};

// Global breakpoints configuration
export let currentBreakpoints: BreakpointsMap = { ...DEFAULT_BREAKPOINTS };

// Function to set breakpoints from config
export function setBreakpoints(breakpoints: Partial<BreakpointsMap>): void {
  currentBreakpoints = { ...DEFAULT_BREAKPOINTS, ...breakpoints } as BreakpointsMap;
}

// Get a specific breakpoint query
export function getBreakpoint(name: string): string | undefined {
  return currentBreakpoints[name];
}

// Get all breakpoints
export function getAllBreakpoints(): BreakpointsMap {
  return { ...currentBreakpoints };
}

// Reset to default breakpoints
export function resetBreakpoints(): void {
  currentBreakpoints = { ...DEFAULT_BREAKPOINTS };
}

// Add a custom breakpoint
export function addBreakpoint(name: string, query: string): void {
  currentBreakpoints[name] = query;
}

// Remove a breakpoint
export function removeBreakpoint(name: string): boolean {
  if (name in currentBreakpoints) {
    delete currentBreakpoints[name];
    return true;
  }
  return false;
}

// Generate media query from min/max values
export function createMediaQuery(
  min?: number | string,
  max?: number | string,
  unit: 'px' | 'rem' | 'em' = 'px'
): string {
  const conditions: string[] = [];
  
  if (min !== undefined) {
    const minValue = typeof min === 'number' ? `${min}${unit}` : min;
    conditions.push(`(min-width: ${minValue})`);
  }
  
  if (max !== undefined) {
    const maxValue = typeof max === 'number' ? `${max}${unit}` : max;
    conditions.push(`(max-width: ${maxValue})`);
  }
  
  if (conditions.length === 0) {
    return '';
  }
  
  return conditions.join(' and ');
}

// Get breakpoint numeric value
export function getBreakpointValue(name: string): number | undefined {
  return BREAKPOINT_VALUES[name];
}

// Get breakpoint range
export function getBreakpointRange(name: string): { min: number; max: number } | null {
  const query = currentBreakpoints[name];
  if (!query) return null;
  
  const minMatch = query.match(/min-width:\s*(\d+)px/);
  const maxMatch = query.match(/max-width:\s*(\d+)px/);
  
  return {
    min: minMatch ? parseInt(minMatch[1]) : 0,
    max: maxMatch ? parseInt(maxMatch[1]) : Infinity,
  };
}

// Generate all breakpoint media queries for use in CSS
export function generateBreakpointCSS(selector: string, styles: Record<string, any>): string {
  let css = '';
  
  for (const [name, query] of Object.entries(currentBreakpoints)) {
    css += `@media ${query} {\n`;
    css += `  ${selector} {\n`;
    
    for (const [prop, value] of Object.entries(styles)) {
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      css += `    ${kebabProp}: ${value};\n`;
    }
    
    css += `  }\n}\n`;
  }
  
  return css;
}

// Sort breakpoints by min-width (ascending)
export function getSortedBreakpoints(): Array<{ name: string; query: string; minWidth: number }> {
  const breakpointsWithWidth: Array<{ name: string; query: string; minWidth: number }> = [];
  
  for (const [name, query] of Object.entries(currentBreakpoints)) {
    const minMatch = query.match(/min-width:\s*(\d+)px/);
    if (minMatch) {
      breakpointsWithWidth.push({
        name,
        query,
        minWidth: parseInt(minMatch[1]),
      });
    }
  }
  
  return breakpointsWithWidth.sort((a, b) => a.minWidth - b.minWidth);
}

// Get breakpoint for a specific width
export function getBreakpointForWidth(width: number): string | null {
  const breakpoints = getSortedBreakpoints();
  
  for (let i = breakpoints.length - 1; i >= 0; i--) {
    if (width >= breakpoints[i].minWidth) {
      return breakpoints[i].name;
    }
  }
  
  return null;
}

// Check if a breakpoint exists
export function hasBreakpoint(name: string): boolean {
  return name in currentBreakpoints;
}

// Get all breakpoint names
export function getBreakpointNames(): string[] {
  return Object.keys(currentBreakpoints);
}

// Create responsive style object for a component
export interface ResponsiveStyle<T = any> {
  base?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
  [key: string]: T | undefined;
}

// Generate responsive CSS from a responsive style object
export function generateResponsiveCSS(
  selector: string,
  styles: ResponsiveStyle<Record<string, any>>
): string {
  let css = '';
  
  // Base styles (no media query)
  if (styles.base) {
    css += `${selector} {\n`;
    for (const [prop, value] of Object.entries(styles.base)) {
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      css += `  ${kebabProp}: ${value};\n`;
    }
    css += `}\n`;
  }
  
  // Breakpoint-specific styles
  for (const [breakpoint, breakpointStyles] of Object.entries(styles)) {
    if (breakpoint === 'base' || !breakpointStyles) continue;
    
    const query = currentBreakpoints[breakpoint];
    if (query) {
      css += `@media ${query} {\n`;
      css += `  ${selector} {\n`;
      
      for (const [prop, value] of Object.entries(breakpointStyles)) {
        const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `    ${kebabProp}: ${value};\n`;
      }
      
      css += `  }\n}\n`;
    }
  }
  
  return css;
}

// Helper to create a responsive utility function
export function responsive<T>(
  value: T | ResponsiveStyle<T>,
  defaultBreakpoint: keyof ResponsiveStyle = 'base'
): ResponsiveStyle<T> {
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Check if it's already a responsive object
    const keys = Object.keys(value as object);
    if (keys.some(k => k in currentBreakpoints || k === 'base')) {
      return value as ResponsiveStyle<T>;
    }
  }
  
  // Return as base value
  return { [defaultBreakpoint]: value as T };
}

// Utility to merge responsive styles
export function mergeResponsiveStyles(
  ...styles: ResponsiveStyle<any>[]
): ResponsiveStyle<any> {
  const merged: ResponsiveStyle<any> = {};
  
  for (const style of styles) {
    for (const [breakpoint, breakpointStyles] of Object.entries(style)) {
      if (breakpointStyles) {
        if (merged[breakpoint]) {
          merged[breakpoint] = { ...merged[breakpoint], ...breakpointStyles };
        } else {
          merged[breakpoint] = { ...breakpointStyles };
        }
      }
    }
  }
  
  return merged;
}

// Get breakpoint query with custom unit
export function getBreakpointQuery(
  name: string,
  unit: 'px' | 'rem' | 'em' = 'px'
): string | undefined {
  const query = currentBreakpoints[name];
  if (!query) return undefined;
  
  // Convert px to other units if needed
  if (unit !== 'px') {
    const pxMatch = query.match(/(\d+)px/g);
    if (pxMatch) {
      let convertedQuery = query;
      for (const pxValue of pxMatch) {
        const num = parseInt(pxValue);
        let converted: string;
        
        switch (unit) {
          case 'rem':
            converted = `${num / 16}rem`;
            break;
          case 'em':
            converted = `${num / 16}em`;
            break;
          default:
            converted = pxValue;
        }
        
        convertedQuery = convertedQuery.replace(pxValue, converted);
      }
      return convertedQuery;
    }
  }
  
  return query;
}

// Debug: Log all current breakpoints
export function logBreakpoints(): void {
  console.log('\n📱 Current Breakpoints:');
  console.log('═'.repeat(50));
  
  for (const [name, query] of Object.entries(currentBreakpoints)) {
    console.log(`  ${name.padEnd(12)} → ${query}`);
  }
  
  console.log('═'.repeat(50) + '\n');
}