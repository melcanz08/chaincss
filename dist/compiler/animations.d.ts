export interface AnimationConfig {
    duration?: string;
    delay?: string;
    timing?: string;
    iteration?: string | number;
    direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
    fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
    playState?: 'running' | 'paused';
    name?: string;
}
export interface KeyframeDefinition {
    [key: string]: Record<string, string | number>;
}
export declare const animationPresets: Record<string, KeyframeDefinition>;
export declare const DEFAULT_ANIMATION_CONFIG: Required<AnimationConfig>;
export declare const timingFunctions: {
    linear: string;
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    bounce: string;
    elastic: string;
    smooth: string;
    sharp: string;
};
export declare function createAnimation(animationName: string, config?: AnimationConfig): Record<string, any>;
export declare function createKeyframesCSS(name: string, steps: KeyframeDefinition, prefix?: boolean): string;
export declare function getAnimationPreset(name: string): KeyframeDefinition | undefined;
export declare function hasAnimationPreset(name: string): boolean;
export declare function getAnimationPresetNames(): string[];
export declare function registerAnimationPreset(name: string, steps: KeyframeDefinition, overwrite?: boolean): boolean;
export declare function registerAnimationPresets(presets: Record<string, KeyframeDefinition>, overwrite?: boolean): void;
export declare function combineAnimations(animations: Array<{
    name: string;
    duration?: string;
    delay?: string;
}>): Record<string, any>;
export declare function staggerChildren(baseDelay?: string, increment?: string, count?: number): Record<number, string>;
export declare function msToTime(ms: number): string;
export interface AnimationStep {
    name: string;
    duration?: string;
    delay?: string;
}
export declare function createAnimationSequence(steps: AnimationStep[]): Record<string, any>;
export declare function isValidAnimation(name: string): boolean;
export declare function getAnimationSuggestion(name: string): string | null;
declare const _default: {
    animationPresets: Record<string, KeyframeDefinition>;
    createAnimation: typeof createAnimation;
    createKeyframesCSS: typeof createKeyframesCSS;
    getAnimationPreset: typeof getAnimationPreset;
    hasAnimationPreset: typeof hasAnimationPreset;
    getAnimationPresetNames: typeof getAnimationPresetNames;
    registerAnimationPreset: typeof registerAnimationPreset;
    registerAnimationPresets: typeof registerAnimationPresets;
    combineAnimations: typeof combineAnimations;
    staggerChildren: typeof staggerChildren;
    createAnimationSequence: typeof createAnimationSequence;
    isValidAnimation: typeof isValidAnimation;
    getAnimationSuggestion: typeof getAnimationSuggestion;
    timingFunctions: {
        linear: string;
        ease: string;
        easeIn: string;
        easeOut: string;
        easeInOut: string;
        bounce: string;
        elastic: string;
        smooth: string;
        sharp: string;
    };
    DEFAULT_ANIMATION_CONFIG: Required<AnimationConfig>;
};
export default _default;
