// src/compiler/animations.ts
export interface AnimationConfig {
  duration?: string;
  delay?: string;
  timing?: string;
  iteration?: string | number;
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  playState?: 'running' | 'paused';
  name?: string; // Custom animation name
}

export interface KeyframeDefinition {
  [key: string]: Record<string, string | number>;
}

// Pre-defined animation keyframes
export const animationPresets: Record<string, KeyframeDefinition> = {
  // Fades
  fadeIn: {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 }
  },
  fadeOut: {
    '0%': { opacity: 1 },
    '100%': { opacity: 0 }
  },
  fadeInUp: {
    '0%': { opacity: 0, transform: 'translateY(20px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  fadeInDown: {
    '0%': { opacity: 0, transform: 'translateY(-20px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  fadeInLeft: {
    '0%': { opacity: 0, transform: 'translateX(-20px)' },
    '100%': { opacity: 1, transform: 'translateX(0)' }
  },
  fadeInRight: {
    '0%': { opacity: 0, transform: 'translateX(20px)' },
    '100%': { opacity: 1, transform: 'translateX(0)' }
  },
  fadeOutUp: {
    '0%': { opacity: 1, transform: 'translateY(0)' },
    '100%': { opacity: 0, transform: 'translateY(-20px)' }
  },
  fadeOutDown: {
    '0%': { opacity: 1, transform: 'translateY(0)' },
    '100%': { opacity: 0, transform: 'translateY(20px)' }
  },
  
  // Slides
  slideInUp: {
    '0%': { transform: 'translateY(100%)' },
    '100%': { transform: 'translateY(0)' }
  },
  slideInDown: {
    '0%': { transform: 'translateY(-100%)' },
    '100%': { transform: 'translateY(0)' }
  },
  slideInLeft: {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(0)' }
  },
  slideInRight: {
    '0%': { transform: 'translateX(100%)' },
    '100%': { transform: 'translateX(0)' }
  },
  slideOutUp: {
    '0%': { transform: 'translateY(0)' },
    '100%': { transform: 'translateY(-100%)' }
  },
  slideOutDown: {
    '0%': { transform: 'translateY(0)' },
    '100%': { transform: 'translateY(100%)' }
  },
  
  // Zooms
  zoomIn: {
    '0%': { opacity: 0, transform: 'scale(0.8)' },
    '100%': { opacity: 1, transform: 'scale(1)' }
  },
  zoomOut: {
    '0%': { opacity: 1, transform: 'scale(1)' },
    '100%': { opacity: 0, transform: 'scale(0.8)' }
  },
  zoomInUp: {
    '0%': { opacity: 0, transform: 'scale(0.8) translateY(20px)' },
    '100%': { opacity: 1, transform: 'scale(1) translateY(0)' }
  },
  zoomInDown: {
    '0%': { opacity: 0, transform: 'scale(0.8) translateY(-20px)' },
    '100%': { opacity: 1, transform: 'scale(1) translateY(0)' }
  },
  
  // Bounces
  bounce: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-20px)' }
  },
  bounceIn: {
    '0%': { opacity: 0, transform: 'scale(0.8)' },
    '50%': { transform: 'scale(1.05)' },
    '100%': { opacity: 1, transform: 'scale(1)' }
  },
  bounceOut: {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(0.95)' },
    '100%': { opacity: 0, transform: 'scale(0.8)' }
  },
  
  // Pulses
  pulse: {
    '0%, 100%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.05)' }
  },
  pulseGlow: {
    '0%, 100%': { opacity: 1, filter: 'brightness(1)' },
    '50%': { opacity: 0.8, filter: 'brightness(1.2)' }
  },
  
  // Shakes
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '25%': { transform: 'translateX(-5px)' },
    '75%': { transform: 'translateX(5px)' }
  },
  shakeX: {
    '0%, 100%': { transform: 'translateX(0)' },
    '25%, 75%': { transform: 'translateX(-10px)' },
    '50%': { transform: 'translateX(10px)' }
  },
  shakeY: {
    '0%, 100%': { transform: 'translateY(0)' },
    '25%, 75%': { transform: 'translateY(-10px)' },
    '50%': { transform: 'translateY(10px)' }
  },
  
  // Rotations
  spin: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' }
  },
  spinReverse: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(-360deg)' }
  },
  wiggle: {
    '0%, 100%': { transform: 'rotate(-3deg)' },
    '50%': { transform: 'rotate(3deg)' }
  },
  wobble: {
    '0%': { transform: 'translateX(0%)' },
    '15%': { transform: 'translateX(-25%) rotate(-5deg)' },
    '30%': { transform: 'translateX(20%) rotate(3deg)' },
    '45%': { transform: 'translateX(-15%) rotate(-3deg)' },
    '60%': { transform: 'translateX(10%) rotate(2deg)' },
    '75%': { transform: 'translateX(-5%) rotate(-1deg)' },
    '100%': { transform: 'translateX(0%)' }
  },
  
  // Flips
  flip: {
    '0%': { transform: 'perspective(400px) rotateY(0)' },
    '100%': { transform: 'perspective(400px) rotateY(180deg)' }
  },
  flipX: {
    '0%': { transform: 'perspective(400px) rotateX(0)' },
    '100%': { transform: 'perspective(400px) rotateX(180deg)' }
  },
  
  // Special effects
  blink: {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0 }
  },
  typing: {
    '0%': { width: '0' },
    '100%': { width: '100%' }
  },
  cursor: {
    '0%, 100%': { borderColor: 'transparent' },
    '50%': { borderColor: 'currentColor' }
  },
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' }
  },
  ripple: {
    '0%': { transform: 'scale(0)', opacity: 0.5 },
    '100%': { transform: 'scale(4)', opacity: 0 }
  },
  float: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-10px)' }
  },
  sink: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(10px)' }
  },
  swing: {
    '0%, 100%': { transform: 'rotate(0deg)' },
    '25%': { transform: 'rotate(15deg)' },
    '75%': { transform: 'rotate(-15deg)' }
  },
  flash: {
    '0%, 100%': { opacity: 1 },
    '25%, 75%': { opacity: 0.5 },
    '50%': { opacity: 0 }
  },
  
  // Text animations
  textReveal: {
    '0%': { clipPath: 'inset(0 100% 0 0)' },
    '100%': { clipPath: 'inset(0 0 0 0)' }
  },
  textGlitch: {
    '0%, 100%': { transform: 'translate(0, 0)' },
    '20%': { transform: 'translate(-2px, 1px)' },
    '40%': { transform: 'translate(2px, -1px)' },
    '60%': { transform: 'translate(-1px, 2px)' },
    '80%': { transform: 'translate(1px, -2px)' }
  }
};

