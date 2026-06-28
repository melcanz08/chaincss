// src/core/rule-builder.ts

/**
 * RuleBuilder — Handles context switching (hover), nesting, at-rules,
 * and conditional style application.
 * 
 * Extracted from StyleCollector to separate "where styles go" from
 * "what styles are".
 */

import type { StyleObject, AtRule, NestedRule } from './style-collector.js';

export interface RuleContext {
  styles: Record<string, any>;
  atRules: AtRule[];
  nestedRules: NestedRule[];
}

export class RuleBuilder {
  private atRules: AtRule[] = [];
  private nestedRules: NestedRule[] = [];

  /** Build a child context by executing a callback and collecting its output. */
  buildChild(
    fn: (childProxy: any) => void,
    createChildProxy: (debug: boolean) => any,
    debug: boolean = false
  ): StyleObject {
    const childProxy = createChildProxy(debug);
    fn(childProxy);
    return (childProxy as any).build
      ? (childProxy as any).build()
      : childProxy.$el();
  }

  /** Add a media query at-rule. */
  addMedia(query: string, childResult: StyleObject): void {
    this.atRules.push({ type: 'media', query, styles: childResult });
  }

  /** Add a supports at-rule. */
  addSupports(condition: string, childResult: StyleObject): void {
    this.atRules.push({ type: 'supports', condition, styles: childResult });
  }

  /** Add a container at-rule. */
  addContainer(condition: string, childResult: StyleObject): void {
    this.atRules.push({ type: 'container', condition, styles: childResult });
  }

  /** Add a layer at-rule. */
  addLayer(name: string, childResult: StyleObject): void {
    this.atRules.push({ type: 'layer', name, styles: childResult });
  }

  /** Add a nested rule. */
  addNested(selector: string, childResult: StyleObject): void {
    this.nestedRules.push({ selector, styles: childResult });
  }

  /** Add keyframes. */
  addKeyframes(name: string, steps: Record<string, any>): void {
    this.atRules.push({ type: 'keyframes', name, steps });
  }

  /** Add font-face. */
  addFontFace(properties: Record<string, string>): void {
    this.atRules.push({ type: 'font-face', properties });
  }

  /** Get all collected at-rules. */
  getAtRules(): AtRule[] {
    return [...this.atRules];
  }

  /** Get all collected nested rules. */
  getNestedRules(): NestedRule[] {
    return [...this.nestedRules];
  }

  /** Check if there are any rules. */
  hasRules(): boolean {
    return this.atRules.length > 0 || this.nestedRules.length > 0;
  }

  /** Clear all rules. */
  reset(): void {
    this.atRules = [];
    this.nestedRules = [];
  }
}
