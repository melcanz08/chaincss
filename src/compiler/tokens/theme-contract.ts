// src/compiler/theme-contract.ts
/**
 * Theme Contract System for ChainCSS
 * Validates that themes match the expected shape
 */

export interface ThemeContract {
  [key: string]: ThemeContract | string;
}

export interface ThemeTokens {
  [key: string]: string | ThemeTokens;
}

/**
 * Theme class with getter method
 */
export class Theme {
  private tokens: ThemeTokens;

  constructor(tokens: ThemeTokens) {
    this.tokens = tokens;
  }

  get(path: string): string | undefined {
    const parts = path.split('.');
    let current: any = this.tokens;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return typeof current === 'string' ? current : undefined;
  }

  set(path: string, value: string): void {
    const parts = path.split('.');
    let current: any = this.tokens;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  toObject(): ThemeTokens {
    return this.tokens;
  }
  
  toCSSVariables(prefix: string = 'theme'): string {
    let css = '';
    const flatten = (obj: ThemeTokens, path: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = path ? `${path}-${key}` : key;
        if (typeof value === 'object' && value !== null) {
          flatten(value, newPath);
        } else {
          css += `  --${prefix}-${newPath}: ${value};\n`;
        }
      }
    };
    flatten(this.tokens);
    return `:root {\n${css}}\n`;
  }
}

/**
 * Create a theme contract that defines the expected shape of themes
 */
export function createThemeContract<T extends ThemeContract>(contractShape: T): T & {
  __isContract: true;
  __validate: (theme: ThemeTokens) => boolean;
} {
  const contract = contractShape;
  
  const contractProxy = Object.assign({}, contract, {
    __isContract: true as const,
    __validate: (theme: ThemeTokens) => validateTheme(contract, theme)
  });
  
  return contractProxy as T & {
    __isContract: true;
    __validate: (theme: ThemeTokens) => boolean;
  };
}

/**
 * Validate that a theme matches the contract
 * @returns true if valid, throws error otherwise
 */
export function validateTheme(
  contract: ThemeContract,
  theme: ThemeTokens = {},
  path: string = ''
): boolean {
  const errors: string[] = [];
  
  function validate(
    contractPart: ThemeContract,
    themePart: ThemeTokens | undefined,
    currentPath: string
  ): void {
    if (typeof contractPart === 'object' && contractPart !== null) {
      const requiredKeys = Object.keys(contractPart);
      const themeKeys = Object.keys(themePart || {});
      
      requiredKeys.forEach(key => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        if (!themePart || !(key in themePart)) {
          errors.push(`  ✗ Missing required token: "${newPath}"`);
        } else {
          validate(
            contractPart[key] as ThemeContract,
            themePart[key] as ThemeTokens | undefined,
            newPath
          );
        }
      });
      
      themeKeys.forEach(key => {
        if (!(key in contractPart)) {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          console.warn(`⚠️ Extra token not in contract: "${newPath}"`);
        }
      });
    } else {
      if (themePart !== undefined && typeof themePart !== 'string') {
        errors.push(`  ✗ Token "${currentPath}" must be a string, got ${typeof themePart}`);
      }
    }
  }
  
  validate(contract, theme, path);
  
  if (errors.length > 0) {
    throw new Error(`Theme Contract Validation Failed:\n${errors.join('\n')}`);
  }
  
  return true;
}

/**
 * Create an actual theme from a contract and values
 */
export function createTheme<T extends ThemeContract>(
  contract: T | (T & { __isContract: boolean }),
  themeValues: ThemeTokens
): Theme {
  // Validate if contract has validation method
  if (typeof (contract as any).__validate === 'function') {
    (contract as any).__validate(themeValues);
  } else {
    validateTheme(contract as T, themeValues);
  }
  
  const tokens: ThemeTokens = {};
  
  function buildTokens(
    contractPart: T,
    themePart: ThemeTokens | undefined,
    target: ThemeTokens,
    _path: string = ''
  ): void {
    Object.keys(contractPart).forEach(key => {
      if (typeof contractPart[key] === 'object' && contractPart[key] !== null) {
        target[key] = {};
        buildTokens(
          contractPart[key] as T,
          (themePart?.[key] as ThemeTokens) || {},
          target[key] as ThemeTokens,
          _path
        );
      } else {
        target[key] = themePart?.[key] as string;
      }
    });
  }
  
  buildTokens(contract as T, themeValues, tokens);
  
  return new Theme(tokens);
}

// Type guard to check if an object is a theme contract
export function isThemeContract(obj: any): obj is ThemeContract & { __isContract: true } {
  return obj && typeof obj === 'object' && obj.__isContract === true;
}

export default {
  Theme,
  createThemeContract,
  validateTheme,
  createTheme,
  isThemeContract
};