// src/compiler/scroll-timeline.ts
/**
 * Scroll-Driven Animations Engine
 * 
 * Compiles timeline-based animation descriptions into:
 *   1. Native CSS scroll-timeline / view-timeline (Chromium 115+)
 *   2. @supports fallback with JavaScript polyfill hint
 * 
 * API inspiration: GSAP's ScrollTrigger, but compiles to 0kb JS.
 */

// ============================================================================
// Types
// ============================================================================

export interface ScrollTimelineConfig {
  /** Name of the timeline */
  name: string;
  /** What drives the timeline */
  source: 'scroll' | 'view';
  /** The scrollable element (default: nearest scrollable ancestor) */
  scroller?: 'nearest' | 'root' | 'self' | string;
  /** Scroll axis */
  axis?: 'block' | 'inline' | 'x' | 'y';
  /** For view timelines: when does the element enter/exit */
  inset?: string | { start: string; end: string };
  /** Timeline range (for view timelines) */
  range?: 'cover' | 'contain' | 'entry' | 'exit' | 'entry-crossing' | 'exit-crossing' | string;
}

export interface KeyframeStep {
  /** Percentage or keyword (e.g., '0%', 'from', 'to') */
  offset: string;
  /** CSS properties at this keyframe */
  properties: Record<string, string | number>;
  /** Easing for this segment */
  easing?: string;
}

export interface ScrollAnimation {
  /** Selector to animate */
  selector: string;
  /** Timeline configuration */
  timeline: ScrollTimelineConfig;
  /** Keyframes */
  keyframes: KeyframeStep[];
  /** Animation duration (maps to timeline range) */
  duration?: string;
  /** Fill mode */
  fill?: 'none' | 'forwards' | 'backwards' | 'both';
  /** Iteration count */
  iterations?: number | 'infinite';
  /** Delay before starting */
  delay?: string;
}

export interface ScrollTimelineResult {
  /** Native CSS for scroll-driven animation */
  css: string;
  /** The @keyframes name generated */
  animationName: string;
  /** The timeline name generated */
  timelineName: string;
  /** Fallback CSS for browsers without scroll-timeline */
  fallback: string;
}

// ============================================================================
// Presets — common scroll animations
// ============================================================================

export const SCROLL_PRESETS: Record<string, ScrollAnimation> = {
  fadeIn: {
    selector: '',
    timeline: { name: 'fade-in', source: 'view', range: 'entry' },
    keyframes: [
      { offset: '0%', properties: { opacity: '0', transform: 'translateY(20px)' } },
      { offset: '100%', properties: { opacity: '1', transform: 'translateY(0)' } },
    ],
  },
  fadeOut: {
    selector: '',
    timeline: { name: 'fade-out', source: 'view', range: 'exit' },
    keyframes: [
      { offset: '0%', properties: { opacity: '1' } },
      { offset: '100%', properties: { opacity: '0' } },
    ],
  },
  scaleIn: {
    selector: '',
    timeline: { name: 'scale-in', source: 'view', range: 'entry' },
    keyframes: [
      { offset: '0%', properties: { opacity: '0', transform: 'scale(0.8)' } },
      { offset: '100%', properties: { opacity: '1', transform: 'scale(1)' } },
    ],
  },
  slideLeft: {
    selector: '',
    timeline: { name: 'slide-left', source: 'view', range: 'entry' },
    keyframes: [
      { offset: '0%', properties: { opacity: '0', transform: 'translateX(-40px)' } },
      { offset: '100%', properties: { opacity: '1', transform: 'translateX(0)' } },
    ],
  },
  slideRight: {
    selector: '',
    timeline: { name: 'slide-right', source: 'view', range: 'entry' },
    keyframes: [
      { offset: '0%', properties: { opacity: '0', transform: 'translateX(40px)' } },
      { offset: '100%', properties: { opacity: '1', transform: 'translateX(0)' } },
    ],
  },
  parallax: {
    selector: '',
    timeline: { name: 'parallax', source: 'scroll', scroller: 'root' },
    keyframes: [
      { offset: '0%', properties: { transform: 'translateY(0)' } },
      { offset: '100%', properties: { transform: 'translateY(-20%)' } },
    ],
  },
  stickyReveal: {
    selector: '',
    timeline: { name: 'sticky-reveal', source: 'view', range: 'contain' },
    keyframes: [
      { offset: '0%', properties: { opacity: '0', clipPath: 'inset(0 0 100% 0)' } },
      { offset: '50%', properties: { opacity: '1', clipPath: 'inset(0 0 0% 0)' } },
      { offset: '100%', properties: { opacity: '1', clipPath: 'inset(0 0 0% 0)' } },
    ],
  },
};

// ============================================================================
// Core Compiler
// ============================================================================

let animCounter = 0;

