// src/frameworks/core/adapter/types.ts
// Runtime adapter types

export interface RuntimeAdapter {
  /** Check if running in browser environment */
  isBrowser: boolean;

  /** Get a DOM element by ID */
  getElement(id: string): any | null;

  /** Get the document head element */
  getHead(): any | null;

  /** Create a style element */
  createStyleElement(className: string): any;

  /** Append a style element to the DOM */
  appendStyleElement(element: any): void;

  /** Remove a style element from the DOM */
  removeStyleElement(id: string): void;

  /** Get all style elements */
  getStyleElements(): any[];

  /** Create a style tag with CSS content */
  injectCSS(css: string, id?: string): void;

  /** Remove CSS by ID */
  removeCSS(id: string): void;

  /** Check if a style element exists */
  hasStyleElement(id: string): boolean;

  /** Get the current CSS string for a specific style element */
  getStyleContent(id: string): string | null;
}

export interface StyleElement {
  id: string;
  element: any;
  css: string;
}
