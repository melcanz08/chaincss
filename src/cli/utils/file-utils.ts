// chaincss/src/cli/utils/file-utils.ts

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export function findInputFiles(patterns: string[]): string[] {
  const files: string[] = [];
  
  for (const pattern of patterns) {
    const matches = glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/.chaincss-cache/**']
    });
    files.push(...matches);
  }
  
  return [...new Set(files)]; // Remove duplicates
}

export function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getRelativePath(filePath: string, baseDir: string): string {
  return path.relative(baseDir, filePath);
}

export function getOutputPath(inputFile: string, outputDir: string): string {
  const baseName = path.basename(inputFile, path.extname(inputFile));
  return path.join(outputDir, baseName);
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function writeFile(filePath: string, content: string): void {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}