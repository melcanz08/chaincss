// chaincss/src/compiler/theme-contract.ts

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

export interface TokensStructure {
  colors: Record<string, string | Record<string, string>>;
  spacing: Record<string, string>;
  typography: {
    fontFamily: Record<string, string>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
  };
  breakpoints: Record<string, string>;
  zIndex: Record<string, string>;
  shadows: Record<string, string>;
  borderRadius: Record<string, string>;
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
      if (current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  toObject(): ThemeTokens {
    return this.tokens;
  }
}

/**
 * Create a theme contract that defines the expected shape of themes
 * @param contractShape - The contract object defining required token paths
 * @returns Proxy contract with validation methods
 */
export function createThemeContract(contractShape: ThemeContract): ThemeContract & {
  __isContract: boolean;
  __validate: (theme: ThemeTokens) => boolean;
} {
  const contract = contractShape;
  
  const contractProxy = new Proxy(contract, {
    get(target, prop: string | symbol) {
      if (prop === '__isContract') return true;
      if (prop === '__validate') return (theme: ThemeTokens) => validateTheme(contract, theme);
      return target[prop as keyof typeof target];
    }
  }) as ThemeContract & {
    __isContract: boolean;
    __validate: (theme: ThemeTokens) => boolean;
  };
  
  return contractProxy;
}

/**
 * Validate that a theme matches the contract
 * @param contract - The contract to validate against
 * @param theme - The theme to validate
 * @param path - Current path for error messages
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
        
        if (!themePart || !themePart.hasOwnProperty(key)) {
          errors.push(` Missing required token: "${newPath}"`);
        } else {
          validate(
            contractPart[key] as ThemeContract,
            themePart[key] as ThemeTokens | undefined,
            newPath
          );
        }
      });
      
      themeKeys.forEach(key => {
        if (!contractPart.hasOwnProperty(key)) {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          console.warn(` Extra token not in contract: "${newPath}"`);
        }
      });
    } else {
      if (themePart !== undefined && typeof themePart !== 'string') {
        errors.push(` Token "${currentPath}" must be a string, got ${typeof themePart}`);
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
 * @param contract - The contract defining the shape
 * @param themeValues - The actual theme values
 * @returns Theme object with getter method
 */
export function createTheme(
  contract: ThemeContract | (ThemeContract & { __isContract: boolean; __validate: (theme: ThemeTokens) => boolean }),
  themeValues: ThemeTokens
): Theme {
  if ((contract as any).__isContract) {
    (contract as any).__validate(themeValues);
  } else {
    validateTheme(contract as ThemeContract, themeValues);
  }
  
  const tokens: ThemeTokens = {};
  
  function buildTokens(
    contractPart: ThemeContract,
    themePart: ThemeTokens | undefined,
    target: ThemeTokens,
    path: string = ''
  ): void {
    Object.keys(contractPart).forEach(key => {
      const newPath = path ? `${path}.${key}` : key;
      
      if (typeof contractPart[key] === 'object' && contractPart[key] !== null) {
        target[key] = {};
        buildTokens(
          contractPart[key] as ThemeContract,
          (themePart?.[key] as ThemeTokens) || {},
          target[key] as ThemeTokens,
          newPath
        );
      } else {
        target[key] = themePart?.[key] as string;
      }
    });
  }
  
  buildTokens(contract as ThemeContract, themeValues, tokens);
  
  return new Theme(tokens);
}