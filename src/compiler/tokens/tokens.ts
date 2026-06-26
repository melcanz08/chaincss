// src/compiler/tokens.ts
// Types
export interface TokenColors {
  [key: string]: string | Record<string, string>;
}

export interface TokenSpacing {
  [key: string]: string;
}

export interface TokenTypography {
  fontFamily: Record<string, string>;
  fontSize: Record<string, string>;
  fontWeight: Record<string, string>;
  lineHeight: Record<string, string>;
  letterSpacing?: Record<string, string>; // Add this optional property
}

export interface TokenBreakpoints {
  [key: string]: string;
}

export interface TokenZIndex {
  [key: string]: string;
}

export interface TokenShadows {
  [key: string]: string;
}

export interface TokenBorderRadius {
  [key: string]: string;
}

export interface TokensStructure {
  colors: TokenColors;
  spacing: TokenSpacing;
  typography: TokenTypography;
  breakpoints: TokenBreakpoints;
  zIndex: TokenZIndex;
  shadows: TokenShadows;
  borderRadius: TokenBorderRadius;
  [key: string]: any;
}

export interface TokenValue {
  value: any;
  description?: string;
  deprecated?: boolean;
  aliases?: string[];
}

export type FlattenedTokens = Record<string, string>;

// Default tokens (kept as immutable constant)
export const defaultTokens: TokensStructure = {
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    success: '#48bb78',
    danger: '#f56565',
    warning: '#ed8936',
    info: '#4299e1',
    light: '#f7fafc',
    dark: '#1a202c',
    white: '#ffffff',
    black: '#000000',
    gray: {
      50: '#f9fafb',
      100: '#f7fafc',
      200: '#edf2f7',
      300: '#e2e8f0',
      400: '#cbd5e0',
      500: '#a0aec0',
      600: '#718096',
      700: '#4a5568',
      800: '#2d3748',
      900: '#1a202c'
    },
    blue: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a'
    },
    green: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d'
    },
    red: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d'
    },
    yellow: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12'
    }
  },
  
  spacing: {
    0: '0',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    11: '2.75rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    36: '9rem',
    40: '10rem',
    44: '11rem',
    48: '12rem',
    52: '13rem',
    56: '14rem',
    60: '15rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
    '2xl': '4rem',
    '3xl': '6rem',
    '4xl': '8rem',
    '5xl': '10rem'
  },
  
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      system: 'system-ui, -apple-system, sans-serif'
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
      '7xl': '4.5rem',
      '8xl': '6rem',
      '9xl': '8rem'
    },
    fontWeight: {
      hairline: '100',
      thin: '200',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900'
    },
    lineHeight: {
      none: '1',
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
      3: '.75rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      7: '1.75rem',
      8: '2rem',
      9: '2.25rem',
      10: '2.5rem'
    },
    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em'
    }
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
    '3xl': '1920px',
    mobile: '640px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1280px'
  },
  
  zIndex: {
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
    auto: 'auto',
    dropdown: '1000',
    sticky: '1020',
    fixed: '1030',
    modal: '1040',
    popover: '1050',
    tooltip: '1060',
    toast: '1070',
    overlay: '1080'
  },
  
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: 'none',
    'glow-sm': '0 0 10px rgba(102, 126, 234, 0.5)',
    'glow-md': '0 0 20px rgba(102, 126, 234, 0.5)',
    'glow-lg': '0 0 30px rgba(102, 126, 234, 0.5)'
  },
  
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    '4xl': '2rem',
    full: '9999px'
  },
  
  // Additional animation presets
  animations: {
    fade: {
      '0%': { opacity: 0 },
      '100%': { opacity: 1 }
    },
    slideUp: {
      '0%': { transform: 'translateY(20px)', opacity: 0 },
      '100%': { transform: 'translateY(0)', opacity: 1 }
    },
    slideDown: {
      '0%': { transform: 'translateY(-20px)', opacity: 0 },
      '100%': { transform: 'translateY(0)', opacity: 1 }
    },
    slideLeft: {
      '0%': { transform: 'translateX(20px)', opacity: 0 },
      '100%': { transform: 'translateX(0)', opacity: 1 }
    },
    slideRight: {
      '0%': { transform: 'translateX(-20px)', opacity: 0 },
      '100%': { transform: 'translateX(0)', opacity: 1 }
    },
    scale: {
      '0%': { transform: 'scale(0.95)', opacity: 0 },
      '100%': { transform: 'scale(1)', opacity: 1 }
    },
    bounce: {
      '0%, 100%': { transform: 'translateY(0)' },
      '50%': { transform: 'translateY(-25%)' }
    },
    pulse: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 }
    },
    spin: {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' }
    },
    shimmer: {
      '0%': { backgroundPosition: '-200% 0' },
      '100%': { backgroundPosition: '200% 0' }
    }
  }
};

