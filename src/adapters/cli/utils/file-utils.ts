// ============================================================================
// FILE: src/adapters/cli/utils/file-utils.ts
// ============================================================================

import fs from "fs";
import path from "path";
import * as globModule from "glob";
import { createHash } from "crypto";

export interface FindOptions {
  ignore?: string[];
  absolute?: boolean;
}

/**
 * Enforces cross-platform POSIX path styling to prevent cache-key splits on Windows.
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Robust glob wrapper supporting both modern globSync exports and legacy fallback patterns.
 */
function runGlobSync(pattern: string, options: any): string[] {
  if (typeof globModule.globSync === "function") {
    return globModule.globSync(pattern, options);
  }
  return (globModule.glob as any).sync(pattern, options);
}

export function findInputFiles(
  patterns: string[],
  options: FindOptions = {},
): string[] {
  const files: string[] = [];
  const ignorePatterns = options.ignore || [
    "**/node_modules/**",
    "**/dist/**",
    "**/.chaincss-cache/**",
  ];

  for (const pattern of patterns) {
    try {
      const matches = runGlobSync(pattern, {
        ignore: ignorePatterns,
        absolute: options.absolute || false,
      });
      files.push(...matches.map(normalizePath));
    } catch (error) {
      console.warn(
        `[file-utils] Failed to glob pattern "${pattern}":`,
        (error as Error).message,
      );
    }
  }

  return [...new Set(files)];
}

export function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create directory "${dir}": ${(error as Error).message}`,
      );
    }
  }
}

export function getRelativePath(filePath: string, baseDir: string): string {
  return normalizePath(path.relative(baseDir, filePath));
}

/**
 * Resolves compilation targets safely. Passing `baseDir` preserves nested folder trees.
 * Prevents Directory Traversal exploits if input files sit outside baseDir boundaries.
 */
export function getOutputPath(
  inputFile: string,
  outputDir: string,
  extension: string = "",
  baseDir?: string,
): string {
  const outExt = extension || path.extname(inputFile);
  const baseName = path.basename(inputFile, path.extname(inputFile));

  if (baseDir) {
    // Determine the absolute boundaries of baseDir
    const absoluteBase = path.resolve(baseDir);
    const absoluteInput = path.resolve(inputFile);
    const relativePart = path.relative(absoluteBase, absoluteInput);

    // Safety check: Is the input file sitting outside the base boundary?
    // If relativePart starts with '..' or is absolute, it escaped the root.
    const isEscaped =
      relativePart.startsWith("..") || path.isAbsolute(relativePart);

    // If it escaped, flatten the folder structure inside the output folder
    // to protect against writing outside the target outputDir.
    const relativeDir = isEscaped ? "" : path.dirname(relativePart);

    return normalizePath(
      path.join(outputDir, relativeDir, `${baseName}${outExt}`),
    );
  }

  return normalizePath(path.join(outputDir, `${baseName}${outExt}`));
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
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read file "${filePath}": ${(error as Error).message}`,
    );
  }
}

export function writeFile(filePath: string, content: string): void {
  try {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to write file "${filePath}": ${(error as Error).message}`,
    );
  }
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(
      `[file-utils] Failed to delete file "${filePath}":`,
      (error as Error).message,
    );
  }
}

export function copyFile(source: string, destination: string): void {
  try {
    ensureDirectory(path.dirname(destination));
    fs.copyFileSync(source, destination);
  } catch (error) {
    throw new Error(
      `Failed to copy file from "${source}" to "${destination}": ${(error as Error).message}`,
    );
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

/**
 * Reads raw byte streams as binary buffers.
 * Skips CPU-intensive string-decoding to accelerate build cycles.
 */
export function getFileHash(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath);
    return createHash("md5").update(buffer).digest("hex").slice(0, 8);
  } catch (error) {
    throw new Error(
      `Failed to calculate hash for file "${filePath}": ${(error as Error).message}`,
    );
  }
}

/**
 * Async stream-based hashing. Ideal for large assets/files
 * to keep the event loop unblocked during live dev reloads.
 */
export function getFileHashAsync(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("md5");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex").slice(0, 8)));
    stream.on("error", (err) =>
      reject(
        new Error(`Failed to stream hash for "${filePath}": ${err.message}`),
      ),
    );
  });
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
  normalizePath,
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
  getFileHashAsync,
  isDirectory,
  ensureCleanDir,
};
