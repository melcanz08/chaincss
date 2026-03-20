const path = require('path');
const fs = require('fs');
const https = require('https');
const { tokens, createTokens, responsive } = require('../shared/tokens.cjs');
const chain = {
  cssOutput: undefined,
  catcher: {},
  cachedValidProperties: [],

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
      if (prop === '$') {
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
                return selectorProxy; // Return the proxy for chaining
              };
            }
          });
          
          return selectorProxy;
        };
      }
      if (prop === 'media') {
        return function(query, callback) {
          const subChain = $(useTokens);
          const result = callback(subChain);
          if (!catcher.atRules) catcher.atRules = [];
          catcher.atRules.push({
            type: 'media',
            query: query,
            styles: Array.isArray(result) ? result : [result]
          });
          return proxy;
        };
      }
      if (prop === 'keyframes') {
        return function(name, callback) {
          const keyframeContext = {
            _keyframeSteps: {}
          };
          const keyframeProxy = new Proxy(keyframeContext, {
            get: (target, stepProp) => {
              if (stepProp === 'from' || stepProp === 'to' || stepProp === 'percent') {
                return function(...args) {
                  if (stepProp === 'percent') {
                    const value = args[0];
                    const stepCallback = args[1];
                    const subChain = $(useTokens);
                    const properties = stepCallback(subChain).block();
                    target._keyframeSteps[`${value}%`] = properties;
                  } else {
                    const stepCallback = args[0];
                    const subChain = $(useTokens);
                    const properties = stepCallback(subChain).block();
                    target._keyframeSteps[stepProp] = properties;
                  }
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
            steps: keyframeContext._keyframeSteps,
            atomic: false
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
            properties: fontProps,
            atomic: false 
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
            properties: properties,
            atomic: false
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
            descriptors: descriptors,
            atomic: false
          });
          return proxy;
        };
      }
      if (prop === 'from' || prop === 'to' || prop === 'percent') {
        return function(...args) {
          // Handle percent case: .percent(50, callback)
          if (prop === 'percent') {
            const value = args[0];
            const callback = args[1];
            const subChain = $(useTokens);
            const properties = callback(subChain).block();
            if (!this._keyframeSteps) this._keyframeSteps = {};
            this._keyframeSteps[`${value}%`] = properties;
            return this; // Return this for chaining
          }
          const callback = args[0];
          const subChain = $(useTokens);
          const properties = callback(subChain).block();
          if (!this._keyframeSteps) this._keyframeSteps = {};
          this._keyframeSteps[prop] = properties;
          return this;
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
  if (chain.cachedValidProperties.length === 0) {
    chain.getCSSProperties().catch(err => {
      console.error('Failed to load CSS properties:', err.message);
    });
  }
  return proxy;
}
const run = (...args) => {
  let cssOutput = '';
  args.forEach((value) => {
    if (!value) return;
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
        else {
          const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          mainRuleBody += `  ${kebabKey}: ${value[key]};\n`;
        }
      }
      if (mainRuleBody.trim()) {
        cssOutput += `${value.selectors.join(', ')} {\n${mainRuleBody}}\n`;
      }
      cssOutput += atRulesOutput;
    } 
    else if (value.type) {
      cssOutput += processStandaloneAtRule(value);
    }
  });
  cssOutput = cssOutput.replace(/\n{3,}/g, '\n\n').trim();
  chain.cssOutput = cssOutput;
  return cssOutput;
};
function processAtRule(rule, parentSelectors = null) {
  let output = '';
  switch(rule.type) {
    case 'media':
      if (parentSelectors) {
        let mediaBody = '';
        if (rule.styles) {
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
      if (Array.isArray(rule.styles)) {
        rule.styles.forEach(styleObj => {
          if (styleObj.selectors) {
            let ruleBody = '';
            for (let prop in styleObj) {
              if (prop !== 'selectors' && styleObj.hasOwnProperty(prop)) {
                const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                ruleBody += `    ${kebabKey}: ${styleObj[prop]};\n`;
              }
            }
            if (ruleBody.trim()) {
              output += `  ${styleObj.selectors.join(', ')} {\n${ruleBody}  }\n`;
            }
          }
        });
      }
      else if (rule.styles && rule.styles.selectors) {
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
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `    ${kebabKey}: ${rule.steps[step][prop]};\n`;
        }
        output += '  }\n';
      }
      output += '}\n';
      break;
    case 'font-face':
      output = '@font-face {\n';
      for (let prop in rule.properties) {
        const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
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
        const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
      }
      output += '}\n';
      break;
    case 'keyframes':
      output = `@keyframes ${rule.name} {\n`;
      for (let step in rule.steps) {
        output += `  ${step} {\n`;
        for (let prop in rule.steps[step]) {
          const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          output += `    ${kebabKey}: ${rule.steps[step][prop]};\n`;
        }
        output += '  }\n';
      }
      output += '}\n';
      break;
    case 'counter-style':
      output = `@counter-style ${rule.name} {\n`;
      for (let prop in rule.properties) {
        const kebabKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        output += `  ${kebabKey}: ${rule.properties[prop]};\n`;
      }
      output += '}\n';
      break;
    case 'property':
      output = `@property ${rule.name} {\n`;
      for (let desc in rule.descriptors) {
        const kebabKey = desc.replace(/([A-Z])/g, '-$1').toLowerCase();
        output += `  ${kebabKey}: ${rule.descriptors[desc]};\n`;
      }
      output += '}\n';
      break;
  }
  return output;
}
const compile = (obj) => {
  let cssString = '';
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const element = obj[key];
      if (element.atRules && Array.isArray(element.atRules)) {
        element.atRules.forEach(rule => {
          cssString += processAtRule(rule, null);
        });
        continue;
      }
      if (element.selectors) {
        let elementCSS = '';
        let atRulesCSS = '';
        for (let prop in element) {
          if (prop === 'selectors' || !element.hasOwnProperty(prop)) continue;
          if (prop === 'atRules' && Array.isArray(element[prop])) {
            element[prop].forEach(rule => {
              atRulesCSS += processAtRule(rule, element.selectors);
            });
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
      else {
        console.log(`Warning: Unknown element type for key "${key}":`, element);
      }
    }
  }
  chain.cssOutput = cssString.trim();
  return chain.cssOutput;
};
module.exports = {
  chain,
  $,
  run,
  compile,
  createTokens,
  responsive
};