export class DesignTokens {
  private customTokens: TokensStructure;
  private customFlattened: FlattenedTokens;
  private defaultFlattened: FlattenedTokens;
  private tokenCache: Map<string, string> = new Map();

  constructor(customTokens: Partial<TokensStructure> = {}) {
    // Deep clone custom tokens to prevent mutation
    this.customTokens = this.deepClone(customTokens) as TokensStructure;
    
    // Flatten both token sets
    this.customFlattened = this.flattenTokens(this.customTokens);
    this.defaultFlattened = this.flattenTokens(defaultTokens);
    
    // Freeze to prevent modifications
    Object.freeze(this.customTokens);
    Object.freeze(this.customFlattened);
    Object.freeze(this.defaultFlattened);
  }

  // Deep clone objects
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item)) as any;
    
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  // Deep freeze to prevent accidental modifications
  private deepFreeze<T extends object>(obj: T): T {
    Object.keys(obj).forEach(key => {
      const value = (obj as any)[key];
      if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
        this.deepFreeze(value);
      }
    });
    return Object.freeze(obj);
  }

  // Flatten nested tokens for easy access
  flattenTokens(obj: Record<string, any>, prefix: string = ''): FlattenedTokens {
    const result: FlattenedTokens = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const prefixed = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, this.flattenTokens(value, prefixed));
      } else {
        result[prefixed] = String(value);
      }
    }
    
    return result;
  }

  // Get token value by path (e.g., 'colors.primary')
  // Checks custom tokens first, then falls back to default tokens
  get(path: string, defaultValue: string = ''): string {
    // Check cache first
    if (this.tokenCache.has(path)) {
      return this.tokenCache.get(path)!;
    }
    
    let value: string | undefined;
    
    // First try custom tokens
    if (path in this.customFlattened) {
      value = this.customFlattened[path];
    }
    
    // Then try default tokens
    if (value === undefined && path in this.defaultFlattened) {
      value = this.defaultFlattened[path];
    }
    
    // Handle token references (e.g., "$colors.primary")
    if (value && value.startsWith('$')) {
      const refPath = value.substring(1);
      value = this.get(refPath, defaultValue);
    }
    
    const result = value !== undefined ? value : defaultValue;
    
    // Cache the result
    this.tokenCache.set(path, result);
    
    return result;
  }

  // Get token with type safety
  getColor(path: string, defaultValue: string = '#000000'): string {
    return this.get(`colors.${path}`, defaultValue);
  }

  getSpacing(path: string, defaultValue: string = '0'): string {
    return this.get(`spacing.${path}`, defaultValue);
  }

  getFontSize(path: string, defaultValue: string = '1rem'): string {
    return this.get(`typography.fontSize.${path}`, defaultValue);
  }

  getFontWeight(path: string, defaultValue: string = '400'): string {
    return this.get(`typography.fontWeight.${path}`, defaultValue);
  }

  getLineHeight(path: string, defaultValue: string = '1.5'): string {
    return this.get(`typography.lineHeight.${path}`, defaultValue);
  }

  getBreakpoint(path: string, defaultValue: string = '768px'): string {
    return this.get(`breakpoints.${path}`, defaultValue);
  }

  getZIndex(path: string, defaultValue: string = '0'): string {
    return this.get(`zIndex.${path}`, defaultValue);
  }

  getShadow(path: string, defaultValue: string = 'none'): string {
    return this.get(`shadows.${path}`, defaultValue);
  }

  getBorderRadius(path: string, defaultValue: string = '0'): string {
    return this.get(`borderRadius.${path}`, defaultValue);
  }

  // Get all custom tokens (as flattened object)
  getCustomTokens(): FlattenedTokens {
    return { ...this.customFlattened };
  }

  // Get all default tokens (as flattened object)
  getDefaultTokens(): FlattenedTokens {
    return { ...this.defaultFlattened };
  }

  // Check if a token exists (in either custom or default)
  has(path: string): boolean {
    return path in this.customFlattened || path in this.defaultFlattened;
  }

  // Generate CSS variables from tokens (combines both custom and default)
  toCSSVariables(prefix: string = 'chain'): string {
    let css = ':root {\n';
    
    // Combine both token sets (custom overrides default)
    const allTokens = { ...this.defaultFlattened, ...this.customFlattened };
    
    for (const [key, value] of Object.entries(allTokens)) {
      const varName = `--${prefix}-${key.replace(/\./g, '-')}`;
      css += `  ${varName}: ${value};\n`;
    }
    
    css += '}\n';
    return css;
  }

  // Generate media queries from breakpoints
  toMediaQueries(): Record<string, string> {
    const queries: Record<string, string> = {};
    
    for (const [name, value] of Object.entries(this.customFlattened)) {
      if (name.startsWith('breakpoints.')) {
        const breakpointName = name.replace('breakpoints.', '');
        queries[breakpointName] = value;
      }
    }
    
    return queries;
  }

  // Create a theme variant (overrides on top of defaults + custom)
  createTheme(name: string, overrides: Record<string, string>): DesignTokens {
    // Start with current custom tokens, then apply overrides
    const newCustomTokens = this.deepClone(this.customTokens);
    
    // Apply overrides to nested structure
    for (const [path, value] of Object.entries(overrides)) {
      const parts = path.split('.');
      let current: any = newCustomTokens;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
    }
    
    return new DesignTokens(newCustomTokens);
  }

  // Merge with another token set
  merge(tokens: Partial<TokensStructure>): DesignTokens {
    const merged = this.deepClone(this.customTokens);
    
    const deepMerge = (target: any, source: any) => {
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
    };
    
    deepMerge(merged, tokens);
    return new DesignTokens(merged);
  }

  // Clear cache
  clearCache(): void {
    this.tokenCache.clear();
  }

  // Get token path suggestions for autocomplete
  getSuggestions(partialPath: string): string[] {
    const allTokens = { ...this.defaultFlattened, ...this.customFlattened };
    const suggestions: string[] = [];
    
    for (const key of Object.keys(allTokens)) {
      if (key.includes(partialPath)) {
        suggestions.push(key);
      }
    }
    
    return suggestions.sort();
  }
}

// Singleton instance with default tokens
export const tokens = new DesignTokens(defaultTokens);

// Token utility functions
export function createTokens(customTokens: Partial<TokensStructure>): DesignTokens {
  return new DesignTokens(customTokens);
}

// Helper to resolve token references in strings
export function resolveTokenReferences(
  value: string, 
  tokens: DesignTokens, 
  prefix: string = '$'
): string {
  if (typeof value !== 'string') return String(value);
  
  const tokenRegex = new RegExp(`${prefix}([a-zA-Z0-9.-]+)`, 'g');
  
  return value.replace(tokenRegex, (match, tokenPath) => {
    const resolved = tokens.get(tokenPath);
    return resolved !== undefined ? resolved : match;
  });
}

// Type guard to check if value is a token reference
export function isTokenReference(value: any, prefix: string = '$'): boolean {
  return typeof value === 'string' && value.startsWith(prefix);
}

// ESM Export
export { DesignTokens as default };