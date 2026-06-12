// chaincss/src/compiler/shorthands.ts

import { chain } from '../core/style-collector.js';

/**
 * 1. THE DICTIONARY (Simple 1-to-1 Swaps)
 * Handled by the ChainClass for performance.
 */
export const shorthandMap: Record<string, string> = {
  'm': 'margin', 'mt': 'marginTop', 'mr': 'marginRight', 'mb': 'marginBottom', 'ml': 'marginLeft',
  'p': 'padding', 'pt': 'paddingTop', 'pr': 'paddingRight', 'pb': 'paddingBottom', 'pl': 'paddingLeft',
  'z': 'zIndex', 'op': 'opacity', 'ov': 'overflow', 'ovx': 'overflowX', 'ovy': 'overflowY',
  'objFit': 'objectFit', 'objPos': 'objectPosition',
  'd': 'display', 'pos': 'position', 'w': 'width', 'h': 'height', 
  'minW': 'minWidth', 'maxW': 'maxWidth', 'minH': 'minHeight', 'maxH': 'maxHeight', 
  'bg': 'backgroundColor', 'bgImg': 'backgroundImage', 'bgPos': 'backgroundPosition', 'bgSize': 'backgroundSize',
  'c': 'color', 
  'flexDir': 'flexDirection', 'flexWrap': 'flexWrap', 'justify': 'justifyContent', 
  'items': 'alignItems', 'self': 'alignSelf', 'content': 'alignContent',
  'gap': 'gap', 'gapX': 'columnGap', 'gapY': 'rowGap', 
  'grow': 'flexGrow', 'shrink': 'flexShrink', 'basis': 'flexBasis', 'order': 'order',
  'gridCols': 'gridTemplateColumns', 'gridRows': 'gridTemplateRows', 
  'gridRow': 'gridRow', 'gridCol': 'gridColumn',
  'rounded': 'borderRadius', 'br': 'borderRadius', 'radius': 'borderRadius',
  'roundedTL': 'borderTopLeftRadius', 'roundedTR': 'borderTopRightRadius', 
  'roundedBR': 'borderBottomRightRadius', 'roundedBL': 'borderBottomLeftRadius',
  'border': 'border', 'borderW': 'borderWidth', 'borderC': 'borderColor', 'borderS': 'borderStyle',
  'borderT': 'borderTop', 'borderR': 'borderRight', 'borderB': 'borderBottom', 'borderL': 'borderLeft',
  'fontF': 'fontFamily', 'text': 'color', 'align': 'textAlign', 
  'fs': 'fontSize', 'fw': 'fontWeight', 'lh': 'lineHeight', 'ls': 'letterSpacing',
  'shadow': 'boxShadow', 'textShadow': 'textShadow',
  'transform': 'transform', 'transformOrigin': 'transformOrigin',
  'transition': 'transition', 'transitionAll': 'transition',
  'cursor': 'cursor', 'pointer': 'cursor', 'resize': 'resize',
  'filter': 'filter', 'backdropFilter': 'backdropFilter'
};

// Type for macro handler
type MacroHandler = (value: any, catcher: Record<string, any>, useTokens: boolean) => void;

/**
 * 2. THE MACRO REGISTRY (Complex Logic)
 */
