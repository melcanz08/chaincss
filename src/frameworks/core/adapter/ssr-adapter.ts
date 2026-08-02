// src/frameworks/core/adapter/ssr-adapter.ts
// SSR runtime adapter

import { RuntimeAdapter, StyleElement } from "./types.js";

export class SSRAdapter implements RuntimeAdapter {
  isBrowser = false;
  private styles: Map<string, { element: any; css: string }> = new Map();
  private headElements: any[] = [];

  getElement(id: string): any | null {
    return null;
  }

  getHead(): any | null {
    return null;
  }

  createStyleElement(className: string): any {
    return { className, id: className };
  }

  appendStyleElement(element: any): void {
    // Store for later extraction
    this.headElements.push(element);
  }

  removeStyleElement(id: string): void {
    this.styles.delete(id);
    this.headElements = this.headElements.filter((el: any) => el.id !== id);
  }

  getStyleElements(): any[] {
    return this.headElements;
  }

  injectCSS(css: string, id?: string): void {
    const styleId = id || `chaincss-${Date.now()}`;
    this.styles.set(styleId, { element: { id: styleId }, css });
    // Also store in head elements for consistency
    this.headElements.push({ id: styleId, textContent: css });
  }

  removeCSS(id: string): void {
    this.styles.delete(id);
    this.headElements = this.headElements.filter((el: any) => el.id !== id);
  }

  hasStyleElement(id: string): boolean {
    return this.styles.has(id);
  }

  getStyleContent(id: string): string | null {
    return this.styles.get(id)?.css || null;
  }

  /** Get all collected CSS for SSR rendering */
  getSSRStyles(): string {
    return Array.from(this.styles.values())
      .map((entry) => entry.css)
      .join("\n");
  }

  /** Get all head elements for SSR rendering */
  getHeadElements(): any[] {
    return this.headElements;
  }
}
