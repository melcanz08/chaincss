const path = require('path');
const fs = require('fs');
const https = require('https');
const {tokens, DesignTokens } = require('../shared/tokens.cjs');
const { COMMON_CSS_PROPERTIES } = require('../browser/commonProps.js');

// Remove the hardcoded atomicOptimizer instance
let atomicOptimizer = null;

// Function to set the atomic optimizer from outside
function setAtomicOptimizer(optimizer) {
  atomicOptimizer = optimizer;
}

function configureAtomic(opts) { 
  if (atomicOptimizer) {
    Object.assign(atomicOptimizer.options, opts);
  }
}

// Helper function for Node.js HTTP requests (for older Node versions)
const fetchWithHttps = (url) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout'));
    }, 3000);
    
    const req = https.get(url, (response) => {
      clearTimeout(timeout);
      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

const loadCSSProperties = async () => {
  // Return cached if already loaded
  if (chain.cachedValidProperties !== null) {
    return chain.cachedValidProperties;
  }
  
  // Try CDN first (only once) - same as runtime
  try {
    const url = 'https://raw.githubusercontent.com/mdn/data/main/css/properties.json';
    let data;
    
    // Use fetch if available (Node 18+), otherwise use https
    if (globalThis.fetch) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      data = await response.json();
    } else {
      // Fallback for older Node versions
      data = await fetchWithHttps(url);
    }
    
    const allProperties = Object.keys(data);
    const baseProperties = new Set();
    
    allProperties.forEach(prop => {
      const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
      baseProperties.add(baseProp);
    });
    
    chain.cachedValidProperties = Array.from(baseProperties).sort();
    return chain.cachedValidProperties;
    
  } catch (error) {
    // Use imported fallback (clean and separate)
    chain.cachedValidProperties = COMMON_CSS_PROPERTIES;
    return chain.cachedValidProperties;
  }
};

const chain = {
  cssOutput: undefined,
  catcher: {},
  cachedValidProperties: [],
  classMap: {},
  atomicStats: null,

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

chain.initializeProperties();

//token pointer
const originalToken = tokens;

let currentTokenContext = null;

// createTokens pointer
function createTokens(tokenValues) {
  const tokenObj = new DesignTokens(tokenValues);
  currentTokenContext = tokenObj;
  return tokenObj;
}

function $(useTokens = true) {
  const catcher = {};
  let validProperties = chain.cachedValidProperties;
  const tokenContext = currentTokenContext || null;

  const resolveToken = (value) => {
    if (!useTokens || typeof value !== 'string') return value;
    
    // Check if string contains any token patterns
    if (value.includes('$')) {
      // Replace all $token.path patterns with their resolved values
      return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match, path) => {
        if (tokenContext) {
          const resolved = tokenContext.get(path);
          if (resolved !== undefined) {
            return resolved;
          }
        }
        // Also try global tokens as fallback
        const globalResolved = tokens.get(path);
        if (globalResolved !== undefined) {
          return globalResolved;
        }
        return match; // Return original if not found
      });
    }
    
    return value;
  };
  
  const handler = {
    get: (target, prop) => {
      // Handle .block()
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

      // Handle .hover()
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

      // Handle .end()
      if (prop === 'end') {
        return () => {
          return proxy;
        };
      }

      // Handle .select() - nested selectors
      if (prop === 'select') {
        return function(selector) {
          const nestedStyles = {};
          const nestedHandler = {
            get: (nestedTarget, nestedProp) => {
              if (nestedProp === 'block') {
                return () => {
                  if (!catcher.nestedRules) catcher.nestedRules = [];
                  catcher.nestedRules.push({
                    selector: selector,
                    styles: { ...nestedStyles }
                  });
                  return proxy;
                };
              }
              return (value) => {
                nestedStyles[nestedProp] = resolveToken(value, useTokens);
                return nestedProxy;
              };
            }
          };
          const nestedProxy = new Proxy({}, nestedHandler);
          return nestedProxy;
        };
      }

      // ========== AT-RULES ==========

      // @media
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

      // @keyframes
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

      // @font-face
      if (prop === 'fontFace') {
        return function(callback) {
          const fontProps = {};
          const fontHandler = {
            get: (target, fontProp) => {
              return (value) => {
                fontProps[fontProp] = resolveToken(value, useTokens);
                return fontProxy;
              };
            }
          };
          const fontProxy = new Proxy({}, fontHandler);
          callback(fontProxy);
          
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'font-face',
            properties: fontProps
          });
          return proxy;
        };
      }

      // @supports
      if (prop === 'supports') {
        return function(condition, callback) {
          const subChain = $(useTokens);
          const result = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'supports',
            condition: condition,
            styles: result
          });
          return proxy;
        };
      }

      // @container
      if (prop === 'container') {
        return function(condition, callback) {
          const subChain = $(useTokens);
          const result = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'container',
            condition: condition,
            styles: result
          });
          return proxy;
        };
      }

      // @layer
      if (prop === 'layer') {
        return function(name, callback) {
          const subChain = $(useTokens);
          const result = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'layer',
            name: name,
            styles: result
          });
          return proxy;
        };
      }

      // @counter-style
      if (prop === 'counterStyle') {
        return function(name, callback) {
          const counterProps = {};
          const counterHandler = {
            get: (target, counterProp) => {
              return (value) => {
                counterProps[counterProp] = resolveToken(value, useTokens);
                return counterProxy;
              };
            }
          };
          const counterProxy = new Proxy({}, counterHandler);
          callback(counterProxy);
          
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'counter-style',
            name: name,
            properties: counterProps
          });
          return proxy;
        };
      }

      // @property
      if (prop === 'property') {
        return function(name, callback) {
          const propertyDescs = {};
          const propertyHandler = {
            get: (target, descProp) => {
              return (value) => {
                propertyDescs[descProp] = resolveToken(value, useTokens);
                return propertyProxy;
              };
            }
          };
          const propertyProxy = new Proxy({}, propertyHandler);
          callback(propertyProxy);
          
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'property',
            name: name,
            descriptors: propertyDescs
          });
          return proxy;
        };
      }

      // theme method
      if (prop === 'theme') {
        return function(themeTokens, callback) {
          const originalTokens = tokens;
          
          const themeTokenStore = {
            get: (path) => {
              const themeValue = themeTokens.get ? themeTokens.get(path) : null;
              if (themeValue !== null && themeValue !== undefined) {
                return themeValue;
              }
              return originalTokens.get(path);
            },
            ...themeTokens
          };
          
          const tokenProxy = new Proxy(themeTokenStore, {
            get: (target, prop) => {
              if (prop === 'get') {
                return target.get.bind(target);
              }
              return target[prop];
            }
          });
          
          const originalTokensRef = globalThis.__CHAINCSS_TOKENS__ || tokens;
          const tempTokens = themeTokenStore;
          
          const themed$ = (useTokens = true) => {
            const originalResolver = resolveToken;
            
            const themeResolver = (value, useTokensFlag) => {
              if (!useTokensFlag || typeof value !== 'string' || !value.startsWith('$')) {
                return value;
              }
              const tokenPath = value.slice(1);
              const tokenValue = tempTokens.get(tokenPath);
              return tokenValue || value;
            };
            
            globalThis.__CHAINCSS_TEMP_RESOLVER__ = themeResolver;
            
            const result = $(useTokens);
            
            delete globalThis.__CHAINCSS_TEMP_RESOLVER__;
            
            return result;
          };
          
          const result = callback(themed$);
          
          if (!catcher.themes) catcher.themes = [];
          catcher.themes.push({
            name: `theme-${Date.now()}`,
            styles: result,
            tokens: themeTokens,
            fallback: originalTokens
          });
          
          return proxy;
        };
      }

      // Regular CSS properties
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

