import { tokens, createTokens, responsive } from '../shared/tokens.mjs';

let cssProperties = [];

// Instead of using dynamic import with unsupported options
// Use a try-catch with proper dynamic import syntax
const loadCSSProperties = async () => {
  try {
    // Remove the unsupported 'ignore' option
    const module = await import('../node/css-properties.json', { 
      assert: { type: 'json' }
    });
    return module.default;
  } catch (e) {
    // If the file doesn't exist in the package, fallback to CDN
    console.log('CSS properties file not found in package, will fetch from CDN');
    return null;
  }
};

// Initialize asynchronously
const chain = {
  cssOutput: undefined,
  catcher: {},
  cachedValidProperties: [],
  async initializeProperties() {
    if (this.cachedValidProperties.length > 0) {
      return;
    }
    
    // Try to load from local file first
    const localProperties = await loadCSSProperties();
    if (localProperties && localProperties.length > 0) {
      this.cachedValidProperties = localProperties;
      return;
    }
    
    // Fallback to CDN
    try {
      console.log('Loading CSS properties from CDN...');
      const response = await fetch('https://raw.githubusercontent.com/mdn/data/main/css/properties.json');
      const data = await response.json();
      const allProperties = Object.keys(data);
      
      // Strip vendor prefixes and remove duplicates
      const baseProperties = new Set();
      allProperties.forEach(prop => {
        const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
        baseProperties.add(baseProp);
      });
      this.cachedValidProperties = Array.from(baseProperties).sort();
    } catch (error) {
      console.error('Error loading from CDN:', error);
      this.cachedValidProperties = [];
    }
  },
  getCachedProperties() {
    return this.cachedValidProperties;
  }
};

// Start initialization but don't await (non-blocking)
chain.initializeProperties();

// Rest of your code remains the same...
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
  const validProperties = chain.cachedValidProperties;
  const handler = {
    get: (target, prop) => {
      if (prop === 'block') {
        return function(...args) {
          if (args.length === 0) {
            const result = { ...catcher };
            Object.keys(catcher).forEach(key => delete catcher[key]);
            return result;
          }
          const result = {
            selectors: args,
            ...catcher
          };
          Object.keys(catcher).forEach(key => delete catcher[key]);
          return result;
        };
      }
      const cssProperty = prop.replace(/([A-Z])/g, '-$1').toLowerCase();     
      if (validProperties && validProperties.length > 0 && !validProperties.includes(cssProperty)) {
        console.warn(`Warning: '${cssProperty}' may not be a valid CSS property`);
      }
      return function(value) {
        catcher[prop] = resolveToken(value, useTokens);
        return proxy;
      };
    }
  };
  const proxy = new Proxy({}, handler);
  return proxy;
}

const run = (...args) => {
  let cssOutput = '';
  args.forEach((value) => {
    if (value && value.selectors) {
      let rule = `${value.selectors.join(', ')} {\n`;
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
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          elementCSS += `  ${kebabKey}: ${element[prop]};\n`;
        }
      }
      cssString += `${selectors.join(', ')} {\n${elementCSS}}\n`;
    }
  }
  chain.cssOutput = cssString.trim();
  return cssString.trim();
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