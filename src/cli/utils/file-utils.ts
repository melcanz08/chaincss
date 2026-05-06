// src/cli/utils/file-utils.ts

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface FindOptions {
  ignore?: string[];
  absolute?: boolean;
}

export function findInputFiles(patterns: string[], options: FindOptions = {}): string[] {
  const files: string[] = [];
  const ignorePatterns = options.ignore || ['**/node_modules/**', '**/dist/**', '**/.chaincss-cache/**'];
  
  for (const pattern of patterns) {
    try {
      const matches = glob.sync(pattern, {
        ignore: ignorePatterns,
        absolute: options.absolute || false
      });
      files.push(...matches);
    } catch (error) {
      console.warn(`[file-utils] Failed to glob pattern "${pattern}":`, (error as Error).message);
    }
  }
  
  return [...new Set(files)]; // Remove duplicates
}

export function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory "${dir}": ${(error as Error).message}`);
    }
  }
}

export function getRelativePath(filePath: string, baseDir: string): string {
  return path.relative(baseDir, filePath);
}

export function getOutputPath(inputFile: string, outputDir: string, extension: string = ''): string {
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const outExt = extension || path.extname(inputFile);
  return path.join(outputDir, `${baseName}${outExt}`);
}

export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read file "${filePath}": ${(error as Error).message}`);
  }
}

export function writeFile(filePath: string, content: string): void {
  try {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write file "${filePath}": ${(error as Error).message}`);
  }
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`[file-utils] Failed to delete file "${filePath}":`, (error as Error).message);
  }
}

export function copyFile(source: string, destination: string): void {
  try {
    ensureDirectory(path.dirname(destination));
    fs.copyFileSync(source, destination);
  } catch (error) {
    throw new Error(`Failed to copy file from "${source}" to "${destination}": ${(error as Error).message}`);
  }
}

export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

export function getFileHash(filePath: string): string {
  const crypto = require('crypto');
  const content = readFile(filePath);
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

export function isDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function ensureCleanDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  ensureDirectory(dir);
}

export default {
  findInputFiles,
  ensureDirectory,
  getRelativePath,
  getOutputPath,
  fileExists,
  readFile,
  writeFile,
  deleteFile,
  copyFile,
  getFileSize,
  getFileHash,
  isDirectory,
  ensureCleanDir
};