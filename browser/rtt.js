import { tokens, createTokens, responsive } from '../shared/tokens.mjs';

let cachedProperties = null;

const loadCSSProperties = async () => {
  // Return cached if already loaded
  if (cachedProperties !== null) {
    return cachedProperties;
  }
  // Try CDN first (only once)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch('https://raw.githubusercontent.com/mdn/data/main/css/properties.json', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      const allProperties = Object.keys(data);
      const baseProperties = new Set();
      
      allProperties.forEach(prop => {
        const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
        baseProperties.add(baseProp);
      });
      
      cachedProperties = Array.from(baseProperties).sort();
      console.log(`✅ Loaded ${cachedProperties.length} CSS properties from CDN`);
      return cachedProperties;
    }
  } catch (error) {
    console.log('CDN failed, using fallback CSS property list');
    // Use hardcoded fallback (always works)
    const { COMMON_CSS_PROPERTIES } = await import('./commonProps.js');
    cachedProperties = COMMON_CSS_PROPERTIES;
    return cachedProperties;
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
    
    const properties = await loadCSSProperties();
    this.cachedValidProperties = properties;
  },
  getCachedProperties() {
    return this.cachedValidProperties;
  }
};

// Start initialization (non-blocking)
chain.initializeProperties().catch(err => {
  console.error('Failed to load CSS properties:', err.message);
});

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

      if (prop === 'hover') {
        return () => {
          const hoverCatcher = {};
          const hoverHandler = {
            get: (hoverTarget, hoverProp) => {
              if (hoverProp === 'end') {
                return () => {
                  catcher.hover = { ...hoverCatcher };
                  Object.keys(hoverCatcher).forEach(key => delete hoverCatcher[key]);
                  return proxy;
                };
              }
              const cssProperty = hoverProp.replace(/([A-Z])/g, '-$1').toLowerCase();
              if (validProperties && validProperties.length > 0 && !validProperties.includes(cssProperty)) {
                console.warn(`Warning: '${cssProperty}' may not be a valid CSS property`);
              }
              return (value) => {
                hoverCatcher[hoverProp] = resolveToken(value, useTokens);
                return hoverProxy;
              };
            }
          };
          const hoverProxy = new Proxy({}, hoverHandler);
          return hoverProxy;
        };
      }

      if (prop === 'end') {
        return () => {
          return proxy;
        };
      }

      if (prop === 'select') {
        return function(selector) {
          const props = {};
          const selectorProxy = new Proxy({}, {
            get: (target, methodProp) => {
              if (methodProp === 'block') {
                return function() {
                  return {
                    selectors: [selector],
                    ...props
                  };
                };
              }
              return function(value) {
                props[methodProp] = resolveToken(value, useTokens);
                return selectorProxy;
              };
            }
          });
          return selectorProxy;
        };
      }

      // At-Rules
      if (prop === 'media') {
        return function(query, callback) {
          const subChain = $(useTokens);
          const result = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'media',
            query: query,
            styles: result
          });
          return proxy;
        };
      }

      if (prop === 'keyframes') {
        return function(name, callback) {
          const keyframeContext = { _keyframeSteps: {} };
          const keyframeProxy = new Proxy(keyframeContext, {
            get: (target, stepProp) => {
              if (stepProp === 'from' || stepProp === 'to') {
                return function(stepCallback) {
                  const subChain = $(useTokens);
                  const properties = stepCallback(subChain).block();
                  target._keyframeSteps[stepProp] = properties;
                  return keyframeProxy;
                };
              }
              if (stepProp === 'percent') {
                return function(value, stepCallback) {
                  const subChain = $(useTokens);
                  const properties = stepCallback(subChain).block();
                  target._keyframeSteps[`${value}%`] = properties;
                  return keyframeProxy;
                };
              }
              return undefined;
            }
          });
          callback(keyframeProxy);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'keyframes',
            name: name,
            steps: keyframeContext._keyframeSteps
          });
          return proxy;
        };
      }

      if (prop === 'fontFace') {
        return function(callback) {
          const subChain = $(useTokens);
          const fontProps = callback(subChain).block();
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'font-face',
            properties: fontProps
          });
          return proxy;
        };
      }

      if (prop === 'supports') {
        return function(condition, callback) {
          const subChain = $(useTokens);
          const styles = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'supports',
            condition: condition,
            styles: styles
          });
          return proxy;
        };
      }

      if (prop === 'container') {
        return function(condition, callback) {
          const subChain = $(useTokens);
          const styles = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'container',
            condition: condition,
            styles: styles
          });
          return proxy;
        };
      }

      if (prop === 'layer') {
        return function(name, callback) {
          const subChain = $(useTokens);
          const styles = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'layer',
            name: name,
            styles: styles
          });
          return proxy;
        };
      }

      if (prop === 'counterStyle') {
        return function(name, callback) {
          const subChain = $(useTokens);
          const properties = callback(subChain).block();
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'counter-style',
            name: name,
            properties: properties
          });
          return proxy;
        };
      }

      if (prop === 'property') {
        return function(name, callback) {
          const subChain = $(useTokens);
          const descriptors = callback(subChain).block();
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'property',
            name: name,
            descriptors: descriptors
          });
          return proxy;
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
      
      // Generate normal styles
      let normalCSS = '';
      for (let prop in element) {
        if (element.hasOwnProperty(prop) && prop !== 'selectors' && prop !== 'hover') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          normalCSS += `  ${kebabKey}: ${element[prop]};\n`;
        }
      }
      if (normalCSS) {
        cssString += `${selectors.join(', ')} {\n${normalCSS}}\n`;
      }
      
      // Generate hover styles
      if (element.hover && typeof element.hover === 'object') {
        let hoverCSS = '';
        for (let prop in element.hover) {
          if (element.hover.hasOwnProperty(prop) && prop !== 'selectors') {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            hoverCSS += `  ${kebabKey}: ${element.hover[prop]};\n`;
          }
        }
        if (hoverCSS) {
          const hoverSelectors = selectors.map(s => `${s}:hover`);
          cssString += `${hoverSelectors.join(', ')} {\n${hoverCSS}}\n`;
        }
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