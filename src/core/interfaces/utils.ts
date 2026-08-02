// src/core/interfaces/utils.ts

import type { StyleDefinition } from "@shared/types/index.js";

// Re-export only what we actually need explicitly to avoid collisions
export {
  resolveToken,
  processStyleObject,
} from "@shared/utils/common-utils.js";

// ---- HASHING & NAMING (Isomorphic) ----
const hashCache = new Map<string, string>();
let nodeCrypto: any = null;

function getNodeCrypto() {
  if (nodeCrypto !== null) return nodeCrypto;
  try {
    // dynamic require so browser bundlers can tree-shake it out
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nodeCrypto = require("node:crypto");
  } catch {
    nodeCrypto = false;
  }
  return nodeCrypto;
}

export function hashString(str: string, length: number = 6): string {
  const cacheKey = `${str}::${length}`;
  if (hashCache.size > 5000) hashCache.clear(); // LRU-ish guard for watch mode
  if (hashCache.has(cacheKey)) return hashCache.get(cacheKey)!;

  let hash: string;
  const crypto = getNodeCrypto();
  if (crypto) {
    hash = crypto.createHash("sha1").update(str).digest("hex").slice(0, length);
  } else {
    // FNV-1a browser fallback — fast, no Node dep
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    hash = (h >>> 0).toString(36).slice(0, length).padEnd(length, "0");
  }
  hashCache.set(cacheKey, hash);
  return hash;
}

const kebabCache = new Map<string, string>();
const camelCache = new Map<string, string>();

export function kebabCase(str: string): string {
  if (kebabCache.has(str)) return kebabCache.get(str)!;
  const res = str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
  kebabCache.set(str, res);
  return res;
}

export function camelCase(str: string): string {
  if (camelCache.has(str)) return camelCache.get(str)!;
  const res = str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
  camelCache.set(str, res);
  return res;
}

export function pascalCase(str: string): string {
  const camel = camelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function snakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function cleanName(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function generateClassName(
  styleId: string,
  naming: "hash" | "readable" = "hash",
): string {
  return naming === "hash"
    ? `c_${hashString(styleId)}`
    : `chain-${cleanName(styleId)}`;
}

export function generateAtomicClassName(
  prop: string,
  value: string,
  type: "atomic" | "utility" = "atomic",
): string {
  const hash = hashString(`${prop}:${value}`, 6);
  const prefix = type === "utility" ? "u" : "a";
  return `${prefix}-${kebabCase(prop)}-${hash}`;
}

export function generateComponentClassName(
  componentName: string,
  hash?: string,
): string {
  return `c-${cleanName(componentName)}-${hash || hashString(componentName, 4)}`;
}

// ---- OBJECT ----
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target } as any;
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const src = (source as any)[key];
    const tgt = result[key];
    if (
      src &&
      typeof src === "object" &&
      !Array.isArray(src) &&
      typeof tgt === "object" &&
      !Array.isArray(tgt)
    ) {
      result[key] = deepMerge(tgt || {}, src);
    } else if (src !== undefined) {
      result[key] = src;
    }
  }
  return result;
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(obj);
    } catch {}
  }
  if (Array.isArray(obj)) return obj.map((i) => deepClone(i)) as any;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof RegExp) return new RegExp(obj) as any;
  const cloned: any = {};
  for (const key in obj)
    if (Object.prototype.hasOwnProperty.call(obj, key))
      cloned[key] = deepClone((obj as any)[key]);
  return cloned;
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a),
    kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const res: any = {};
  for (const k of keys) if (k in obj) res[k] = obj[k];
  return res;
}

export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const keySet = new Set(keys as string[]);
  const res: any = {};
  for (const k in obj)
    if (!keySet.has(k) && Object.prototype.hasOwnProperty.call(obj, k))
      res[k] = obj[k];
  return res;
}

// ---- FILE SYSTEM (Node only, sync for CLI + async for compiler) ----
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true }); // no existsSync race
}
export async function ensureDirAsync(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}
export function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}
export async function writeFileAsync(
  filePath: string,
  content: string,
): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, "utf8");
}
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}
export const fileExists = (p: string) => fs.existsSync(p);
export const getFileExtension = (p: string) => path.extname(p);
export const getBaseName = (p: string) => path.basename(p, path.extname(p));
export const getDirName = (p: string) => path.dirname(p);
export const resolvePath = (p: string) => path.resolve(process.cwd(), p);
export function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
export function getAllFiles(dir: string, pattern?: RegExp): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (!e.isSymbolicLink()) stack.push(full);
      } else if (!pattern || pattern.test(full)) out.push(full);
    }
  }
  return out;
}