// Process at-rules for CSS generation
function processAtRule(rule, parentSelectors = null) {
  let output = '';
  
  switch(rule.type) {
    case 'media':
      if (parentSelectors) {
        let mediaBody = '';
        if (rule.styles && typeof rule.styles === 'object') {
          for (let prop in rule.styles) {
            if (prop !== 'selectors' && rule.styles.hasOwnProperty(prop)) {
              const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              mediaBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
            }
          }
        }
        if (mediaBody.trim()) {
          output = `@media ${rule.query} {\n  ${parentSelectors.join(', ')} {\n${mediaBody}  }\n}\n`;
        }
      } else {
        output = `@media ${rule.query} {\n`;
        if (rule.styles && rule.styles.selectors) {
          let ruleBody = '';
          for (let prop in rule.styles) {
            if (prop !== 'selectors' && rule.styles.hasOwnProperty(prop)) {
              const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              ruleBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
            }
          }
          if (ruleBody.trim()) {
            output += `  ${rule.styles.selectors.join(', ')} {\n${ruleBody}  }\n`;
          }
        }
        output += '}\n';
      }
      break;
      
    case 'keyframes':
      output = `@keyframes ${rule.name} {\n`;
      for (let step in rule.steps) {
        output += `  ${step} {\n`;
        for (let prop in rule.steps[step]) {
          if (prop !== 'selectors') {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            output += `    ${kebabKey}: ${rule.steps[step][prop]};\n`;
          }
        }
        output += '  }\n';
      }
      output += '}\n';
      break;
      
    case 'font-face':
      output = '@font-face {\n';
      for (let prop in rule.properties) {
        if (prop !== 'selectors') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'supports':
      output = `@supports ${rule.condition} {\n`;
      if (rule.styles && rule.styles.selectors) {
        let ruleBody = '';
        for (let prop in rule.styles) {
          if (prop !== 'selectors' && rule.styles.hasOwnProperty(prop)) {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            ruleBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
          }
        }
        if (ruleBody.trim()) {
          output += `  ${rule.styles.selectors.join(', ')} {\n${ruleBody}  }\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'container':
      output = `@container ${rule.condition} {\n`;
      if (rule.styles && rule.styles.selectors) {
        let ruleBody = '';
        for (let prop in rule.styles) {
          if (prop !== 'selectors' && rule.styles.hasOwnProperty(prop)) {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            ruleBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
          }
        }
        if (ruleBody.trim()) {
          output += `  ${rule.styles.selectors.join(', ')} {\n${ruleBody}  }\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'layer':
      output = `@layer ${rule.name} {\n`;
      if (rule.styles && rule.styles.selectors) {
        let ruleBody = '';
        for (let prop in rule.styles) {
          if (prop !== 'selectors' && rule.styles.hasOwnProperty(prop)) {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            ruleBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
          }
        }
        if (ruleBody.trim()) {
          output += `  ${rule.styles.selectors.join(', ')} {\n${ruleBody}  }\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'counter-style':
      output = `@counter-style ${rule.name} {\n`;
      for (let prop in rule.properties) {
        if (prop !== 'selectors') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'property':
      output = `@property ${rule.name} {\n`;
      for (let desc in rule.descriptors) {
        if (desc !== 'selectors') {
          const kebabKey = desc.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.descriptors[desc]};\n`;
        }
      }
      output += '}\n';
      break;
  }
  
  return output;
}

function processStandaloneAtRule(rule) {
  let output = '';
  
  switch(rule.type) {
    case 'font-face':
      output = '@font-face {\n';
      for (let prop in rule.properties) {
        if (prop !== 'selectors') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'keyframes':
      output = `@keyframes ${rule.name} {\n`;
      for (let step in rule.steps) {
        output += `  ${step} {\n`;
        for (let prop in rule.steps[step]) {
          if (prop !== 'selectors') {
            const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            output += `    ${kebabKey}: ${rule.steps[step][prop]};\n`;
          }
        }
        output += '  }\n';
      }
      output += '}\n';
      break;
      
    case 'counter-style':
      output = `@counter-style ${rule.name} {\n`;
      for (let prop in rule.properties) {
        if (prop !== 'selectors') {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
        }
      }
      output += '}\n';
      break;
      
    case 'property':
      output = `@property ${rule.name} {\n`;
      for (let desc in rule.descriptors) {
        if (desc !== 'selectors') {
          const kebabKey = desc.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `  ${kebabKey}: ${rule.descriptors[desc]};\n`;
        }
      }
      output += '}\n';
      break;
  }
  
  return output;
}

// btt.js - Updated run() function
const run = (...args) => {
  let cssOutput = '';
  const styleObjs = [];

  args.forEach((value) => {
    if (!value) return;
    styleObjs.push(value);

    if (value.selectors) {
      let mainRuleBody = '';
      let atRulesOutput = '';
      
      for (let key in value) {
        if (key === 'selectors' || !value.hasOwnProperty(key)) continue;
        
        if (key === 'atRules' && Array.isArray(value[key])) {
          value[key].forEach(rule => { 
            atRulesOutput += processAtRule(rule, value.selectors); 
          });
          continue;
        }
        
        if (key === 'nestedRules' && Array.isArray(value[key])) {
          value[key].forEach(rule => {
            let nestedBody = '';
            for (let prop in rule.styles) {
              const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              nestedBody += `    ${kebabKey}: ${rule.styles[prop]};\n`;
            }
            if (nestedBody) {
              atRulesOutput += `${value.selectors.join(', ')} ${rule.selector} {\n${nestedBody}  }\n`;
            }
          });
          continue;
        }
        
        if (key === 'hover' && typeof value[key] === 'object') {
          let hoverBody = '';
          for (let hoverKey in value[key]) {
            const kebabKey = hoverKey.replace(/([A-Z])/g, '-$1').toLowerCase();
            hoverBody += `  ${kebabKey}: ${value[key][hoverKey]};\n`;
          }
          if (hoverBody) {
            cssOutput += `${value.selectors.join(', ')}:hover {\n${hoverBody}}\n`;
          }
          continue;
        }
        
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        mainRuleBody += `  ${kebabKey}: ${value[key]};\n`;
      }
      
      if (mainRuleBody.trim()) {
        cssOutput += `${value.selectors.join(', ')} {\n${mainRuleBody}}\n`;
      }
      cssOutput += atRulesOutput;
      
    } else if (value.type) {
      cssOutput += processStandaloneAtRule(value);
    }
  });

  cssOutput = cssOutput.replace(/\n{3,}/g, '\n\n').trim();
  chain.cssOutput = cssOutput;

  // Use the injected atomic optimizer
  if (atomicOptimizer && atomicOptimizer.options.enabled) {
    const result = atomicOptimizer.optimize(styleObjs);
    
    // IMPORTANT: In component-first mode, we need to combine
    // atomic utilities with the component CSS
    if (atomicOptimizer.options.outputStrategy === 'component-first') {
      // Component CSS already contains all styles, but we want to add
      // atomic utilities as optional extras. The atomic optimizer's result.css
      // already includes atomicCSS + componentCSS (with all styles)
      chain.cssOutput = result.css;
    } else {
      // utility-first mode
      chain.cssOutput = result.css;
    }
    
    chain.classMap = result.map;
    chain.atomicStats = result.stats;
    return chain.cssOutput;
  }
  
  return cssOutput;
};

const compile = (obj) => {
  let cssString = '';
  const collected = [];

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    const element = obj[key];

    // Handle themes
    if (element.themes && Array.isArray(element.themes)) {
      element.themes.forEach(theme => {
        if (theme.styles && theme.styles.selectors) {
          let themeCSS = '';
          let themeSelectors = theme.styles.selectors || [];
          
          for (let prop in theme.styles) {
            if (prop !== 'selectors' && theme.styles.hasOwnProperty(prop)) {
              const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              themeCSS += `  ${kebabKey}: ${theme.styles[prop]};\n`;
            }
          }
          
          if (themeCSS) {
            cssString += `${themeSelectors.join(', ')} {\n${themeCSS}}\n`;
          }
        }
      });
      continue;
    }

    if (element.atRules && Array.isArray(element.atRules)) {
      element.atRules.forEach(rule => { 
        cssString += processAtRule(rule, null); 
      });
      continue;
    }
    
    if (element.selectors) {
      collected.push(element);
      let elementCSS = '';
      let atRulesCSS = '';
      
      for (let prop in element) {
        if (prop === 'selectors' || !element.hasOwnProperty(prop)) continue;
        
        if (prop === 'atRules' && Array.isArray(element[prop])) {
          element[prop].forEach(rule => { 
            atRulesCSS += processAtRule(rule, element.selectors); 
          });
        } else if (prop === 'themes' && Array.isArray(element[prop])) {
          continue;
        } else if (prop === 'hover' && typeof element[prop] === 'object') {
          let hoverBody = '';
          for (let hoverKey in element[prop]) {
            const kebabKey = hoverKey.replace(/([A-Z])/g, '-$1').toLowerCase();
            hoverBody += `  ${kebabKey}: ${element[prop][hoverKey]};\n`;
          }
          if (hoverBody) {
            cssString += `${element.selectors.join(', ')}:hover {\n${hoverBody}}\n`;
          }
        } else {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          elementCSS += `  ${kebabKey}: ${element[prop]};\n`;
        }
      }
      
      if (elementCSS.trim()) {
        cssString += `${element.selectors.join(', ')} {\n${elementCSS}}\n`;
      }
      cssString += atRulesCSS;
    }
  }

  chain.cssOutput = cssString.trim();

  // Use the injected atomic optimizer instead of a local instance
  if (atomicOptimizer && atomicOptimizer.options.enabled) {
    const result = atomicOptimizer.optimize(collected);
    chain.cssOutput = result.css;
    chain.classMap = result.map;
    chain.atomicStats = result.stats;
    chain.componentMap = result.componentMap; 
    return result.css;
  }
  
  return chain.cssOutput;
};

function recipe(options) {
  const {
    base,
    variants = {},
    defaultVariants = {},
    compoundVariants = []
  } = options;

  const baseStyle = typeof base === 'function' ? base() : base;
  const variantStyles = {};
  
  for (const [variantName, variantMap] of Object.entries(variants)) {
    variantStyles[variantName] = {};
    for (const [variantKey, variantStyle] of Object.entries(variantMap)) {
      variantStyles[variantName][variantKey] = typeof variantStyle === 'function' 
        ? variantStyle() 
        : variantStyle;
    }
  }

  const compoundStyles = compoundVariants.map(cv => ({
    condition: cv.variants || cv,
    style: typeof cv.style === 'function' ? cv.style() : cv.style
  }));

  function mergeStyles(...styles) {
    const merged = {};
    for (const style of styles) {
      if (!style) continue;
      for (const [key, value] of Object.entries(style)) {
        if (key === 'selectors') {
          merged.selectors = merged.selectors || [];
          merged.selectors.push(...(Array.isArray(value) ? value : [value]));
        } else if (key === 'hover' && typeof value === 'object') {
          if (!merged.hover) merged.hover = {};
          Object.assign(merged.hover, value);
        } else if (key !== 'selectors') {
          merged[key] = value;
        }
      }
    }
    return merged;
  }

  function pick(variantSelection = {}) {
    const selected = { ...defaultVariants, ...variantSelection };
    const stylesToMerge = [];
    
    if (baseStyle) stylesToMerge.push(baseStyle);
    for (const [variantName, variantValue] of Object.entries(selected)) {
      const variantStyle = variantStyles[variantName]?.[variantValue];
      if (variantStyle) stylesToMerge.push(variantStyle);
    }
    for (const cv of compoundStyles) {
      const matches = Object.entries(cv.condition).every(
        ([key, value]) => selected[key] === value
      );
      if (matches && cv.style) stylesToMerge.push(cv.style);
    }
    
    const merged = mergeStyles(...stylesToMerge);
    
    const styleBuilder = $(true);
    for (const [prop, value] of Object.entries(merged)) {
      if (prop === 'selectors' || prop === 'hover') continue;
      if (styleBuilder[prop]) styleBuilder[prop](value);
    }
    
    if (merged.hover) {
      styleBuilder.hover();
      for (const [hoverProp, hoverValue] of Object.entries(merged.hover)) {
        if (styleBuilder[hoverProp]) styleBuilder[hoverProp](hoverValue);
      }
      styleBuilder.end();
    }
    
    const selectors = merged.selectors || [];
    return styleBuilder.block(...selectors);
  }
  
  pick.variants = variants;
  pick.defaultVariants = defaultVariants;
  pick.base = baseStyle;
  
  pick.getAllVariants = () => {
    const result = [];
    const variantKeys = Object.keys(variants);
    
    function generate(current, index) {
      if (index === variantKeys.length) {
        result.push({ ...current });
        return;
      }
      const variantName = variantKeys[index];
      for (const variantValue of Object.keys(variants[variantName])) {
        current[variantName] = variantValue;
        generate(current, index + 1);
      }
    }
    
    generate({}, 0);
    return result;
  };
  
  pick.compileAll = () => {
    const allVariants = pick.getAllVariants();
    const styles = [];
    
    if (baseStyle) styles.push(baseStyle);
    for (const variantMap of Object.values(variants)) {
      for (const variantStyle of Object.values(variantMap)) {
        if (variantStyle) styles.push(variantStyle);
      }
    }
    for (const cv of compoundStyles) {
      if (cv.style) styles.push(cv.style);
    }
    
    if (atomicOptimizer && atomicOptimizer.options.enabled) {
      const styleObj = {};
      styles.forEach((style, i) => {
        const selectors = style.selectors || [`variant-${i}`];
        styleObj[selectors[0].replace(/^\./, '')] = style;
      });
      const result = atomicOptimizer.optimize(styleObj);
      chain.cssOutput = (chain.cssOutput || '') + result.css;
      chain.classMap = { ...chain.classMap, ...result.map };
      return result.css;
    }
    
    return run(...styles);
  };
  
  return pick;
}

module.exports = {
  chain,
  $,
  run,
  tokens : originalToken,
  compile,
  createTokens,
  configureAtomic,
  setAtomicOptimizer,  // Export this for dependency injection
  atomicOptimizer,     // Will be null until set
  recipe
};