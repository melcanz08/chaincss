export interface SuggestionMatch {
    name: string;
    distance: number;
    type: 'shorthand' | 'css-property' | 'macro' | 'animation' | 'breakpoint';
}
export declare const KNOWN_SHORTHANDS: string[];
export declare const COMMON_CSS_PROPERTIES: string[];
export declare const ANIMATION_PRESETS: string[];
export declare const BREAKPOINTS: string[];
export declare function getSuggestion(prop: string, validProperties?: string[], type?: 'shorthand' | 'css-property' | 'all'): string | SuggestionMatch | null;
export declare function getSuggestions(prop: string, validProperties?: string[], maxResults?: number): SuggestionMatch[];
export declare function getPropertySuggestion(prop: string, context?: 'spacing' | 'color' | 'typography' | 'layout' | 'animation'): string | null;
export declare function getShorthandSuggestion(shorthand: string): {
    suggestion: string;
    explanation: string;
} | null;
export declare function getValueSuggestion(property: string, value: string): {
    suggested: string;
    confidence: number;
} | null;
export declare function getAutocompleteSuggestions(prefix?: string, limit?: number): SuggestionMatch[];
export declare function formatSuggestion(suggestion: SuggestionMatch): string;
export declare function getDetailedSuggestion(prop: string, validProperties?: string[]): {
    suggestion: string | null;
    alternatives: SuggestionMatch[];
    type: string;
    confidence: number;
} | null;
declare const _default: {
    getSuggestion: typeof getSuggestion;
    getSuggestions: typeof getSuggestions;
    getPropertySuggestion: typeof getPropertySuggestion;
    getShorthandSuggestion: typeof getShorthandSuggestion;
    getValueSuggestion: typeof getValueSuggestion;
    getAutocompleteSuggestions: typeof getAutocompleteSuggestions;
    formatSuggestion: typeof formatSuggestion;
    getDetailedSuggestion: typeof getDetailedSuggestion;
    KNOWN_SHORTHANDS: string[];
    COMMON_CSS_PROPERTIES: string[];
    ANIMATION_PRESETS: string[];
    BREAKPOINTS: string[];
};
export default _default;
