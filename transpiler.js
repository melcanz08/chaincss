const path = require('path');
const fs = require('fs');
const tokenModule = require('./tokens');
const tokens = tokenModule.tokens;

const chain = {
  cssOutput: undefined,
  catcher: {},
  cachedValidProperties: [],

  // Initialize properties synchronously
  initializeProperties() {
    try {
      const jsonPath = path.join(__dirname, 'css-properties.json');
      if (fs.existsSync(jsonPath)) {
        const data = fs.readFileSync(jsonPath, 'utf8');
        this.cachedValidProperties = JSON.parse(data);
        
      } else {
        console.log('⚠️ CSS properties not cached, will load on first use');
      }
    } catch (error) {
      console.error('Error loading CSS properties:', error.message);
    }
  },

  async getCSSProperties() {
    try {
      const jsonPath = path.join(__dirname, 'css-properties.json');
      
      // Check if file already exists
      try {
        await fs.promises.access(jsonPath);
        const existingData = await fs.promises.readFile(jsonPath, 'utf8');
        const objProp = JSON.parse(existingData);
        this.cachedValidProperties = objProp;
        return objProp;
      } catch {
        const url = 'https://raw.githubusercontent.com/mdn/data/main/css/properties.json';
        const response = await fetch(url);
        const data = await response.json();
        const allProperties = Object.keys(data);
        
         // Strip vendor prefixes and remove duplicates
        const baseProperties = new Set();
        
        allProperties.forEach(prop => {
          // Remove vendor prefixes (-webkit-, -moz-, -ms-, -o-)
          const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
          baseProperties.add(baseProp);
        });
        
        // Convert Set back to array and sort
        const cleanProperties = Array.from(baseProperties).sort();
        
        // Save cleaned properties
        await fs.promises.writeFile(jsonPath, JSON.stringify(cleanProperties, null, 2));
        
        this.cachedValidProperties = cleanProperties;
        return cleanProperties;
      }
    } catch (error) {
      console.error('Error loading CSS properties:', error.message);
      return [];
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
        return function(...args) {chain
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
        catcher[prop] = resolveToken(value, useTokens);  // ← USE IT HERE
        return proxy;
      };
    }
  };
  
  // Create the proxy
  const proxy = new Proxy({}, handler);
  
  // Trigger async load if needed (don't await)
  if (chain.cachedValidProperties.length === 0) {
    chain.getCSSProperties().catch(err => {
      console.error('Failed to load CSS properties:', err.message);
    });
  }
  
  return proxy;
};

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
};

module.exports = {
  chain,
  $,
  run,
  compile,
  createTokens: tokenModule.createTokens,
  responsive: tokenModule.responsive
};