export const macros: Record<string, MacroHandler> = {
  // --- Spacing & Sizing ---
  mx: (v, c) => { 
    const value = typeof v === 'number' ? `${v}px` : v;
    c.marginLeft = value; 
    c.marginRight = value; 
  },
  my: (v, c) => { 
    const value = typeof v === 'number' ? `${v}px` : v;
    c.marginTop = value; 
    c.marginBottom = value; 
  },
  px: (v, c) => { 
    const value = typeof v === 'number' ? `${v}px` : v;
    c.paddingLeft = value; 
    c.paddingRight = value; 
  },
  py: (v, c) => { 
    const value = typeof v === 'number' ? `${v}px` : v;
    c.paddingTop = value; 
    c.paddingBottom = value; 
  },
  size: (v, c) => { c.width = v; c.height = v; },
  inset: (v, c) => { 
    if (typeof v === 'object') {
      if (v.top !== undefined) c.top = v.top;
      if (v.right !== undefined) c.right = v.right;
      if (v.bottom !== undefined) c.bottom = v.bottom;
      if (v.left !== undefined) c.left = v.left;
    } else {
      c.top = v; c.right = v; c.bottom = v; c.left = v;
    }
  },
  insetX: (v, c) => { c.left = v; c.right = v; },
  insetY: (v, c) => { c.top = v; c.bottom = v; },

  // --- Borders ---
  borderX: (v, c) => { c.borderLeft = v; c.borderRight = v; },
  borderY: (v, c) => { c.borderTop = v; c.borderBottom = v; },

  // --- Layouts & Display ---
  flex: (v, c) => { 
    c.display = 'flex'; 
    if (v && v !== true && typeof v === 'string') c.flex = v; 
  },
  inlineFlex: (v, c) => { c.display = 'inline-flex'; },
  grid: (v, c) => { 
    c.display = 'grid'; 
    if (v && v !== true && typeof v === 'string') c.grid = v; 
  },
  inlineGrid: (v, c) => { c.display = 'inline-grid'; },
  cols: (v, c) => { 
    c.gridTemplateColumns = typeof v === 'number' ? `repeat(${v}, minmax(0, 1fr))` : v; 
  },
  rows: (v, c) => { 
    c.gridTemplateRows = typeof v === 'number' ? `repeat(${v}, minmax(0, 1fr))` : v; 
  },
  center: (v, c) => {
    c.display = v === 'inline' ? 'inline-flex' : 'flex';
    c.alignItems = 'center';
    c.justifyContent = 'center';
  },
  flexCenter: (v, c) => {
    c.display = 'flex'; 
    c.alignItems = 'center'; 
    c.justifyContent = 'center';
    if (v === 'col' || v === 'column') c.flexDirection = 'column';
  },
  gridCenter: (v, c) => { 
    c.display = 'grid'; 
    c.placeItems = 'center'; 
  },
  stack: (v, c) => {
    c.display = 'flex';
    if (typeof v === 'object') {
      c.flexDirection = v.dir === 'row' ? 'row' : 'column';
      c.gap = v.spacing;
    } else if (v === 'row') {
      c.flexDirection = 'row';
      c.gap = '1rem';
    } else {
      c.flexDirection = 'column';
      c.gap = typeof v === 'number' ? `${v}px` : v || '1rem';
    }
  },
  gridTable: (v, c) => {
    const min = typeof v === 'number' ? `${v}px` : v;
    c.display = 'grid';
    c.gridTemplateColumns = `repeat(auto-fit, minmax(${min}, 1fr))`;
  },

  // --- Visibility & Behavior ---
  hide: (v, c) => { 
    c.opacity = 0; 
    c.visibility = 'hidden'; 
    c.pointerEvents = 'none'; 
  },
  show: (v, c) => { 
    c.opacity = 1; 
    c.visibility = 'visible'; 
    c.pointerEvents = 'auto'; 
  },
  unselectable: (v, c) => {
    c.userSelect = 'none'; 
    c.WebkitUserSelect = 'none';
    c.MozUserSelect = 'none'; 
    c.msUserSelect = 'none'; 
    c.cursor = 'default';
  },
  scrollable: (v, c) => {
    if (v === 'x') {
      c.overflowX = 'auto';
      c.overflowY = 'hidden';
    } else if (v === 'y') {
      c.overflowX = 'hidden';
      c.overflowY = 'auto';
    } else if (v === 'both') {
      c.overflow = 'auto';
    } else {
      c.overflow = 'auto';
    }
    c.WebkitOverflowScrolling = 'touch';
  },

  // --- Positioning ---
  absolute: (v, c) => handlePosition('absolute', v, c),
  fixed: (v, c) => handlePosition('fixed', v, c),
  sticky: (v, c) => handlePosition('sticky', v, c),
  relative: (v, c) => handlePosition('relative', v, c),

  // --- Shapes & Content ---
  circle: (v, c) => {
    c.width = v; 
    c.height = v; 
    c.borderRadius = '50%';
    c.display = 'flex'; 
    c.alignItems = 'center'; 
    c.justifyContent = 'center';
  },
  square: (v, c) => {
    c.width = v; 
    c.height = v;
    c.display = 'flex'; 
    c.alignItems = 'center'; 
    c.justifyContent = 'center';
  },
  truncate: (v, c) => {
    c.overflow = 'hidden'; 
    c.textOverflow = 'ellipsis'; 
    c.whiteSpace = 'nowrap';
  },
  aspect: (v: string, c) => {
    const map: Record<string, string> = { 
      square: '1 / 1', 
      video: '16 / 9', 
      golden: '1.618 / 1',
      portrait: '3 / 4',
      landscape: '4 / 3'
    };
    c.aspectRatio = map[v] || v;
  },

  // --- Aesthetic Effects ---
  glass: (v, c) => {
    const blur = typeof v === 'number' ? `${v}px` : v || '10px';
    c.backdropFilter = `blur(${blur})`; 
    c.WebkitBackdropFilter = `blur(${blur})`;
    c.backgroundColor = 'rgba(255, 255, 255, 0.1)'; 
    c.border = '1px solid rgba(255, 255, 255, 0.2)';
  },
  glow: (v, c) => {
    let color: string;
    let size: number;
    
    if (typeof v === 'string') {
      color = v;
      size = 20;
    } else {
      color = v.color || 'rgba(255,255,255,0.5)';
      size = v.size || 20;
    }
    
    c.boxShadow = `0 0 ${size/4}px ${color}, 0 0 ${size/2}px ${color}, 0 0 ${size}px ${color}`;
  },
  textGradient: (v, c) => {
    let colors: string[];
    let angle: number;
    
    if (Array.isArray(v)) {
      colors = v;
      angle = 90;
    } else {
      colors = v.colors;
      angle = v.angle || 90;
    }
    
    c.backgroundImage = `linear-gradient(${angle}deg, ${colors.join(', ')})`;
    c.WebkitBackgroundClip = 'text'; 
    c.backgroundClip = 'text';
    c.WebkitTextFillColor = 'transparent'; 
    c.color = 'transparent'; 
    c.display = 'inline-block';
  },
  meshGradient: (v, c) => {
    const [c1, c2, c3, c4] = Array.isArray(v) ? v : [v[0], v[1], v[2], v[3]];
    c.backgroundColor = c1;
    c.backgroundImage = `radial-gradient(at 0% 0%, ${c2} 0px, transparent 50%), radial-gradient(at 100% 0%, ${c3} 0px, transparent 50%), radial-gradient(at 100% 100%, ${c4} 0px, transparent 50%)`;
  },
  noise: (v, c) => {
    const op = typeof v === 'number' ? v : 0.05;
    c.backgroundImage = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='${op}'/%3E%3C/svg%3E")`;
  },

  // --- Logic & Responsive ---
  skeleton: (v, c) => {
    let active: boolean;
    let baseColor: string;
    let highlightColor: string;
    
    if (typeof v === 'boolean') {
      active = v;
      baseColor = 'rgba(0,0,0,0.1)';
      highlightColor = 'rgba(0,0,0,0.05)';
    } else {
      active = v.active;
      baseColor = v.color || 'rgba(0,0,0,0.1)';
      highlightColor = v.highlight || 'rgba(0,0,0,0.05)';
    }
    
    if (!active) return;
    
    c.backgroundColor = baseColor;
    c.backgroundImage = `linear-gradient(90deg, ${baseColor} 25%, ${highlightColor} 50%, ${baseColor} 75%)`;
    c.backgroundSize = '200% 100%'; 
    c.animation = 'skeleton-loading 1.5s infinite linear';
    
    if (!c.atRules) c.atRules = [];
    c.atRules.push({ 
      type: 'keyframes', 
      name: 'skeleton-loading', 
      steps: { 
        '0%': { backgroundPosition: '200% 0' }, 
        '100%': { backgroundPosition: '-200% 0' } 
      } 
    });
  },
  fluidText: (v, c) => {
    const min = typeof v.min === 'number' ? `${v.min}px` : v.min;
    const max = typeof v.max === 'number' ? `${v.max}px` : v.max;
    c.fontSize = `clamp(${min}, ${v.vw || '4vw'}, ${max})`;
  },
  safeArea: (v, c) => {
    const edges = Array.isArray(v) ? v : [v || 'all'];
    const map: Record<string, string> = { 
      top: 'Top', 
      bottom: 'Bottom', 
      left: 'Left', 
      right: 'Right' 
    };
    
    edges.forEach(e => {
      if (e === 'all') {
        Object.keys(map).forEach(k => {
          c[`padding${map[k]}`] = `env(safe-area-inset-${k})`;
        });
      } else if (map[e]) {
        c[`padding${map[e]}`] = `env(safe-area-inset-${e})`;
      }
    });
  },
  
  // --- Nested Rules & Interactions ---
  clickScale: (v, c) => {
    const s = typeof v === 'number' ? v : 0.95;
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({ 
      selector: '&:active', 
      styles: { 
        transform: `scale(${s})`, 
        transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1)' 
      } 
    });
  },
  onInteracting: (v, c, useTokens) => {
    const res = getSubStyles(v, useTokens);
    if (!c.nestedRules) c.nestedRules = [];
    ['&:hover', '&:focus-visible', '&:active'].forEach(s => 
      c.nestedRules.push({ selector: s, styles: res })
    );
  },
  children: (v, c, useTokens) => {
    const res = getSubStyles(v, useTokens);
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({ selector: '& > *', styles: res });
  },
  dark: (v, c, useTokens) => handleTheme(v, c, 'dark', useTokens),
  light: (v, c, useTokens) => handleTheme(v, c, 'light', useTokens),

  // --- Utility Macros ---
  pill: (v, c) => { 
    c.borderRadius = '9999px'; 
    c.padding = '8px 20px'; 
    c.display = 'inline-flex'; 
    c.alignItems = 'center'; 
    c.whiteSpace = 'nowrap'; 
  },
  containerMacro: (v, c) => { 
    c.width = '100%'; 
    c.maxWidth = typeof v === 'number' ? `${v}px` : v || '1200px';
    // Use the mx and px macros
    macros.mx('auto', c, false);
    macros.px('20px', c, false);
  },
  fullScreen: (v, c) => { 
    c.position = 'fixed'; 
    c.top = 0; c.right = 0; c.bottom = 0; c.left = 0;
    c.zIndex = typeof v === 'number' ? v : 9999; 
  },
  shimmer: (v, c) => {
    c.backgroundImage = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)';
    c.backgroundSize = '200% 100%';
    c.animation = 'shimmer 2s infinite linear';
    if (!c.atRules) c.atRules = [];
    c.atRules.push({ 
      type: 'keyframes', 
      name: 'shimmer', 
      steps: { 
        '0%': { backgroundPosition: '-200% 0' }, 
        '100%': { backgroundPosition: '200% 0' } 
      } 
    });
  },
  bento: (v, c, useTokens) => {
    // Setup the Grid Container
    c.display = 'grid';
    
    if (typeof v === 'number') {
      c.gridTemplateColumns = `repeat(${v}, minmax(0, 1fr))`;
      c.gap = '16px';
    } else if (typeof v === 'object') {
      c.gridTemplateColumns = `repeat(${v.cols || 4}, minmax(0, 1fr))`;
      c.gap = typeof v.gap === 'number' ? `${v.gap}px` : v.gap || '16px';
    }
    
    // Setup the Children
    if (!c.nestedRules) c.nestedRules = [];
    
    const childStyles = typeof v?.children === 'function' 
      ? getSubStyles(v.children, useTokens)
      : { 
          borderRadius: '12px', 
          padding: '20px', 
          backgroundColor: 'rgba(255,255,255,0.05)'
        };
    
    c.nestedRules.push({
      selector: '& > *',
      styles: childStyles
    });
  },
  pressable: (v, c, useTokens) => { 
    c.cursor = 'pointer'; 
    macros.unselectable(v, c, useTokens); 
    macros.clickScale(v, c, useTokens);
    // Add hover effect
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({ 
      selector: '&:hover', 
      styles: { opacity: 0.8 } 
    });
  },
  focusRing: (v, c, useTokens) => { 
    const ringColor = typeof v === 'string' ? v : '#3b82f6';
    // Use onInteracting to handle focus styles
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({ 
      selector: '&:focus-visible', 
      styles: { 
        outline: `2px solid ${ringColor}`,
        outlineOffset: '2px'
      } 
    });
  },
  outlineDebug: (v, c) => {
    c.border = '1px solid red';
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({ 
      selector: '& > *', 
      styles: { outline: '1px solid rgba(0,255,0,0.5)' } 
    });
  },
  parallax: (v, c) => { 
    c.transformStyle = 'preserve-3d'; 
    c.perspective = '1px'; 
    c.height = '100vh';
    c.overflowX = 'hidden'; 
    c.overflowY = 'auto';
    if (!c.nestedRules) c.nestedRules = [];
    const scale = typeof v === 'number' ? v : 2;
    c.nestedRules.push({ 
      selector: '& > *', 
      styles: { transform: `translateZ(-1px) scale(${scale})` } 
    });
  },
  lineClamp: (v, c) => { 
    const lines = typeof v === 'number' ? v : 3;
    c.display = '-webkit-box'; 
    c.WebkitLineClamp = lines; 
    c.WebkitBoxOrient = 'vertical'; 
    c.overflow = 'hidden';
  },
  frostedNav: (v, c, useTokens) => { 
    macros.fixed({ top: 0, left: 0 }, c, useTokens);
    c.width = '100%'; 
    macros.glass(v || 15, c, useTokens);
    macros.safeArea('top', c, useTokens);
    c.zIndex = 1000;
  }
};

