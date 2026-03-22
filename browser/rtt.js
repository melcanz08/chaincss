import { tokens, createTokens, responsive } from '../shared/tokens.mjs';

let cssProperties = [];

const loadCSSProperties = async () => {
  try {
    const module = await import('../node/css-properties.json', { 
      assert: { type: 'json' }
    });
    return module.default;
  } catch (e) {
    console.log('CSS properties file not found in package, will fetch from CDN');
    return null;
  }
};

const chain = {
  cssOutput: undefined,
  catcher: {},
  cachedValidProperties: [],
  async initializeProperties() {
    if (this.cachedValidProperties.length > 0) {
      return;
    }
    
    const localProperties = await loadCSSProperties();
    if (localProperties && localProperties.length > 0) {
      this.cachedValidProperties = localProperties;
      return;
    }
    
    try {
      console.log('Loading CSS properties from CDN...');
      const response = await fetch('https://raw.githubusercontent.com/mdn/data/main/css/properties.json');
      const data = await response.json();
      const allProperties = Object.keys(data);
      
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

function $(useTokens = true) {
  const regularStyles = {};
  const hoverStyles = {};
  let isBuildingHover = false;
  
  const validProperties = chain.cachedValidProperties;
  
  // Create the main proxy
  const createProxy = () => {
    const handler = {
      get: (target, prop) => {
        // Handle .block()
        if (prop === 'block') {
          return (...args) => {
            const result = { ...regularStyles };
            
            // Add hover styles if any exist
            if (Object.keys(hoverStyles).length > 0) {
              result.hover = { ...hoverStyles };
            }
            
            if (args.length > 0) {
              result.selectors = args;
            }
            
            // Clear for next use
            Object.keys(regularStyles).forEach(key => delete regularStyles[key]);
            Object.keys(hoverStyles).forEach(key => delete hoverStyles[key]);
            isBuildingHover = false;
            
            return result;
          };
        }
        
        // Handle .hover()
        if (prop === 'hover') {
          return () => {
            isBuildingHover = true;
            return proxy; // Return the same proxy, just with hover mode on
          };
        }

        if(prop==='end'){
          return () => {
            isBuildingHover = false;
            return proxy; // Return the same proxy, but end of hover mode
          };
        }
        
        // Handle regular CSS properties
        const cssProperty = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        if (validProperties && validProperties.length > 0 && !validProperties.includes(cssProperty)) {
          console.warn(`Warning: '${cssProperty}' may not be a valid CSS property`);
        }
        
        return (value) => {
          if (isBuildingHover) {
            hoverStyles[prop] = resolveToken(value, useTokens);
          } else {
            regularStyles[prop] = resolveToken(value, useTokens);
          }
          return proxy;
        };
      }
    };
    
    return new Proxy({}, handler);
  };
  
  const proxy = createProxy();
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
      
      // Generate normal styles
      let normalCSS = '';
      let hoverCSS = '';
      
      for (let prop in element) {
        if (element.hasOwnProperty(prop) && prop !== 'selectors' && prop !== 'hover') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          normalCSS += `  ${kebabKey}: ${element[prop]};\n`;
        }
      }
      
      // Generate hover styles if present
      if (element.hover && typeof element.hover === 'object') {
        for (let prop in element.hover) {
          if (element.hover.hasOwnProperty(prop)) {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            hoverCSS += `  ${kebabKey}: ${element.hover[prop]};\n`;
          }
        }
      }
      
      // Add normal styles
      if (normalCSS) {
        cssString += `${selectors.join(', ')} {\n${normalCSS}}\n`;
      }
      
      // Add hover styles as separate rule
      if (hoverCSS) {
        const hoverSelectors = selectors.map(s => `${s}:hover`);
        cssString += `${hoverSelectors.join(', ')} {\n${hoverCSS}}\n`;
      }
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