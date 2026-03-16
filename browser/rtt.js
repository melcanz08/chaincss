import { tokens, createTokens, responsive } from '../shared/tokens.mjs';

let cssProperties = [];

// Try to import the JSON file, fallback to fetch if it fails
try {
  // Dynamic import - will fail gracefully if file doesn't exist
  const module = await import('../node/css-properties.json', { 
    assert: { type: 'json' },
    // This prevents the error from breaking the build
    ignore: true 
  });
  cssProperties = module.default;
} catch (e) {
  console.log('CSS properties file not found, will fetch from CDN');
}

const chain = {
  cssOutput: undefined,
  catcher: {},
  cachedValidProperties: [],

  async initializeProperties() { 
    if (cssProperties && cssProperties.length > 0) {
      this.cachedValidProperties = cssProperties;
      return;
    }else{
      try {
        let CDNfallBackProp = [];
        const response = await fetch('https://raw.githubusercontent.com/mdn/data/main/css/properties.json');
        const data = await response.json();
        const allProperties = Object.keys(data);
        
        // Strip vendor prefixes and remove duplicates
        const baseProperties = new Set();
        allProperties.forEach(prop => {
          const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
          baseProperties.add(baseProp);
        });
        CDNfallBackProp = Array.from(baseProperties).sort();
        this.cachedValidProperties = CDNfallBackProp;
      } catch (error) {
        console.error('Error loading from CDN:', error);
        return [];
      }
    }
  },

  // Synchronous version for internal use
  getCachedProperties() {
    return this.cachedValidProperties;
  }
};

// Initialize properties synchronously when module loads
chain.initializeProperties();

const resolveToken = (value, useTokens) => {
  if (!useTokens || typeof value !== 'string' || !value.startsWith('$')) {
    return value;
  }
  
  const tokenPath = value.slice(1);
  const tokenValue = tokens.get(tokenPath);
  
  if (!tokenValue) {
    return value;
  }
  
  return tokenValue;
};

function $(useTokens = true){
  const catcher = {};
  
  // Use cached properties if available
  const validProperties = chain.cachedValidProperties;
  
  const handler = {
    get: (target, prop) => {
      if (prop === 'block') {
        return function(...args) {
          // If no args, just return current catcher
          if (args.length === 0) {
            const result = { ...catcher };
            // Clear catcher
            Object.keys(catcher).forEach(key => delete catcher[key]);
            return result;
          }
          
          // Create result with selectors
          const result = {
            selectors: args,
            ...catcher
          };
          
          // Clear catcher
          Object.keys(catcher).forEach(key => delete catcher[key]);
          
          return result;
        };
      }
      // Convert camelCase to kebab-case for CSS property
      const cssProperty = prop.replace(/([A-Z])/g, '-$1').toLowerCase();     
      // Validate property exists (optional) - use cached properties
      if (validProperties && validProperties.length > 0 && !validProperties.includes(cssProperty)) {
        console.warn(`Warning: '${cssProperty}' may not be a valid CSS property`);
      }
      // Return a function that sets the value
      return function(value) {
        catcher[prop] = resolveToken(value, useTokens);
        return proxy;
      };
    }
  };
  
  // Create the proxy
  const proxy = new Proxy({}, handler);
  
  return proxy;
}

const run = (...args) => {
  let cssOutput = '';
  
  args.forEach((value) => {
    if (value && value.selectors) {
      let rule = `${value.selectors.join(', ')} {\n`;
      
      // Add all properties (excluding 'selectors')
      for (let key in value) {
        if (key !== 'selectors' && value.hasOwnProperty(key)) {
          const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          rule += `  ${kebabKey}: ${value[key]};\n`;
        }
      }
      
      rule += `}\n\n`;
      cssOutput += rule;
    }
  });
  
  chain.cssOutput = cssOutput.trim();
  return cssOutput.trim();
};

const compile = (obj) => {
  let cssString = '';

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const element = obj[key];
      let selectors = element.selectors || [];
      let elementCSS = '';
      
      for (let prop in element) {
        if (element.hasOwnProperty(prop) && prop !== 'selectors') {
          // Convert camelCase to kebab-case
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          elementCSS += `  ${kebabKey}: ${element[prop]};\n`;
        }
      }
      
      cssString += `${selectors.join(', ')} {\n${elementCSS}}\n`;
    }
  }

  chain.cssOutput = cssString.trim();
  return cssString.trim(); // Added return for consistency
};

export {
  chain,
  $,
  run,
  compile,
  tokens,
  createTokens,
  responsive
};