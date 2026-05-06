// Svelte integration — optional peer dependency
// @ts-nocheck
import { onDestroy, getContext, setContext } from 'svelte';
import { writable, derived, type Writable, type Readable, get } from 'svelte/store';
import { compileRuntime, styleInjector, removeRuntimeModule } from './injector.js';

export function useAtomicClasses() { return { subscribe: () => {}, get: () => ({}) }; }
export function cx(...args: any[]) { return args.filter(Boolean).join(' '); }
export function ChainCSSGlobal() { return null; }
export function createStyledComponent() { return () => null; }
export function createStyledComponents() { return {}; }
export function useComputedStyles() { return { subscribe: () => {}, get: () => '' }; }
export function provideStyleContext() {}
export function injectStyleContext() { return {}; }
export function chainStyles() { return {}; }