// ---- FORMATTING ----
export function formatCSS(css: string, minify = false): string {
  if (!css?.trim()) return "";
  if (minify) {
    return css
      .replace(/\/\*.*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{};:])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  }
  // Fast path: avoid multiple large replaces
  return css
    .replace(/\s*{\s*/g, " {\n  ")
    .replace(/;\s*/g, ";\n  ")
    .replace(/\s*}\s*/g, "\n}\n")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
export function formatJS(code: string, minify = false): string {
  return minify
    ? code
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*.*?\*\//g, "")
        .replace(/\s+/g, " ")
        .trim()
    : code;
}

// ---- STRING / ARRAY / PERF ----
export function truncate(str: string, len: number, suffix = "..."): string {
  return str.length <= len ? str : str.slice(0, len - suffix.length) + suffix;
}
export function indent(str: string, level = 1, char = "  "): string {
  const pad = char.repeat(level);
  return str
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}
export function stripIndent(str: string): string {
  const lines = str.split("\n");
  const min = Math.min(
    ...lines
      .filter((l) => l.trim())
      .map((l) => l.match(/^\s*/)?.[0].length || 0),
  );
  return lines
    .map((l) => l.slice(min))
    .join("\n")
    .trim();
}
export function unique<T>(arr: T[], key?: keyof T): T[] {
  if (!key) return [...new Set(arr)];
  const seen = new Set();
  return arr.filter((item) => {
    const v = (item as any)[key];
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}
export function chunk<T>(arr: T[], size: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
  return r;
}
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const r: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    (r[k] ||= []).push(item);
  }
  return r;
}
export function debounce<T extends (...a: any[]) => any>(fn: T, delay: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...a: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), delay);
  };
}
export function throttle<T extends (...a: any[]) => any>(fn: T, limit: number) {
  let inThrottle = false;
  return (...a: Parameters<T>) => {
    if (!inThrottle) {
      fn(...a);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ---- ERRORS / LOG ----
export class ChainCSSError extends Error {
  constructor(
    message: string,
    public code = "CHAINCSS_ERROR",
    public details?: any,
  ) {
    super(message);
    this.name = "ChainCSSError";
  }
}
export function tryOrWarn<T>(fn: () => T, def: T, msg?: string): T {
  try {
    return fn();
  } catch (e) {
    if (msg) console.warn(msg, e);
    return def;
  }
}
export function tryOrThrow<T>(fn: () => T, errMsg?: string): T {
  try {
    return fn();
  } catch (e) {
    throw new ChainCSSError(
      errMsg || (e as Error).message,
      "EXECUTION_ERROR",
      e,
    );
  }
}
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 } as const;
let currentLogLevel = (
  process.env.DEBUG ? "debug" : "info"
) as keyof typeof LEVELS;
export const setLogLevel = (l: keyof typeof LEVELS) => {
  currentLogLevel = l;
};
const shouldLog = (l: keyof typeof LEVELS) =>
  LEVELS[l] >= LEVELS[currentLogLevel];
export const logDebug = (m: string, ...a: any[]) => {
  if (shouldLog("debug")) console.debug(`[ChainCSS Debug] ${m}`, ...a);
};
export const logInfo = (m: string, ...a: any[]) => {
  if (shouldLog("info")) console.log(`[ChainCSS] ${m}`, ...a);
};
export const logWarn = (m: string, ...a: any[]) => {
  if (shouldLog("warn")) console.warn(`[ChainCSS Warning] ${m}`, ...a);
};
export const logError = (m: string, ...a: any[]) => {
  if (shouldLog("error")) console.error(`[ChainCSS Error] ${m}`, ...a);
};

export function getMemoryUsage() {
  try {
    const u = process.memoryUsage();
    return {
      rss: u.rss,
      heapTotal: u.heapTotal,
      heapUsed: u.heapUsed,
      external: u.external,
    };
  } catch {
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 };
  }
}
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024,
    sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ---- VALIDATION ----
export function isValidSelector(s: string): boolean {
  if (!s || typeof s !== "string" || s.length > 100) return false;
  return !/[<>`]/.test(s);
}
export function isValidClassName(c: string): boolean {
  return !!c && c.length <= 50 && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(c);
}
export function isValidCSSProperty(p: string): boolean {
  return !!p && /^(?:--[a-zA-Z0-9_-]+|[a-z][a-z-]*)$/.test(p);
}
