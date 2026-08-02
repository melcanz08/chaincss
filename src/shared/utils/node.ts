// src/shared/utils/node.ts

// Node.js utilities (only safe for Node.js environment)
import fs from 'fs';
import path from 'path';

export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

export async function writeFileAsync(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return fs.promises.writeFile(filePath, content, 'utf8');
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export const fileExists = (p: string): boolean => fs.existsSync(p);

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function ensureDirAsync(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

export const getFileExtension = (p: string): string => path.extname(p);
export const getBaseName = (p: string): string => path.basename(p, path.extname(p));
export const getDirName = (p: string): string => path.dirname(p);
export const resolvePath = (p: string): string => path.resolve(process.cwd(), p);

export function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function getAllFiles(dir: string, pattern?: RegExp): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, pattern));
    } else if (!pattern || pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

export function getMemoryUsage(): number {
  return process.memoryUsage().heapUsed;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}
