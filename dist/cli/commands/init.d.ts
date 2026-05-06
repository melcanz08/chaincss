export interface InitOptions {
    force?: boolean;
    verbose?: boolean;
    template?: 'full' | 'minimal';
    typescript?: boolean;
    framework?: 'react' | 'vue' | 'svelte' | 'solid';
}
export declare function initCommand(options: InitOptions): Promise<void>;
