// src/frameworks/core/adapter/browser-adapter.ts
// Browser runtime adapter

import { RuntimeAdapter, StyleElement } from './types.js';

export class BrowserAdapter implements RuntimeAdapter {
  isBrowser = true;

  getElement(id: string): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id);
  }

  getHead(): HTMLHeadElement | null {
    if (typeof document === 'undefined') return null;
    return document.head;
  }

  createStyleElement(className: string): HTMLStyleElement {
    const el = document.createElement('style');
    el.className = className;
    return el;
  }

  appendStyleElement(element: HTMLStyleElement): void {
    if (typeof document === 'undefined') return;
    document.head.appendChild(element);
  }

  removeStyleElement(id: string): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  getStyleElements(): HTMLStyleElement[] {
    if (typeof document === 'undefined') return [];
    return Array.from(document.querySelectorAll('style[data-chaincss]'));
  }

  injectCSS(css: string, id?: string): void {
    if (typeof document === 'undefined') return;
    const styleId = id || `chaincss-${Date.now()}`;
    const existing = document.getElementById(styleId);
    if (existing) {
      existing.textContent = css;
      return;
    }
    const style = document.createElement('style');
    style.id = styleId;
    style.setAttribute('data-chaincss', '');
    style.textContent = css;
    document.head.appendChild(style);
  }

  removeCSS(id: string): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  hasStyleElement(id: string): boolean {
    if (typeof document === 'undefined') return false;
    return !!document.getElementById(id);
  }

  getStyleContent(id: string): string | null {
    if (typeof document === 'undefined') return null;
    const el = document.getElementById(id);
    return el?.textContent || null;
  }
}
