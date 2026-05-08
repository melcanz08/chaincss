interface ComponentInfo {
    name: string;
    selector: string;
    styles: Record<string, any>;
    propsDefinition?: Record<string, any>;
    framework: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';
}
export declare function detectFramework(): 'react' | 'vue' | 'svelte' | 'solid';
export declare function generateComponentCode(info: ComponentInfo): string;
export type { ComponentInfo };
