// ============================================================================
// FILE: src/compiler/animations.ts
// ChainCSS Build-Time Animation Utilities & Token Presets
// ============================================================================

export interface AnimationConfig {
  name?: string;
  duration?: string;
  delay?: string;
  timing?: string;
  iteration?: string | number;
  direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
  fillMode?: "none" | "forwards" | "backwards" | "both";
  playState?: "running" | "paused";
}

export interface KeyframeDefinition {
  [key: string]: Record<string, string | number>;
}

export interface CombinedAnimationItem {
  name: string;
  duration?: string;
  delay?: string;
  timing?: string;
}

export interface AnimationStep {
  name: string;
  duration?: string;
  delay?: string;
  timing?: string;
}

// ============================================================================
// Token Presets
// ============================================================================

export const animationPresets: Record<string, KeyframeDefinition> = {
  fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
  fadeOut: { "0%": { opacity: 1 }, "100%": { opacity: 0 } },
  fadeInUp: {
    "0%": { opacity: 0, transform: "translateY(20px)" },
    "100%": { opacity: 1, transform: "translateY(0)" },
  },
  fadeInDown: {
    "0%": { opacity: 0, transform: "translateY(-20px)" },
    "100%": { opacity: 1, transform: "translateY(0)" },
  },
  fadeInLeft: {
    "0%": { opacity: 0, transform: "translateX(-20px)" },
    "100%": { opacity: 1, transform: "translateX(0)" },
  },
  fadeInRight: {
    "0%": { opacity: 0, transform: "translateX(20px)" },
    "100%": { opacity: 1, transform: "translateX(0)" },
  },
  fadeOutUp: {
    "0%": { opacity: 1, transform: "translateY(0)" },
    "100%": { opacity: 0, transform: "translateY(-20px)" },
  },
  fadeOutDown: {
    "0%": { opacity: 1, transform: "translateY(0)" },
    "100%": { opacity: 0, transform: "translateY(20px)" },
  },
  slideInUp: {
    "0%": { transform: "translateY(100%)" },
    "100%": { transform: "translateY(0)" },
  },
  slideInDown: {
    "0%": { transform: "translateY(-100%)" },
    "100%": { transform: "translateY(0)" },
  },
  slideInLeft: {
    "0%": { transform: "translateX(-100%)" },
    "100%": { transform: "translateX(0)" },
  },
  slideInRight: {
    "0%": { transform: "translateX(100%)" },
    "100%": { transform: "translateX(0)" },
  },
  slideOutUp: {
    "0%": { transform: "translateY(0)" },
    "100%": { transform: "translateY(-100%)" },
  },
  slideOutDown: {
    "0%": { transform: "translateY(0)" },
    "100%": { transform: "translateY(100%)" },
  },
  zoomIn: {
    "0%": { opacity: 0, transform: "scale(0.8)" },
    "100%": { opacity: 1, transform: "scale(1)" },
  },
  zoomOut: {
    "0%": { opacity: 1, transform: "scale(1)" },
    "100%": { opacity: 0, transform: "scale(0.8)" },
  },
  zoomInUp: {
    "0%": { opacity: 0, transform: "scale(0.8) translateY(20px)" },
    "100%": { opacity: 1, transform: "scale(1) translateY(0)" },
  },
  zoomInDown: {
    "0%": { opacity: 0, transform: "scale(0.8) translateY(-20px)" },
    "100%": { opacity: 1, transform: "scale(1) translateY(0)" },
  },
  bounce: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-20px)" },
  },
  bounceIn: {
    "0%": { opacity: 0, transform: "scale(0.8)" },
    "50%": { transform: "scale(1.05)" },
    "100%": { opacity: 1, transform: "scale(1)" },
  },
  bounceOut: {
    "0%": { transform: "scale(1)" },
    "50%": { transform: "scale(0.95)" },
    "100%": { opacity: 0, transform: "scale(0.8)" },
  },
  pulse: {
    "0%, 100%": { transform: "scale(1)" },
    "50%": { transform: "scale(1.05)" },
  },
  pulseGlow: {
    "0%, 100%": { opacity: 1, filter: "brightness(1)" },
    "50%": { opacity: 0.8, filter: "brightness(1.2)" },
  },
  shake: {
    "0%, 100%": { transform: "translateX(0)" },
    "25%": { transform: "translateX(-5px)" },
    "75%": { transform: "translateX(5px)" },
  },
  shakeX: {
    "0%, 100%": { transform: "translateX(0)" },
    "25%, 75%": { transform: "translateX(-10px)" },
    "50%": { transform: "translateX(10px)" },
  },
  shakeY: {
    "0%, 100%": { transform: "translateY(0)" },
    "25%, 75%": { transform: "translateY(-10px)" },
    "50%": { transform: "translateY(10px)" },
  },
  spin: {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
  },
  spinReverse: {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(-360deg)" },
  },
  wiggle: {
    "0%, 100%": { transform: "rotate(-3deg)" },
    "50%": { transform: "rotate(3deg)" },
  },
  wobble: {
    "0%": { transform: "translateX(0%)" },
    "15%": { transform: "translateX(-25%) rotate(-5deg)" },
    "30%": { transform: "translateX(20%) rotate(3deg)" },
    "45%": { transform: "translateX(-15%) rotate(-3deg)" },
    "60%": { transform: "translateX(10%) rotate(2deg)" },
    "75%": { transform: "translateX(-5%) rotate(-1deg)" },
    "100%": { transform: "translateX(0%)" },
  },
  flip: {
    "0%": { transform: "perspective(400px) rotateY(0)" },
    "100%": { transform: "perspective(400px) rotateY(180deg)" },
  },
  flipX: {
    "0%": { transform: "perspective(400px) rotateX(0)" },
    "100%": { transform: "perspective(400px) rotateX(180deg)" },
  },
  blink: { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0 } },
  typing: { "0%": { width: "0" }, "100%": { width: "100%" } },
  cursor: {
    "0%, 100%": { borderColor: "transparent" },
    "50%": { borderColor: "currentColor" },
  },
  shimmer: {
    "0%": { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" },
  },
  ripple: {
    "0%": { transform: "scale(0)", opacity: 0.5 },
    "100%": { transform: "scale(4)", opacity: 0 },
  },
  float: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-10px)" },
  },
  sink: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(10px)" },
  },
  swing: {
    "0%, 100%": { transform: "rotate(0deg)" },
    "25%": { transform: "rotate(15deg)" },
    "75%": { transform: "rotate(-15deg)" },
  },
  flash: {
    "0%, 100%": { opacity: 1 },
    "25%, 75%": { opacity: 0.5 },
    "50%": { opacity: 0 },
  },
  textReveal: {
    "0%": { clipPath: "inset(0 100% 0 0)" },
    "100%": { clipPath: "inset(0 0 0 0)" },
  },
  textGlitch: {
    "0%, 100%": { transform: "translate(0, 0)" },
    "20%": { transform: "translate(-2px, 1px)" },
    "40%": { transform: "translate(2px, -1px)" },
    "60%": { transform: "translate(-1px, 2px)" },
    "80%": { transform: "translate(1px, -2px)" },
  },
};

