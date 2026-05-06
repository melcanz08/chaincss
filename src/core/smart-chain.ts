// src/core/smart-chain.ts

import { chain as buildChainFunction } from '../compiler/Chain.js';
import { RuntimeChain } from '../runtime/Chain.js';
import { autoDetector, type AnalysisResult } from './auto-detector.js';

interface SmartCall {
  prop: string;
  value: any;
  args: any[];
  index: number;
}

class SmartChainProxy {
  private calls: SmartCall[] = [];
  private callIndex = 0;
  private useTokens: boolean;
  private readonly MAX_CALLS = 500; // Safety cap
  
  constructor(useTokens: boolean = true) {
    this.useTokens = useTokens;
  }
  
  private recordCall(prop: string, ...args: any[]): this {
    // Safety: prevent unbounded growth
    if (this.calls.length >= this.MAX_CALLS) {
      console.warn('⚠️ ChainCSS: Smart chain call limit reached. Consider using build chain for static styles.');
      return this;
    }
    
    this.calls.push({
      prop,
      value: args[0],
      args,
      index: this.callIndex++
    });
    return this;
  }
  
  private processHybrid(analysis: AnalysisResult, selectors: string[]): any {
    const buildInstance = buildChainFunction(this.useTokens);
    const runtimeInstance = new RuntimeChain(this.useTokens).proxy;
    
    // Apply static parts to build mode
    for (const part of analysis.staticParts) {
      const call = this.calls[part.index];
      if (call && (buildInstance as any)[call.prop]) {
        (buildInstance as any)[call.prop](...call.args);
      }
    }
    
    // Apply dynamic and runtime-only parts to runtime mode
    const allDynamic = [...analysis.dynamicParts, ...analysis.runtimeOnlyParts];
    for (const part of allDynamic) {
      const call = this.calls[part.index];
      if (call && (runtimeInstance as any)[call.prop]) {
        (runtimeInstance as any)[call.prop](...call.args);
      }
    }
    
    const buildResult = buildInstance.$el(...selectors);
    const runtimeResult = runtimeInstance.$el(...selectors);
    
    return {
      ...(typeof buildResult === 'object' ? buildResult : {}),
      ...(typeof runtimeResult === 'object' ? runtimeResult : {}),
      __buildClasses: buildResult,
      __runtimeClasses: runtimeResult,
      __isHybrid: true
    };
  }
  
  private processPureBuild(selectors: string[]): any {
    const buildInstance = buildChainFunction(this.useTokens);
    
    for (const call of this.calls) {
      if ((buildInstance as any)[call.prop]) {
        (buildInstance as any)[call.prop](...call.args);
      }
    }
    
    return buildInstance.$el(...selectors);
  }
  
  private processPureRuntime(selectors: string[]): any {
    const runtimeInstance = new RuntimeChain(this.useTokens).proxy;
    
    for (const call of this.calls) {
      if ((runtimeInstance as any)[call.prop]) {
        (runtimeInstance as any)[call.prop](...call.args);
      }
    }
    
    return runtimeInstance.$el(...selectors);
  }
  
  $el(...selectors: string[]): any {
    if (this.calls.length === 0) {
      return {};
    }
    
    const callsWithIndex = this.calls.map((call, idx) => ({
      prop: call.prop,
      value: call.value,
      index: idx
    }));
    
    const analysis = autoDetector.analyzeChain(callsWithIndex);
    
    // Safety check: prevent recursion if a smart chain is passed to another smart chain
    if (this.calls[0]?.prop === '__isSmartChain') {
      return this.processPureRuntime(selectors);
    }
    
    let result: any;
    switch (analysis.mode) {
      case 'hybrid':
        result = this.processHybrid(analysis, selectors);
        break;
      case 'runtime':
        result = this.processPureRuntime(selectors);
        break;
      case 'build':
      default:
        result = this.processPureBuild(selectors);
        break;
    }
    
    // Clear calls after finalizing to free memory
    this.calls = [];
    this.callIndex = 0;
    
    return result;
  }
  
  getProxy(): any {
    const proxy = new Proxy(this, {
      get(target, prop: string) {
        // Special markers for detection
        if (prop === '__isSmartChain') return true;
        if (prop === '$el') return target.$el.bind(target);
        if (prop === 'then') return undefined; // Prevent Promise resolution issues
        
        // For any other property, record the call and return the proxy
        return (...args: any[]) => {
          target.recordCall(prop, ...args);
          return proxy;
        };
      }
    });
    
    return proxy;
  }
}

export function smartChain(useTokens: boolean = true): any {
  const proxy = new SmartChainProxy(useTokens);
  return proxy.getProxy();
}

// Legacy support functions
export const buildChain = (useTokens?: boolean) => buildChainFunction(useTokens);
export const runtimeChain = (useTokens?: boolean) => new RuntimeChain(useTokens || true).proxy;