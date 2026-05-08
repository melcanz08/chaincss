export declare const scanContent: (text: string) => string[];
export declare function scanFileForStyles(filePath: string, optimizer: any, source?: string | null): {
    foundCount: number;
    errors: Error[];
};