export const DEFAULT_ANIMATION_CONFIG: Required<AnimationConfig> = {
  name: "",
  duration: "0.3s",
  delay: "0s",
  timing: "ease",
  iteration: 1,
  direction: "normal",
  fillMode: "both",
  playState: "running",
};

export const timingFunctions = {
  linear: "linear",
  ease: "ease",
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",
  bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  elastic: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
};

// Internal utility: Safe property name to CSS kebab-case conversion
function toKebabCase(prop: string): string {
  if (prop.startsWith("--")) return prop; // preserve CSS custom variables
  return prop
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/^([A-Z])/, (m) => m.toLowerCase())
    .toLowerCase();
}

// ============================================================================
// Compilation & Generation Helpers
// ============================================================================

/**
 * Builds CSS animation definitions.
 * Set singleShorthand=true to output only `animation: ...`, otherwise outputs pure longhand properties.
 */
export function createAnimation(
  animationName: string,
  config: AnimationConfig = {},
  singleShorthand: boolean = false,
): Record<string, string | number> {
  const {
    duration = DEFAULT_ANIMATION_CONFIG.duration,
    delay = DEFAULT_ANIMATION_CONFIG.delay,
    timing = DEFAULT_ANIMATION_CONFIG.timing,
    iteration = DEFAULT_ANIMATION_CONFIG.iteration,
    direction = DEFAULT_ANIMATION_CONFIG.direction,
    fillMode = DEFAULT_ANIMATION_CONFIG.fillMode,
    playState = DEFAULT_ANIMATION_CONFIG.playState,
  } = config;

  if (singleShorthand) {
    const shorthand =
      `${animationName} ${duration} ${timing} ${delay} ${iteration} ${direction} ${fillMode} ${playState}`.trim();
    return { animation: shorthand };
  }

  return {
    animationName,
    animationDuration: duration,
    animationTimingFunction: timing,
    animationDelay: delay,
    animationIterationCount: iteration,
    animationDirection: direction,
    animationFillMode: fillMode,
    animationPlayState: playState,
  };
}

