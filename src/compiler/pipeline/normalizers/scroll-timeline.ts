// ============================================================================
// FILE: src/compiler/pipeline/normalizers/scroll-timeline.ts
// ============================================================================

export interface ScrollTimelineConfig {
  name: string;
  source: 'scroll' | 'view';
  scroller?: 'nearest' | 'root' | 'self' | string;
  axis?: 'block' | 'inline' | 'x' | 'y';
  inset?: string | { start: string; end: string };
  range?: 'cover' | 'contain' | 'entry' | 'exit' | 'entry-crossing' | 'exit-crossing' | string;
}

export interface KeyframeStep {
  offset: string;
  properties: Record<string, string | number>;
  easing?: string;
}

export interface ScrollAnimation {
  selector: string;
  timeline: ScrollTimelineConfig;
  keyframes: KeyframeStep[];
  duration?: string;
  fill?: 'none' | 'forwards' | 'backwards' | 'both';
  iterations?: number | 'infinite';
  delay?: string;
}

export interface ScrollTimelineResult {
  css: string;
  animationName: string;
  timelineName: string;
  fallback: string;
  keyframesName?: string;
  needsFallback?: boolean;
}

// --- Presets matrix preserved verbatim ---
export const SCROLL_PRESETS: Record<string, ScrollAnimation> = {
  fadeIn: {
    selector: '', timeline: { name: 'fade-in', source: 'view', range: 'entry' },
    keyframes: [{ offset: '0%', properties: { opacity: '0', transform: 'translateY(20px)' } }, { offset: '100%', properties: { opacity: '1', transform: 'translateY(0)' } }],
  },
  fadeOut: {
    selector: '', timeline: { name: 'fade-out', source: 'view', range: 'exit' },
    keyframes: [{ offset: '0%', properties: { opacity: '1' } }, { offset: '100%', properties: { opacity: '0' } }],
  },
  scaleIn: {
    selector: '', timeline: { name: 'scale-in', source: 'view', range: 'entry' },
    keyframes: [{ offset: '0%', properties: { opacity: '0', transform: 'scale(0.8)' } }, { offset: '100%', properties: { opacity: '1', transform: 'scale(1)' } }],
  },
  slideLeft: {
    selector: '', timeline: { name: 'slide-left', source: 'view', range: 'entry' },
    keyframes: [{ offset: '0%', properties: { opacity: '0', transform: 'translateX(-40px)' } }, { offset: '100%', properties: { opacity: '1', transform: 'translateX(0)' } }],
  },
  slideRight: {
    selector: '', timeline: { name: 'slide-right', source: 'view', range: 'entry' },
    keyframes: [{ offset: '0%', properties: { opacity: '0', transform: 'translateX(40px)' } }, { offset: '100%', properties: { opacity: '1', transform: 'translateX(0)' } }],
  },
  parallax: {
    selector: '', timeline: { name: 'parallax', source: 'scroll', scroller: 'root' },
    keyframes: [{ offset: '0%', properties: { transform: 'translateY(0)' } }, { offset: '100%', properties: { transform: 'translateY(-20%)' } }],
  },
  stickyReveal: {
    selector: '', timeline: { name: 'sticky-reveal', source: 'view', range: 'contain' },
    keyframes: [
      { offset: '0%', properties: { opacity: '0', clipPath: 'inset(0 0 100% 0)' } },
      { offset: '50%', properties: { opacity: '1', clipPath: 'inset(0 0 0% 0)' } },
      { offset: '100%', properties: { opacity: '1', clipPath: 'inset(0 0 0% 0)' } },
    ],
  },
};

let animCounter = 0;
function generateName(prefix: string): string { return prefix + '-' + (animCounter++).toString(36); }

export function compileScrollAnimation(animation: ScrollAnimation): ScrollTimelineResult {
  const animName = animation.timeline.name || generateName('scroll-anim');
  const timelineName = '--' + animName + '-tl';
  const target = animation.selector ? `${animation.selector}` : '*';
  
  let css = `/* Scroll Timeline: ${animName} */\n`;

  // Coherent, unified structural block configuration
  css += `${target} {\n`;
  if (animation.timeline.source === 'view') {
    css += `  view-timeline-name: ${timelineName};\n  view-timeline-axis: ${animation.timeline.axis || 'block'};\n`;
    if (animation.timeline.inset) {
      const inset = typeof animation.timeline.inset === 'string' ? animation.timeline.inset : `${animation.timeline.inset.start} ${animation.timeline.inset.end}`;
      css += `  view-timeline-inset: ${inset};\n`;
    }
  } else {
    css += `  scroll-timeline-name: ${timelineName};\n  scroll-timeline-axis: ${animation.timeline.axis || 'block'};\n`;
  }
  
  css += `  animation: ${animName} linear both;\n  animation-timeline: ${timelineName};\n`;
  if (animation.timeline.source === 'view') {
    css += `  animation-range: ${animation.timeline.range || 'entry 0% cover 50%'};\n`;
  }
  if (animation.delay) {
    css += `  animation-delay: ${animation.delay};\n`;
  }
  css += `}\n\n`;

  // Write structural keyframes
  css += `@keyframes ${animName} {\n`;
  for (const step of animation.keyframes) {
    css += `  ${step.offset} {\n`;
    for (const [prop, value] of Object.entries(step.properties)) {
      const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      css += `    ${kebab}: ${value};\n`;
    }
    css += `  }\n`;
  }
  css += `}\n\n`;

  css += `@supports not (animation-timeline: scroll()) and not (animation-timeline: view()) {\n  ${target} { animation: none; }\n}\n`;

  return { css, animationName: animName, timelineName, fallback: '', keyframesName: animName, needsFallback: true };
}

