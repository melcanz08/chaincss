export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';
export declare class Logger {
    private verbose;
    constructor(verbose?: boolean);
    info(message: string, ...args: any[]): void;
    success(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    step(message: string, ...args: any[]): void;
    header(message: string): void;
    divider(): void;
    table(data: Record<string, any>): void;
    progress(current: number, total: number, message: string): void;
}
export declare function createLogger(verbose?: boolean): Logger;
//# sourceMappingURL=logger.d.ts.map