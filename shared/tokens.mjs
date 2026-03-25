// shared/tokens.mjs

class DesignTokens {
  constructor(tokens = {}, contract = null) {
    // Store contract for validation
    this.contract = contract;
    
    // Validate against contract if provided
    if (contract) {
      this.validateContract(tokens, contract);
    }
    
    this.tokens = this.deepFreeze({
      colors: {},
      spacing: {},
      typography: {},
      breakpoints: {},
      zIndex: {},
      shadows: {},
      borderRadius: {},
      ...tokens
    });
    
    this.flattened = this.flattenTokens(this.tokens);
  }

  // Validate token structure against contract
  validateContract(tokens, contract, path = '') {
    const errors = [];
    
    const validate = (contractPart, tokenPart, currentPath) => {
      if (typeof contractPart === 'object' && contractPart !== null) {
        const requiredKeys = Object.keys(contractPart);
        const tokenKeys = Object.keys(tokenPart || {});
        
        requiredKeys.forEach(key => {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          
          if (!tokenPart || !tokenPart.hasOwnProperty(key)) {
            errors.push(`❌ Missing required token: "${newPath}"`);
          } else {
            validate(contractPart[key], tokenPart[key], newPath);
          }
        });
        
        // Warn about extra keys
        tokenKeys.forEach(key => {
          if (!contractPart.hasOwnProperty(key)) {
            const newPath = currentPath ? `${currentPath}.${key}` : key;
            console.warn(`⚠️ Extra token not in contract: "${newPath}"`);
          }
        });
      } else {
        if (typeof tokenPart !== 'string') {
          errors.push(`❌ Token "${currentPath}" must be a string, got ${typeof tokenPart}`);
        }
      }
    };
    
    validate(contract, tokens, path);
    
    if (errors.length > 0) {
      throw new Error(`Theme Contract Validation Failed:\n${errors.join('\n')}`);
    }
    
    return true;
  }

  // Deep freeze to prevent accidental modifications
  deepFreeze(obj) {
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.deepFreeze(obj[key]);
      }
    });
    return Object.freeze(obj);
  }

  // Flatten nested tokens for easy access
  flattenTokens(obj, prefix = '') {
    return Object.keys(obj).reduce((acc, key) => {
      const prefixed = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        Object.assign(acc, this.flattenTokens(obj[key], prefixed));
      } else {
        acc[prefixed] = obj[key];
      }
      
      return acc;
    }, {});
  }

  // Get token value by path (e.g., 'colors.primary')
  get(path, defaultValue = '') {
    return this.flattened[path] || defaultValue;
  }

  // Generate CSS variables from tokens
  toCSSVariables(prefix = 'chain') {
    let css = ':root {\n';
    
    Object.entries(this.flattened).forEach(([key, value]) => {
      const varName = `--${prefix}-${key.replace(/\./g, '-')}`;
      css += `  ${varName}: ${value};\n`;
    });
    
    css += '}\n';
    return css;
  }

  // Create a theme variant with contract validation
  createTheme(name, overrides) {
    const themeTokens = { ...this.flattened };
    
    Object.entries(overrides).forEach(([key, value]) => {
      if (themeTokens[key]) {
        themeTokens[key] = value;
      }
    });
    
    // Validate theme against original contract if exists
    if (this.contract) {
      const expandedTokens = this.expandTokens(themeTokens);
      this.validateContract(expandedTokens, this.contract);
    }
    
    return new DesignTokens(this.expandTokens(themeTokens), this.contract);
  }

  // Expand flattened tokens back to nested structure
  expandTokens(flattened) {
    const result = {};
    
    Object.entries(flattened).forEach(([key, value]) => {
      const parts = key.split('.');
      let current = result;
      
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = current[parts[i]] || {};
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
    });
    
    return result;
  }
}

// Default tokens
const defaultTokens = {
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
const tokens = new DesignTokens(defaultTokens);

// Token utility functions
const createTokens = (customTokens, contract = null) => {
  return new DesignTokens(customTokens, contract);
};

// Define a theme contract
const defineThemeContract = (contract) => {
  return contract;
};

// Generate responsive values
const responsive = (values) => {
  if (typeof values === 'string') return values;
  
  return Object.entries(values).map(([breakpoint, value]) => {
    if (breakpoint === 'base') return value;
    return `@media (min-width: ${tokens.get(`breakpoints.${breakpoint}`)}) { ${value} }`;
  }).join(' ');
};

export {
  tokens,
  createTokens,
  defineThemeContract,
  responsive,
  DesignTokens
};