export function compileScrollAnimations(animations: ScrollAnimation[]): string {
  // Deterministic output header matching modern static analysis requirements
  let css = `/* ChainCSS Scroll-Driven Animations - Production Build */\n\n`;
  for (const a of animations) css += compileScrollAnimation(a).css + '\n';
  return css;
}

export function createScrollAnimation(preset: keyof typeof SCROLL_PRESETS, selector: string, overrides?: Partial<ScrollAnimation>): ScrollAnimation {
  const base = SCROLL_PRESETS[preset]; 
  if (!base) throw new Error('Unknown scroll preset: ' + preset);
  return { ...base, selector, timeline: { ...base.timeline, ...overrides?.timeline }, keyframes: overrides?.keyframes || base.keyframes, ...overrides };
}

export function getScrollPresets(): string[] { return Object.keys(SCROLL_PRESETS); }

// --- Shorthand entangle API ---
export interface ScrollEntangleOptions {
  range?: string; y?: string; x?: string; opacity?: string; scale?: string; rotate?: string;
  timeline?: 'scroll' | 'view'; axis?: 'block' | 'inline' | 'y' | 'x';
}

let entangleCounter = 0;
function parseRange(v: string) { 
  if (!v?.includes('->')) return { from: v, to: v }; 
  const [f, t] = v.split('->').map(s => s.trim()); 
  return { from: f, to: t }; 
}

export function createScrollTimeline(selector: string, opts: ScrollEntangleOptions) {
  const id = `scroll-${++entangleCounter}`;
  const kfName = `${id}-kf`;
  const timeline = opts.timeline ?? 'view';
  const axis = opts.axis ?? 'block';
  const range = opts.range ?? (timeline === 'view' ? 'entry 0% cover 50%' : '0% 100%');
  const frames: Record<string, any> = { '0%': {}, '100%': {} };
  
  if (opts.y) { 
    const { from, to } = parseRange(opts.y); 
    frames['0%'].transform = `${frames['0%'].transform || ''} translateY(${from})`.trim(); 
    frames['100%'].transform = `${frames['100%'].transform || ''} translateY(${to})`.trim(); 
  }
  if (opts.x) { 
    const { from, to } = parseRange(opts.x); 
    frames['0%'].transform = `${frames['0%'].transform || ''} translateX(${from})`.trim(); 
    frames['100%'].transform = `${frames['100%'].transform || ''} translateX(${to})`.trim(); 
  }
  if (opts.scale) { 
    const { from, to } = parseRange(opts.scale); 
    frames['0%'].transform = `${frames['0%'].transform || ''} scale(${from})`.trim(); 
    frames['100%'].transform = `${frames['100%'].transform || ''} scale(${to})`.trim(); 
  }
  if (opts.opacity) { 
    const { from, to } = parseRange(opts.opacity); 
    frames['0%'].opacity = from; 
    frames['100%'].opacity = to; 
  }
  
  const kf = `@keyframes ${kfName} { 0% { ${Object.entries(frames['0%']).map(([k, v]) => `${k}:${v};`).join(' ')} } 100% { ${Object.entries(frames['100%']).map(([k, v]) => `${k}:${v};`).join(' ')} } }`;
  const nativeCSS = `${kf}\n${selector}{animation:${kfName} linear both;animation-timeline:${timeline}(${axis});animation-range:${range};}\n@supports not (animation-timeline: view()){${selector}{animation:none;}}`;
  return { css: nativeCSS, keyframesName: kfName, needsFallback: true };
}

export function scrollEntangleMacro(value: any, ctx: any) {
  if (!value || typeof value !== 'object') return;
  if (!ctx._entangle) ctx._entangle = []; 
  ctx._entangle.push({ type: 'scroll', opts: value, native: true });
  ctx.willChange = 'transform, opacity'; 
  ctx.transform = ctx.transform || 'translateZ(0)';
}

export const scrollTimeline = { compile: compileScrollAnimation, compileAll: compileScrollAnimations, create: createScrollAnimation, presets: SCROLL_PRESETS, getPresets: getScrollPresets, createTimeline: createScrollTimeline };
export default scrollTimeline;