export interface FindOptions {
    ignore?: string[];
    absolute?: boolean;
}
export declare function findInputFiles(patterns: string[], options?: FindOptions): string[];
export declare function ensureDirectory(dir: string): void;
export declare function getRelativePath(filePath: string, baseDir: string): string;
export declare function getOutputPath(inputFile: string, outputDir: string, extension?: string): string;
export declare function fileExists(filePath: string): boolean;
export declare function readFile(filePath: string): string;
export declare function writeFile(filePath: string, content: string): void;
export declare function deleteFile(filePath: string): void;
export declare function copyFile(source: string, destination: string): void;
export declare function getFileSize(filePath: string): number;
export declare function getFileHash(filePath: string): string;
export declare function isDirectory(dirPath: string): boolean;
export declare function ensureCleanDir(dir: string): void;
declare const _default: {
    findInputFiles: typeof findInputFiles;
    ensureDirectory: typeof ensureDirectory;
    getRelativePath: typeof getRelativePath;
    getOutputPath: typeof getOutputPath;
    fileExists: typeof fileExists;
    readFile: typeof readFile;
    writeFile: typeof writeFile;
    deleteFile: typeof deleteFile;
    copyFile: typeof copyFile;
    getFileSize: typeof getFileSize;
    getFileHash: typeof getFileHash;
    isDirectory: typeof isDirectory;
    ensureCleanDir: typeof ensureCleanDir;
};
export default _default;
