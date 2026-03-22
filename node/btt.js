const path = require('path');
const fs = require('fs');
const https = require('https');
const { tokens, createTokens, responsive } = require('../shared/tokens.cjs');
const { AtomicOptimizer } = require('./atomic-optimizer');

const atomicOptimizer = new AtomicOptimizer({ 
  enabled: false,  // default off; turn on via configure()
  alwaysAtomic: [],
  neverAtomic: ['content', 'animation']
});

function configureAtomic(opts) { 
  Object.assign(atomicOptimizer.options, opts); 
}

const chain = {
  cssOutput: undefined,
  catcher: {},
  cachedValidProperties: [],
  classMap: {},      // For atomic CSS class mapping
  atomicStats: null, // For atomic optimizer stats

  initializeProperties() {
    try {
      const jsonPath = path.join(__dirname, 'css-properties.json');
      if (fs.existsSync(jsonPath)) {
        const data = fs.readFileSync(jsonPath, 'utf8');
        this.cachedValidProperties = JSON.parse(data);
      } else {
        console.log('CSS properties not cached, will load on first use');
      }
    } catch (error) {
      console.error('Error loading CSS properties:', error.message);
    }
  },

  fetchWithHttps(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  },

  async getCSSProperties() {
    try {
      const jsonPath = path.join(__dirname, 'css-properties.json');
      try {
        await fs.promises.access(jsonPath);
        const existingData = await fs.promises.readFile(jsonPath, 'utf8');
        const objProp = JSON.parse(existingData);
        this.cachedValidProperties = objProp;
        return objProp;
      } catch {
        const url = 'https://raw.githubusercontent.com/mdn/data/main/css/properties.json';
        const data = await this.fetchWithHttps(url);
        const allProperties = Object.keys(data);
        const baseProperties = new Set();
        allProperties.forEach(prop => {
          const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
          baseProperties.add(baseProp);
        });
        const cleanProperties = Array.from(baseProperties).sort();
        await fs.promises.writeFile(jsonPath, JSON.stringify(cleanProperties, null, 2));
        this.cachedValidProperties = cleanProperties;
        return cleanProperties;
      }
    } catch (error) {
      console.error('Error loading CSS properties:', error.message);
      return [];
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
  return tokenValue || value;
};

function $(useTokens = true) {
  const catcher = {};
  const validProperties = chain.cachedValidProperties;
  
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

      // Handle .select() - renamed from $ to avoid conflict
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
          const styles = callback(subChain).block();
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
          const styles = callback(subChain).block();
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
          const styles = callback(subChain).block();
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
  
  // Async load CSS properties if needed
  if (chain.cachedValidProperties.length === 0) {
    chain.getCSSProperties().catch(err => {
      console.error('Failed to load CSS properties:', err.message);
    });
  }
  
  return proxy;
}

// Process at-rules
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
        
        if (key === 'hover' && typeof value[key] === 'object') {
          // Handle hover styles
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

  if (atomicOptimizer.options.enabled) {
    const { css, map, stats } = atomicOptimizer.optimize(styleObjs);
    chain.cssOutput = css;
    chain.classMap = map;
    chain.atomicStats = stats;
    return css;
  }
  
  return cssOutput;
};

const compile = (obj) => {
  let cssString = '';
  const collected = [];

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    const element = obj[key];

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

  if (atomicOptimizer.options.enabled) {
    const { css, map, stats } = atomicOptimizer.optimize(collected);
    chain.cssOutput = css;
    chain.classMap = map;
    chain.atomicStats = stats;
    return css;
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

  // Store the original style objects
  const baseStyle = typeof base === 'function' ? base() : base;
  const variantStyles = {};
  
  // Store variant style objects
  for (const [variantName, variantMap] of Object.entries(variants)) {
    variantStyles[variantName] = {};
    for (const [variantKey, variantStyle] of Object.entries(variantMap)) {
      variantStyles[variantName][variantKey] = typeof variantStyle === 'function' 
        ? variantStyle() 
        : variantStyle;
    }
  }

  // Store compound variant styles
  const compoundStyles = compoundVariants.map(cv => ({
    condition: cv.variants || cv,
    style: typeof cv.style === 'function' ? cv.style() : cv.style
  }));

  // Helper to extract atomic class names from a style object
  function getAtomicClasses(styleObj) {
    if (!styleObj) return [];
    
    const classes = [];
    
    // Check if atomic optimizer is enabled and has class mapping
    if (atomicOptimizer.options.enabled && chain.classMap) {
      // Generate a temporary style to get atomic classes
      const tempBuilder = $(true);
      for (const [prop, value] of Object.entries(styleObj)) {
        if (prop !== 'selectors' && prop !== 'hover' && tempBuilder[prop]) {
          tempBuilder[prop](value);
        }
      }
      
      // Add hover styles if present
      if (styleObj.hover) {
        tempBuilder.hover();
        for (const [hoverProp, hoverValue] of Object.entries(styleObj.hover)) {
          if (tempBuilder[hoverProp]) tempBuilder[hoverProp](hoverValue);
        }
        tempBuilder.end();
      }
      
      // Get the style object to extract atomic classes
      const style = tempBuilder.block();
      
      // Find matching atomic classes from the classMap
      // This requires that the atomic optimizer has processed these styles
      const selectorKey = JSON.stringify(style);
      if (chain.classMap[selectorKey]) {
        return chain.classMap[selectorKey].split(' ');
      }
    }
    
    return classes;
  }

  // Helper to merge style objects and return class names
  function mergeStylesToClasses(...styles) {
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
    
    // Generate a unique class name for this combination
    const selectorKey = Object.entries(merged)
      .filter(([k]) => k !== 'selectors' && k !== 'hover')
      .map(([k, v]) => `${k}-${v}`)
      .join('--');
    
    const baseClassName = `recipe-${selectorKey}`;
    
    // Register this style with the atomic optimizer if enabled
    if (atomicOptimizer.options.enabled) {
      // Create a style object with the merged styles
      const styleObj = {
        selectors: [`.${baseClassName}`],
        ...merged
      };
      
      // Process through atomic optimizer
      const { css, map } = atomicOptimizer.optimize({ [baseClassName]: styleObj });
      
      // Store the generated CSS in chain
      if (css) {
        chain.cssOutput = (chain.cssOutput || '') + css;
      }
      
      // Return atomic classes if available, otherwise return the generated class
      if (map && map[`.${baseClassName}`]) {
        return map[`.${baseClassName}`].split(' ');
      }
    }
    
    // Fallback: return the generated class name
    return [baseClassName];
  }

  // The main pick function that returns class names
  function pick(variantSelection = {}) {
    // Merge defaults with selection
    const selected = { ...defaultVariants, ...variantSelection };
    
    // Collect all relevant styles
    const stylesToMerge = [];
    
    // Add base style
    if (baseStyle) stylesToMerge.push(baseStyle);
    
    // Add variant styles
    for (const [variantName, variantValue] of Object.entries(selected)) {
      const variantStyle = variantStyles[variantName]?.[variantValue];
      if (variantStyle) stylesToMerge.push(variantStyle);
    }
    
    // Add compound variants
    for (const cv of compoundStyles) {
      const matches = Object.entries(cv.condition).every(
        ([key, value]) => selected[key] === value
      );
      if (matches && cv.style) stylesToMerge.push(cv.style);
    }
    
    // Merge styles and return class names
    const classNames = mergeStylesToClasses(...stylesToMerge);
    
    // Return as string for easy use
    return classNames.join(' ');
  }
  
  // Add metadata for introspection
  pick.variants = variants;
  pick.defaultVariants = defaultVariants;
  pick.base = baseStyle;
  
  // Helper to get all possible variant combinations
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
  
  // Pre-compile all variants at build time
  pick.compileAll = () => {
    const allVariants = pick.getAllVariants();
    const styles = [];
    
    // Add base
    if (baseStyle) styles.push(baseStyle);
    
    // Add all variant styles
    for (const variantMap of Object.values(variants)) {
      for (const variantStyle of Object.values(variantMap)) {
        if (variantStyle) styles.push(variantStyle);
      }
    }
    
    // Add compound variant styles
    for (const cv of compoundStyles) {
      if (cv.style) styles.push(cv.style);
    }
    
    // Compile all styles through atomic optimizer
    if (atomicOptimizer.options.enabled) {
      const styleObj = {};
      styles.forEach((style, i) => {
        const selectors = style.selectors || [`variant-${i}`];
        styleObj[selectors[0].replace(/^\./, '')] = style;
      });
      const { css, map } = atomicOptimizer.optimize(styleObj);
      chain.cssOutput = (chain.cssOutput || '') + css;
      chain.classMap = { ...chain.classMap, ...map };
      return css;
    }
    
    // Fallback: use run()
    return run(...styles);
  };
  
  // Helper to get CSS for a specific variant combination
  pick.getCSS = (variantSelection = {}) => {
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
    
    // Create a temporary style object to generate CSS
    const tempBuilder = $(true);
    for (const style of stylesToMerge) {
      for (const [prop, value] of Object.entries(style)) {
        if (prop !== 'selectors' && prop !== 'hover' && tempBuilder[prop]) {
          tempBuilder[prop](value);
        }
      }
      if (style.hover) {
        tempBuilder.hover();
        for (const [hoverProp, hoverValue] of Object.entries(style.hover)) {
          if (tempBuilder[hoverProp]) tempBuilder[hoverProp](hoverValue);
        }
        tempBuilder.end();
      }
    }
    
    const mergedStyle = tempBuilder.block();
    const css = compile({ [selected.join('-')]: mergedStyle });
    return css;
  };
  
  return pick;
}

module.exports = {
  chain,
  $,
  run,
  compile,
  createTokens,
  responsive,
  configureAtomic,
  atomicOptimizer,
  recipe
};