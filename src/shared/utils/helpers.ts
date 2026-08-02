// src/shared/utils/helpers.ts

import crypto from "crypto";
import path from "path";

export const isObject = (val: any): val is Record<string, any> => {
  return val !== null && typeof val === "object" && !Array.isArray(val);
};

export const isString = (val: any): val is string => {
  return typeof val === "string";
};

export const isNumber = (val: any): val is number => {
  return typeof val === "number" && !isNaN(val);
};

export const generateHash = (input: string): string => {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
};

export const normalizePath = (filepath: string): string => {
  return path.normalize(filepath).replace(/\\/g, "/");
};

export const ensureArray = <T>(input: T | T[]): T[] => {
  return Array.isArray(input) ? input : [input];
};

export const deduplicate = <T>(array: T[], key?: keyof T): T[] => {
  if (!key) {
    return [...new Set(array)];
  }

  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string,
): T => {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};
