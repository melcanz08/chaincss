import type { BuildOptions } from '../types.js';
export interface WatchOptions extends BuildOptions {
    debounce?: number;
}
export declare function watchCommand(options: WatchOptions): Promise<void>;
//# sourceMappingURL=watch.d.ts.map