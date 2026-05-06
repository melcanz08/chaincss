// src/core/auto-detector.ts

export type ValueType = 'static' | 'dynamic' | 'runtime-only';
export type Mode = 'build' | 'runtime' | 'hybrid' | 'auto';

export interface DetectedPart {
  type: ValueType;
  prop: string;
  value: any;
  originalValue: any;
  index: number;
}

export interface AnalysisResult {
  staticParts: DetectedPart[];
  dynamicParts: DetectedPart[];
  runtimeOnlyParts: DetectedPart[];
  isHybrid: boolean;
  mode: Mode;
}

export class AutoDetector {
  private static instance: AutoDetector;
  private dynamicPatterns: RegExp[] = [
    /\$\{.*\}/,              // Template literals: ${variable}
    /props\.[a-zA-Z]+/,      // Props access: props.color
    /theme\.[a-zA-Z]+/,      // Theme access: theme.primary
    /state\.[a-zA-Z]+/,      // State access: state.isActive
    /this\.[a-zA-Z]+/,       // This binding
    /useContext\(/,          // React hook
    /useSelector\(/,         // Redux selector
    /getState\(/,            // Store getter
  ];
  
  private staticPatterns: RegExp[] = [
    /^#[0-9a-f]{3,6}$/i,    // Hex colors
    /^[a-z]+$/,              // Simple words (red, blue, flex)
    /^\d+(?:\.\d+)?(?:px|rem|em|%)?$/, // Numbers with optional units
  ];
  
  private debug = false;
  
  static getInstance(): AutoDetector {
    if (!AutoDetector.instance) {
      AutoDetector.instance = new AutoDetector();
    }
    return AutoDetector.instance;
  }
  
  enableDebug(enabled: boolean): void {
    this.debug = enabled;
  }
  
  detectValueType(value: any, prop?: string): ValueType {
    // Runtime-only patterns (functions, callbacks)
    if (typeof value === 'function') {
      if (this.debug) console.log(`[AutoDetector] Function detected for ${prop} -> runtime-only`);
      return 'runtime-only';
    }
    
    // Undefined or null values
    if (value === undefined || value === null) {
      return 'static';
    }
    
    // Objects (nested styles)
    if (typeof value === 'object' && value !== null) {
      if (this.debug) console.log(`[AutoDetector] Object detected for ${prop} -> dynamic`);
      return 'dynamic';
    }
    
    // Check static patterns
    if (typeof value === 'string') {
      // Check if it matches static patterns
      for (const pattern of this.staticPatterns) {
        if (pattern.test(value)) {
          if (this.debug) console.log(`[AutoDetector] Static pattern matched for ${prop}: ${value}`);
          return 'static';
        }
      }
      
      // Check dynamic patterns
      for (const pattern of this.dynamicPatterns) {
        if (pattern.test(value)) {
          if (this.debug) console.log(`[AutoDetector] Dynamic pattern matched for ${prop}: ${value}`);
          return 'dynamic';
        }
      }
    }
    
    // Numbers, booleans are static
    if (typeof value === 'number' || typeof value === 'boolean') {
      return 'static';
    }
    
    // Default to static
    return 'static';
  }
  
  analyzeChain(calls: Array<{ prop: string; value: any; index: number }>): AnalysisResult {
    const staticParts: DetectedPart[] = [];
    const dynamicParts: DetectedPart[] = [];
    const runtimeOnlyParts: DetectedPart[] = [];
    
    for (const call of calls) {
      const type = this.detectValueType(call.value, call.prop);
      const part: DetectedPart = {
        type,
        prop: call.prop,
        value: call.value,
        originalValue: call.value,
        index: call.index
      };
      
      switch (type) {
        case 'static':
          staticParts.push(part);
          break;
        case 'dynamic':
          dynamicParts.push(part);
          break;
        case 'runtime-only':
          runtimeOnlyParts.push(part);
          break;
      }
    }
    
    const isHybrid = staticParts.length > 0 && (dynamicParts.length > 0 || runtimeOnlyParts.length > 0);
    let mode: Mode = 'build';
    
    if (isHybrid) {
      mode = 'hybrid';
    } else if (dynamicParts.length > 0 || runtimeOnlyParts.length > 0) {
      mode = 'runtime';
    } else {
      mode = 'build';
    }
    
    if (this.debug) {
      console.log('[AutoDetector] Analysis:', {
        static: staticParts.length,
        dynamic: dynamicParts.length,
        runtimeOnly: runtimeOnlyParts.length,
        mode,
        isHybrid
      });
    }
    
    return {
      staticParts,
      dynamicParts,
      runtimeOnlyParts,
      isHybrid,
      mode
    };
  }
  
  addDynamicPattern(pattern: RegExp): void {
    this.dynamicPatterns.push(pattern);
    if (this.debug) console.log(`[AutoDetector] Added dynamic pattern: ${pattern}`);
  }
  
  addStaticPattern(pattern: RegExp): void {
    this.staticPatterns.push(pattern);
    if (this.debug) console.log(`[AutoDetector] Added static pattern: ${pattern}`);
  }
  
  reset(): void {
    this.dynamicPatterns = [
      /\$\{.*\}/,
      /props\.[a-zA-Z]+/,
      /theme\.[a-zA-Z]+/,
      /state\.[a-zA-Z]+/,
      /this\.[a-zA-Z]+/,
      /useContext\(/,
      /useSelector\(/,
      /getState\(/,
    ];
    this.staticPatterns = [
      /^#[0-9a-f]{3,6}$/i,
      /^[a-z]+$/,
      /^\d+(?:\.\d+)?(?:px|rem|em|%)?$/,
    ];
  }
}

export const autoDetector = AutoDetector.getInstance();