/**
 * HELPERS
 */
function handlePosition(type: string, v: any, c: any): void {
  c.position = type;
  if (v && typeof v === 'object') {
    if (v.top !== undefined) c.top = v.top;
    if (v.right !== undefined) c.right = v.right;
    if (v.bottom !== undefined) c.bottom = v.bottom;
    if (v.left !== undefined) c.left = v.left;
  } else if (v !== undefined && typeof v !== 'boolean') {
    // If a single value is provided, apply to all sides
    c.top = v;
    c.right = v;
    c.bottom = v;
    c.left = v;
  }
}

function getSubStyles(callback: any, useTokens: boolean): Record<string, any> {
  const sub = chain();
  callback(sub);
  const result = sub.$el();
  const { selectors, atRules, nestedRules, ...pure } = result;
  return pure;
}

function handleTheme(cb: any, c: any, mode: string, useTokens: boolean): void {
  if (!c.atRules) c.atRules = [];
  c.atRules.push({ 
    type: 'media', 
    query: `(prefers-color-scheme: ${mode})`, 
    styles: getSubStyles(cb, useTokens) 
  });
}

/**
 * Main handler for shorthand processing
 * Returns true if the shorthand was handled, false otherwise
 */
export function handleShorthand(
  prop: string, 
  value: any, 
  catcher: Record<string, any>, 
  useTokens: boolean = true
): boolean {
  // Check if it's a macro
  if (macros[prop]) { 
    macros[prop](value, catcher, useTokens); 
    return true; 
  }
  
  // Handle transform properties
  if (['scale', 'rotate', 'skew'].includes(prop)) {
    if (!catcher._transforms) catcher._transforms = {};
    catcher._transforms[prop] = value;
    return true;
  }
  
  // Handle translate X/Y
  if (prop === 'x') {
    if (!catcher._transforms) catcher._transforms = {};
    catcher._transforms.translateX = value;
    return true;
  }
  
  if (prop === 'y') {
    if (!catcher._transforms) catcher._transforms = {};
    catcher._transforms.translateY = value;
    return true;
  }
  
  return false;
}

/**
 * Utility to check if a property is a registered shorthand
 */
export function isShorthand(prop: string): boolean {
  return prop in shorthandMap || prop in macros;
}

/**
 * Get the expanded property name for a shorthand
 */
export function expandShorthand(prop: string): string | null {
  return shorthandMap[prop] || null;
}

/**
 * Get all available shorthands
 */
export function getAvailableShorthands(): string[] {
  return [...Object.keys(shorthandMap), ...Object.keys(macros)];
}