function generateName(prefix: string): string {
  return prefix + '-' + (animCounter++).toString(36);
}

/**
 * Compile a scroll animation into CSS.
 * 
 * Output includes:
 *   - @keyframes definition
 *   - animation-timeline property
 *   - animation-range (for view timelines)
 *   - @supports fallback for older browsers
 */
export function compileScrollAnimation(animation: ScrollAnimation): ScrollTimelineResult {
  const animName = animation.timeline.name || generateName('scroll-anim');
  const timelineName = '--' + animName + '-tl';

  let css = '';

  // 1. Define the scroll timeline
  css += '/* Scroll Timeline: ' + animName + ' */\n';
  
  if (animation.timeline.source === 'view') {
    // view-timeline
    const range = animation.timeline.range || 'entry';
    css += animation.selector + ' {\n';
    css += '  view-timeline-name: ' + timelineName + ';\n';
    css += '  view-timeline-axis: ' + (animation.timeline.axis || 'block') + ';\n';
    if (animation.timeline.inset) {
      const inset = typeof animation.timeline.inset === 'string'
        ? animation.timeline.inset
        : animation.timeline.inset.start + ' ' + animation.timeline.inset.end;
      css += '  view-timeline-inset: ' + inset + ';\n';
    }
    css += '}\n\n';
  } else {
    // scroll-timeline
    const scroller = animation.timeline.scroller === 'root' ? 'root' 
      : animation.timeline.scroller === 'self' ? 'self'
      : animation.timeline.scroller || 'nearest';
    css += animation.selector + ' {\n';
    if (scroller === 'root' || scroller === 'self' || scroller === 'nearest') {
      css += '  scroll-timeline-name: ' + timelineName + ';\n';
      css += '  scroll-timeline-axis: ' + (animation.timeline.axis || 'block') + ';\n';
    }
    css += '}\n\n';
  }

  // 2. Define @keyframes
  css += '@keyframes ' + animName + ' {\n';
  for (const step of animation.keyframes) {
    css += '  ' + step.offset + ' {\n';
    for (const [prop, value] of Object.entries(step.properties)) {
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      css += '    ' + kebabProp + ': ' + value + ';\n';
    }
    css += '  }\n';
  }
  css += '}\n\n';

  // 3. Apply animation to target
  const targetSelector = animation.selector + ' > *' || animation.selector;
  css += '/* Apply animation to children */\n';
  css += targetSelector + ' {\n';
  css += '  animation: ' + animName + ' linear both;\n';
  css += '  animation-timeline: ' + timelineName + ';\n';
  if (animation.timeline.source === 'view') {
    const range = animation.timeline.range || 'entry';
    css += '  animation-range: ' + range + ';\n';
  }
  if (animation.delay) css += '  animation-delay: ' + animation.delay + ';\n';
  css += '}\n\n';

  // 4. @supports fallback
  css += '/* Fallback for browsers without scroll-timeline */\n';
  css += '@supports not (animation-timeline: scroll()) {\n';
  css += '  ' + targetSelector + ' {\n';
  css += '    /* Use JS polyfill: https://github.com/flackr/scroll-timeline */\n';
  css += '    animation: ' + animName + ' 1s ease both;\n';
  css += '  }\n';
  css += '}\n';

  return {
    css,
    animationName: animName,
    timelineName,
    fallback: '',
  };
}

/**
 * Compile multiple scroll animations for a page.
 */
export function compileScrollAnimations(animations: ScrollAnimation[]): string {
  let css = '/* ============================================================\n';
  css += '   ChainCSS Scroll-Driven Animations\n';
  css += '   Generated: ' + new Date().toISOString() + '\n';
  css += '   ============================================================ */\n\n';

  for (const animation of animations) {
    const result = compileScrollAnimation(animation);
    css += result.css;
  }

  return css;
}

/**
 * Create a scroll animation from a preset.
 */
export function createScrollAnimation(
  preset: keyof typeof SCROLL_PRESETS,
  selector: string,
  overrides?: Partial<ScrollAnimation>
): ScrollAnimation {
  const base = SCROLL_PRESETS[preset];
  if (!base) throw new Error('Unknown scroll preset: ' + preset);

  return {
    ...base,
    selector,
    timeline: { ...base.timeline, ...overrides?.timeline },
    keyframes: overrides?.keyframes || base.keyframes,
    ...overrides,
  };
}

/**
 * Get available scroll animation presets.
 */
export function getScrollPresets(): string[] {
  return Object.keys(SCROLL_PRESETS);
}

// ============================================================================
// Exports
// ============================================================================

export const scrollTimeline = {
  compile: compileScrollAnimation,
  compileAll: compileScrollAnimations,
  create: createScrollAnimation,
  presets: SCROLL_PRESETS,
  getPresets: getScrollPresets,
};

export default scrollTimeline;