/**
 * Generates keyframes string block with safe vendor-prefix support.
 */
export function createKeyframesCSS(
  name: string,
  steps: KeyframeDefinition,
  vendorPrefix: boolean = false,
): string {
  const renderBlock = (prefix = "") => {
    let css = `@${prefix}keyframes ${name} {\n`;
    for (const [keyframe, styles] of Object.entries(steps)) {
      css += `  ${keyframe} {\n`;
      for (const [prop, value] of Object.entries(styles)) {
        css += `    ${toKebabCase(prop)}: ${value};\n`;
      }
      css += `  }\n`;
    }
    css += `}\n`;
    return css;
  };

  if (vendorPrefix) {
    return renderBlock("-webkit-") + "\n" + renderBlock();
  }
  return renderBlock();
}

export function getAnimationPreset(
  name: string,
): KeyframeDefinition | undefined {
  return animationPresets[name];
}

export function hasAnimationPreset(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(animationPresets, name);
}

export function getAnimationPresetNames(): string[] {
  return Object.keys(animationPresets);
}

export function registerAnimationPreset(
  name: string,
  steps: KeyframeDefinition,
  overwrite: boolean = false,
): boolean {
  if (animationPresets[name] && !overwrite) {
    return false;
  }
  animationPresets[name] = steps;
  return true;
}

export function registerAnimationPresets(
  presets: Record<string, KeyframeDefinition>,
  overwrite: boolean = false,
): void {
  for (const [name, steps] of Object.entries(presets)) {
    registerAnimationPreset(name, steps, overwrite);
  }
}

/**
 * Combines multiple parallel presets safely using valid types
 */
export function combineAnimations(
  animations: CombinedAnimationItem[],
): Record<string, string> {
  const animationList = animations.map((anim) => {
    const duration = anim.duration || "0.3s";
    const delay = anim.delay || "0s";
    const timing = anim.timing || "ease";
    return `${anim.name} ${duration} ${timing} ${delay}`;
  });

  return { animation: animationList.join(", ") };
}

/**
 * Builds microsecond-accurate sequence delay maps for staggered listings
 */
export function staggerChildren(
  baseDelay: string = "0s",
  increment: string = "0.1s",
  count: number = 5,
): Record<number, string> {
  const delays: Record<number, string> = {};
  const baseMs = parseTimeToMs(baseDelay);
  const incMs = parseTimeToMs(increment);

  for (let i = 0; i < count; i++) {
    const roundedMs = Math.round((baseMs + i * incMs) * 100) / 100;
    delays[i] = msToTime(roundedMs);
  }

  return delays;
}

function parseTimeToMs(time: string): number {
  const trimmed = time.trim();
  if (trimmed.endsWith("ms")) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? 0 : val;
  }
  if (trimmed.endsWith("s")) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? 0 : val * 1000;
  }
  const val = parseFloat(trimmed);
  return isNaN(val) ? 0 : val;
}

export function msToTime(ms: number): string {
  if (ms === 0) return "0ms";
  if (ms % 1000 === 0) {
    return `${ms / 1000}s`;
  }
  return `${ms}ms`;
}

/**
 * Assembles compound multi-step animation keyframe paths
 */
export function createAnimationSequence(
  steps: AnimationStep[],
): Record<string, string> {
  return combineAnimations(steps);
}

export function isValidAnimation(name: string): boolean {
  return hasAnimationPreset(name);
}

/**
 * Diagnostic search engine matching typos against existing presets
 */
export function getAnimationSuggestion(name: string): string | null {
  const presetNames = getAnimationPresetNames();
  const lowerName = name.toLowerCase();

  if (presetNames.includes(name)) return name;

  const matches = presetNames.filter(
    (n) =>
      n.toLowerCase().includes(lowerName) ||
      lowerName.includes(n.toLowerCase()),
  );

  if (matches.length > 0) return matches[0];

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

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

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
  DEFAULT_ANIMATION_CONFIG,
};