// Default animation timing values
export const DEFAULT_ANIMATION_CONFIG: Required<AnimationConfig> = {
  name: '',  // Add this missing property
  duration: '0.3s',
  delay: '0s',
  timing: 'ease',
  iteration: 1,
  direction: 'normal',
  fillMode: 'both',
  playState: 'running'
};

// Predefined timing functions
export const timingFunctions = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
};

// Helper to create animation style
export function createAnimation(
  animationName: string, 
  config: AnimationConfig = {}
): Record<string, any> {
  const {
    duration = DEFAULT_ANIMATION_CONFIG.duration,
    delay = DEFAULT_ANIMATION_CONFIG.delay,
    timing = DEFAULT_ANIMATION_CONFIG.timing,
    iteration = DEFAULT_ANIMATION_CONFIG.iteration,
    direction = DEFAULT_ANIMATION_CONFIG.direction,
    fillMode = DEFAULT_ANIMATION_CONFIG.fillMode,
    playState = DEFAULT_ANIMATION_CONFIG.playState
  } = config;
  
  // Build animation shorthand
  const animationValue = `${animationName} ${duration} ${timing} ${delay} ${iteration} ${direction} ${playState}`;
  
  return {
    animation: animationValue.trim(),
    animationFillMode: fillMode,
    animationName: animationName,
    animationDuration: duration,
    animationDelay: delay,
    animationTimingFunction: timing,
    animationIterationCount: iteration,
    animationDirection: direction,
    animationPlayState: playState
  };
}

// Create keyframes CSS string
export function createKeyframesCSS(
  name: string,
  steps: KeyframeDefinition,
  prefix: boolean = true
): string {
  let css = `@keyframes ${name} {\n`;
  
  for (const [keyframe, styles] of Object.entries(steps)) {
    css += `  ${keyframe} {\n`;
    
    for (const [prop, value] of Object.entries(styles)) {
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      css += `    ${kebabProp}: ${value};\n`;
    }
    
    css += `  }\n`;
  }
  
  css += `}\n`;
  
  // Add vendor-prefixed version if needed
  if (prefix) {
    css += `@-webkit-keyframes ${name} {\n`;
    for (const [keyframe, styles] of Object.entries(steps)) {
      css += `  ${keyframe} {\n`;
      for (const [prop, value] of Object.entries(styles)) {
        const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `    ${kebabProp}: ${value};\n`;
      }
      css += `  }\n`;
    }
    css += `}\n`;
  }
  
  return css;
}

