export function createThemeContract(contractShape) {
  // Store the contract for validation
  const contract = contractShape;
  
  // Create a proxy that validates token access
  const contractProxy = new Proxy(contract, {
    get(target, prop) {
      if (prop === '__isContract') return true;
      if (prop === '__validate') return (theme) => validateTheme(contract, theme);
      return target[prop];
    }
  });
  
  return contractProxy;
}

export function validateTheme(contract, theme, path = '') {
  const errors = [];
  
  function validate(contractPart, themePart, currentPath) {
    if (typeof contractPart === 'object' && contractPart !== null) {
      // Check if theme has all required keys
      const requiredKeys = Object.keys(contractPart);
      const themeKeys = Object.keys(themePart || {});
      
      requiredKeys.forEach(key => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        if (!themePart || !themePart.hasOwnProperty(key)) {
          errors.push(` Missing required token: "${newPath}"`);
        } else {
          validate(contractPart[key], themePart[key], newPath);
        }
      });
      
      // Warn about extra keys (optional, could be allowed)
      themeKeys.forEach(key => {
        if (!contractPart.hasOwnProperty(key)) {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          console.warn(` Extra token not in contract: "${newPath}"`);
        }
      });
    } else {
      // Leaf node - just check type (optional)
      if (typeof themePart !== 'string') {
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

export function createTheme(contract, themeValues) {
  // Validate at creation time
  if (contract.__isContract) {
    contract.__validate(themeValues);
  } else {
    validateTheme(contract, themeValues);
  }
  
  // Create the actual theme tokens
  const tokens = {};
  
  function buildTokens(contractPart, themePart, target, path = '') {
    Object.keys(contractPart).forEach(key => {
      const newPath = path ? `${path}.${key}` : key;
      
      if (typeof contractPart[key] === 'object' && contractPart[key] !== null) {
        target[key] = {};
        buildTokens(contractPart[key], themePart[key] || {}, target[key], newPath);
      } else {
        target[key] = themePart[key];
      }
    });
  }
  
  buildTokens(contract, themeValues, tokens);
  
  // Add getter method
  tokens.get = (path) => {
    const parts = path.split('.');
    let current = tokens;
    for (const part of parts) {
      if (current === undefined) return undefined;
      current = current[part];
    }
    return current;
  };
  
  return tokens;
}