// src/core/value-classifier.ts

import type { CSSProperties, CSSPrimitiveValue } from './types';
import { isDynamicValue } from './types';

export type ValueClass = 'static' | 'dynamic' | 'invalid';

export function partitionStyles(properties: CSSProperties): {
  static: Record<string, CSSPrimitiveValue>;
  dynamic: Record<string, ((...args: any[]) => string)>;
} {
  const staticProps: Record<string, CSSPrimitiveValue> = {};
  const dynamicProps: Record<string, ((...args: any[]) => string)> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (isDynamicValue(value)) {
      dynamicProps[key] = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      staticProps[key] = value;
    }
  }

  return { static: staticProps, dynamic: dynamicProps };
}

export function hasDynamicValues(properties: CSSProperties): boolean {
  return Object.values(properties).some(v => isDynamicValue(v));
}

export function classifyValue(value: unknown): ValueClass {
  if (isDynamicValue(value)) return 'dynamic';
  if (typeof value === 'string') {
    // Theme references, prop references, and template literals are dynamic
    if (value.startsWith('theme.') || value.startsWith('props.') || value.includes('${')) {
      return 'dynamic';
    }
    return 'static';
  }
  if (typeof value === 'number') return 'static';
  return 'invalid';
}