// Get animation preset
export function getAnimationPreset(name: string): KeyframeDefinition | undefined {
  return animationPresets[name];
}

// Check if animation preset exists
export function hasAnimationPreset(name: string): boolean {
  return name in animationPresets;
}

// Get all animation preset names
export function getAnimationPresetNames(): string[] {
  return Object.keys(animationPresets);
}

// Register a custom animation preset
export function registerAnimationPreset(
  name: string,
  steps: KeyframeDefinition,
  overwrite: boolean = false
): boolean {
  if (animationPresets[name] && !overwrite) {
    return false;
  }
  
  animationPresets[name] = steps;
  return true;
}

// Register multiple animation presets
export function registerAnimationPresets(
  presets: Record<string, KeyframeDefinition>,
  overwrite: boolean = false
): void {
  for (const [name, steps] of Object.entries(presets)) {
    registerAnimationPreset(name, steps, overwrite);
  }
}

// Create a combined animation from multiple presets
export function combineAnimations(
  animations: Array<{ name: string; duration?: string; delay?: string }>
): Record<string, any> {
  const combined: Record<string, any> = {};
  const animationList: string[] = [];
  
  for (const anim of animations) {
    const duration = anim.duration || '0.3s';
    const delay = anim.delay || '0s';
    animationList.push(`${anim.name} ${duration} ${delay}`);
  }
  
  combined.animation = animationList.join(', ');
  return combined;
}

// Generate staggered animation delays for children
export function staggerChildren(
  baseDelay: string = '0s',
  increment: string = '0.1s',
  count: number = 5
): Record<number, string> {
  const delays: Record<number, string> = {};
  const baseMs = parseTimeToMs(baseDelay);
  const incMs = parseTimeToMs(increment);
  
  for (let i = 0; i < count; i++) {
    delays[i] = `${baseMs + (i * incMs)}ms`;
  }
  
  return delays;
}

// Helper to parse time string to milliseconds
function parseTimeToMs(time: string): number {
  if (time.endsWith('ms')) {
    return parseFloat(time);
  }
  if (time.endsWith('s')) {
    return parseFloat(time) * 1000;
  }
  return parseFloat(time);
}

// Convert milliseconds to time string
export function msToTime(ms: number): string {
  if (ms >= 1000) {
    return `${ms / 1000}s`;
  }
  return `${ms}ms`;
}

// Create animation sequence
export interface AnimationStep {
  name: string;
  duration?: string;
  delay?: string;
}

export function createAnimationSequence(steps: AnimationStep[]): Record<string, any> {
  if (steps.length === 0) return {};
  
  const animations: string[] = [];
  
  for (const step of steps) {
    const duration = step.duration || '0.3s';
    const delay = step.delay || '0s';
    animations.push(`${step.name} ${duration} ${delay}`);
  }
  
  return {
    animation: animations.join(', ')
  };
}

// Check if animation is a preset
export function isValidAnimation(name: string): boolean {
  return hasAnimationPreset(name);
}

// Get animation suggestion for similar names
export function getAnimationSuggestion(name: string): string | null {
  const presetNames = getAnimationPresetNames();
  const lowerName = name.toLowerCase();
  
  // Find exact match
  if (presetNames.includes(name)) return name;
  
  // Find partial matches
  const matches = presetNames.filter(n => 
    n.toLowerCase().includes(lowerName) || 
    lowerName.includes(n.toLowerCase())
  );
  
  if (matches.length > 0) {
    return matches[0];
  }
  
  // Find similar by Levenshtein distance
  let bestMatch: string | null = null;
  let bestDistance = Infinity;
  
  for (const preset of presetNames) {
    const distance = levenshteinDistance(name, preset);
    if (distance < bestDistance && distance < 3) {
      bestDistance = distance;
      bestMatch = preset;
    }
  }
  
  return bestMatch;
}

// Levenshtein distance for suggestions
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return matrix[a.length][b.length];
}

// Export default animation utilities
export default {
  animationPresets,
  createAnimation,
  createKeyframesCSS,
  getAnimationPreset,
  hasAnimationPreset,
  getAnimationPresetNames,
  registerAnimationPreset,
  registerAnimationPresets,
  combineAnimations,
  staggerChildren,
  createAnimationSequence,
  isValidAnimation,
  getAnimationSuggestion,
  timingFunctions,
  DEFAULT_ANIMATION_CONFIG
};