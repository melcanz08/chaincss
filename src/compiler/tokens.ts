// chaincss/src/compiler/tokens.ts

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

export type FlattenedTokens = Record<string, string>;

export class DesignTokens {
  tokens: TokensStructure;
  flattened: FlattenedTokens;

  constructor(tokens: Partial<TokensStructure> = {}) {
    this.tokens = this.deepFreeze({
      colors: {},
      spacing: {},
      typography: {
        fontFamily: {},
        fontSize: {},
        fontWeight: {},
        lineHeight: {}
      },
      breakpoints: {},
      zIndex: {},
      shadows: {},
      borderRadius: {},
      ...tokens
    }) as TokensStructure;
    
    this.flattened = this.flattenTokens(this.tokens);
  }

  // Deep freeze to prevent accidental modifications
  deepFreeze<T extends object>(obj: T): T {
    Object.keys(obj).forEach(key => {
      const value = (obj as any)[key];
      if (typeof value === 'object' && value !== null) {
        this.deepFreeze(value);
      }
    });
    return Object.freeze(obj);
  }

  // Flatten nested tokens for easy access
  flattenTokens(obj: Record<string, any>, prefix: string = ''): FlattenedTokens {
    return Object.keys(obj).reduce((acc, key) => {
      const prefixed = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (typeof value === 'object' && value !== null) {
        Object.assign(acc, this.flattenTokens(value, prefixed));
      } else {
        acc[prefixed] = value;
      }
      
      return acc;
    }, {} as FlattenedTokens);
  }

  // Get token value by path (e.g., 'colors.primary')
  get(path: string, defaultValue: string = ''): string {
    return (this.flattened[path] as string) || defaultValue;
  }

  // Generate CSS variables from tokens
  toCSSVariables(prefix: string = 'chain'): string {
    let css = ':root {\n';
    
    Object.entries(this.flattened).forEach(([key, value]) => {
      const varName = `--${prefix}-${key.replace(/\./g, '-')}`;
      css += `  ${varName}: ${value};\n`;
    });
    
    css += '}\n';
    return css;
  }

  // Create a theme variant
  createTheme(name: string, overrides: Record<string, string>): DesignTokens {
    const themeTokens = { ...this.flattened };
    
    Object.entries(overrides).forEach(([key, value]) => {
      if (themeTokens[key]) {
        themeTokens[key] = value;
      }
    });
    
    return new DesignTokens(this.expandTokens(themeTokens));
  }

  // Expand flattened tokens back to nested structure
  expandTokens(flattened: FlattenedTokens): TokensStructure {
    const result: TokensStructure = {} as TokensStructure;
    
    Object.entries(flattened).forEach(([key, value]) => {
      const parts = key.split('.');
      let current: any = result;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
    });
    
    return result;
  }
}

// Default tokens
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
      100: '#f7fafc',
      200: '#edf2f7',
      300: '#e2e8f0',
      400: '#cbd5e0',
      500: '#a0aec0',
      600: '#718096',
      700: '#4a5568',
      800: '#2d3748',
      900: '#1a202c'
    }
  },
  
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
    40: '10rem',
    48: '12rem',
    56: '14rem',
    64: '16rem',
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
    '2xl': '4rem',
    '3xl': '6rem'
  },
  
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
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
      '5xl': '3rem'
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
      loose: '2'
    }
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
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
    tooltip: '1060'
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: 'none'
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
    full: '9999px'
  }
};

// Create and export tokens instance
export const tokens = new DesignTokens(defaultTokens);

// Token utility functions
export function createTokens(customTokens: Partial<TokensStructure>): DesignTokens {
  return new DesignTokens(customTokens);
}

// Generate responsive values
export function responsive(values: Record<string, string> | string): string {
  if (typeof values === 'string') return values;
  
  return Object.entries(values).map(([breakpoint, value]) => {
    if (breakpoint === 'base') return value;
    const breakpointValue = tokens.get(`breakpoints.${breakpoint}`);
    return `@media (min-width: ${breakpointValue}) { ${value} }`;
  }).join(' ');
}

// ESM Export
export { DesignTokens as default };