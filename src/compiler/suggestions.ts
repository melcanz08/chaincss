// src/compiler/suggestions.ts
// Types
export interface SuggestionMatch {
  name: string;
  distance: number;
  type: 'shorthand' | 'css-property' | 'macro' | 'animation' | 'breakpoint';
}

// Known shorthands (from shorthandMap)

// Known macros (from intent-engine and Chain.ts)
export const KNOWN_MACROS: string[] = [
  // Intent Macros
  'stickyHeader', 'card', 'hero', 'container', 'center', 'gridList',
  'sidebar', 'pill', 'glass', 'truncate', 'srOnly', 'autoContrast',
  // Chain.ts special methods
  'flex', 'grid', 'inlineFlex', 'inlineGrid', 'flexCenter', 'gridCenter',
  'stack', 'cols', 'rows', 'bento', 'gridTable',
  'mx', 'my', 'px', 'py', 'size', 'gap', 'gapX', 'gapY', 'inset', 'insetX', 'insetY',
  'borderX', 'borderY',
  'absolute', 'fixed', 'sticky', 'relative',
  'hide', 'show', 'unselectable', 'scrollable', 'safeArea',
  'circle', 'square', 'truncate', 'fluidText', 'aspect', 'lineClamp',
  'glass', 'glow', 'textGradient', 'meshGradient', 'noise', 'shimmer',
  'clickScale', 'pressable', 'focusRing', 'skeleton',
  'fullScreen', 'containerMacro', 'outlineDebug', 'parallax', 'frostedNav',
  'fadeIn', 'slideInUp', 'zoomIn', 'bounce', 'pulse', 'spin', 'shake', 'float',
  // Semantic macros
  'surface', 'text', 'elevation', 'state', 'spacing',
  // Intent API
  'intent',
  // Constraint
  'constrain',
];
export const KNOWN_SHORTHANDS: string[] = [
  // Spacing
  'm', 'mt', 'mr', 'mb', 'ml', 
  'p', 'pt', 'pr', 'pb', 'pl',
  'mx', 'my', 'px', 'py',
  'inset', 'insetX', 'insetY',
  
  // Sizing
  'w', 'h', 'minW', 'maxW', 'minH', 'maxH',
  'size', 'aspect',
  
  // Display & Layout
  'd', 'pos', 'flex', 'grid', 'inlineFlex', 'inlineGrid',
  'flexDir', 'flexWrap', 'justify', 'items', 'align', 'content', 'self',
  'center', 'flexCenter', 'gridCenter', 'stack', 'gridTable',
  'cols', 'rows', 'gap', 'gapX', 'gapY', 'grow', 'shrink', 'basis', 'order',
  
  // Colors & Backgrounds
  'bg', 'c', 'text', 'op',
  
  // Borders
  'border', 'borderW', 'borderC', 'borderS',
  'borderT', 'borderR', 'borderB', 'borderL',
  'borderX', 'borderY',
  'rounded', 'br', 'radius',
  'roundedTL', 'roundedTR', 'roundedBR', 'roundedBL',
  
  // Typography
  'fontF', 'fs', 'fw', 'lh', 'ls', 'align',
  
  // Effects
  'shadow', 'truncate', 'hide', 'show', 'unselectable',
  'scrollable', 'glass', 'glow', 'textGradient', 'meshGradient', 'noise',
  
  // Positioning
  'absolute', 'fixed', 'sticky', 'relative',
  
  // Utilities
  'pill', 'container', 'fullScreen', 'shimmer', 'bento',
  'pressable', 'focusRing', 'outlineDebug', 'skeleton',
  'safeArea', 'clickScale', 'onInteracting', 'children',
  'dark', 'light', 'fluidText'
];

// Common CSS properties for suggestions
export const COMMON_CSS_PROPERTIES: string[] = [
  'display', 'position', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'color', 'background', 'background-color', 'background-image', 'background-size', 'background-position',
  'border', 'border-width', 'border-style', 'border-color', 'border-radius',
  'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
  'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing', 'text-align',
  'cursor', 'opacity', 'z-index', 'overflow', 'overflow-x', 'overflow-y',
  'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'gap',
  'grid', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'transition', 'transform', 'animation', 'box-shadow', 'text-shadow',
  'filter', 'backdrop-filter', 'clip-path', 'mask',
  'pointer-events', 'user-select', 'resize', 'appearance'
];

// Animation presets (from animations.ts)
export const ANIMATION_PRESETS: string[] = [
  'fadeIn', 'fadeOut', 'fadeInUp', 'fadeInDown', 'fadeInLeft', 'fadeInRight',
  'fadeOutUp', 'fadeOutDown', 'slideInUp', 'slideInDown', 'slideInLeft', 'slideInRight',
  'slideOutUp', 'slideOutDown', 'zoomIn', 'zoomOut', 'zoomInUp', 'zoomInDown',
  'bounce', 'bounceIn', 'bounceOut', 'pulse', 'pulseGlow', 'shake', 'shakeX', 'shakeY',
  'spin', 'spinReverse', 'wiggle', 'wobble', 'flip', 'flipX', 'blink', 'typing',
  'cursor', 'shimmer', 'ripple', 'float', 'sink', 'swing', 'flash',
  'textReveal', 'textGlitch'
];

// Breakpoint names (from breakpoints.ts)
export const BREAKPOINTS: string[] = [
  'sm', 'md', 'lg', 'xl', '2xl',
  'mobile', 'tablet', 'desktop',
  'mobile-sm', 'mobile-md', 'tablet-sm', 'tablet-lg',
  'desktop-sm', 'desktop-md', 'desktop-lg',
  'portrait', 'landscape',
  'dark', 'light', 'reducedMotion', 'highContrast',
  'print', 'hover', 'no-hover', 'fine', 'coarse'
];

// Simple Levenshtein distance for finding closest matches
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1, higher is better)
function similarityScore(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

// Find best matches with scores
function findBestMatches(
  query: string, 
  candidates: string[], 
  maxResults: number = 3,
  maxDistance: number = 3
): SuggestionMatch[] {
  const matches: SuggestionMatch[] = [];
  
  for (const candidate of candidates) {
    const distance = levenshteinDistance(query.toLowerCase(), candidate.toLowerCase());
    if (distance <= maxDistance) {
      matches.push({
        name: candidate,
        distance,
        type: getTypeForCandidate(candidate)
      });
    }
  }
  
  // Sort by distance (lower is better) then by name
  matches.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.name.localeCompare(b.name);
  });
  
  return matches.slice(0, maxResults);
}

// Get type for a candidate
function getTypeForCandidate(candidate: string): 'shorthand' | 'css-property' | 'macro' | 'animation' | 'breakpoint' {
  if (KNOWN_MACROS.includes(candidate)) return 'macro';
  if (KNOWN_SHORTHANDS.includes(candidate)) return 'shorthand';
  if (ANIMATION_PRESETS.includes(candidate)) return 'animation';
  if (BREAKPOINTS.includes(candidate)) return 'breakpoint';
  if (KNOWN_SHORTHANDS.includes(candidate)) return 'shorthand';
  if (COMMON_CSS_PROPERTIES.includes(candidate)) return 'css-property';
  if (ANIMATION_PRESETS.includes(candidate)) return 'animation';
  if (BREAKPOINTS.includes(candidate)) return 'breakpoint';
  return 'macro';
}

// Get suggestion for invalid shorthand or property
export function getSuggestion(
  prop: string, 
  validProperties: string[] = [],
  type: 'shorthand' | 'css-property' | 'all' = 'all'
): string | SuggestionMatch | null {
  // Build candidate list based on type
  let candidates: string[] = [];
  
  if (type === 'shorthand') {
    candidates = KNOWN_SHORTHANDS;
  } else if (type === 'css-property') {
    candidates = [...COMMON_CSS_PROPERTIES, ...validProperties];
  } else {
    candidates = [
      ...KNOWN_MACROS,
      ...KNOWN_SHORTHANDS,
      ...COMMON_CSS_PROPERTIES,
      ...validProperties,
      ...ANIMATION_PRESETS,
      ...BREAKPOINTS
    ];
  }
  
  // Remove duplicates
  candidates = [...new Set(candidates)];
  
  // Find best matches
  const matches = findBestMatches(prop, candidates, 1, 3);
  
  if (matches.length > 0) {
    return matches[0];
  }
  
  return null;
}

// Get multiple suggestions
export function getSuggestions(
  prop: string,
  validProperties: string[] = [],
  maxResults: number = 3
): SuggestionMatch[] {
  const candidates = [...new Set([
    ...KNOWN_SHORTHANDS,
    ...COMMON_CSS_PROPERTIES,
    ...validProperties,
    ...ANIMATION_PRESETS,
    ...BREAKPOINTS
  ])];
  
  return findBestMatches(prop, candidates, maxResults, 4);
}

// Get suggestion for CSS property with context
export function getPropertySuggestion(
  prop: string,
  context?: 'spacing' | 'color' | 'typography' | 'layout' | 'animation'
): string | null {
  const contextProperties: Record<string, string[]> = {
    spacing: [
      'margin', 'padding', 'gap', 'width', 'height', 'top', 'right', 'bottom', 'left',
      'inset', 'position', 'translate', 'scale', 'rotate'
    ],
    color: [
      'color', 'background-color', 'border-color', 'outline-color', 'fill', 'stroke',
      'box-shadow', 'text-shadow'
    ],
    typography: [
      'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
      'text-align', 'text-decoration', 'text-transform', 'word-spacing'
    ],
    layout: [
      'display', 'position', 'flex', 'grid', 'justify-content', 'align-items',
      'flex-direction', 'flex-wrap', 'order', 'z-index', 'overflow'
    ],
    animation: [
      'animation', 'transition', 'transform', 'opacity', 'filter', 'backdrop-filter',
      'transform-origin', 'transition-property', 'transition-duration'
    ]
  };
  
  const candidates = context && contextProperties[context] 
    ? contextProperties[context] 
    : COMMON_CSS_PROPERTIES;
  
  const matches = findBestMatches(prop, candidates, 1, 2);
  
  return matches.length > 0 ? matches[0].name : null;
}

// Get shorthand suggestion with explanation
export function getShorthandSuggestion(shorthand: string): { suggestion: string; explanation: string } | null {
  const shorthandMap: Record<string, { property: string; description: string }> = {
    'm': { property: 'margin', description: 'Sets margin on all sides' },
    'mt': { property: 'margin-top', description: 'Sets top margin' },
    'mr': { property: 'margin-right', description: 'Sets right margin' },
    'mb': { property: 'margin-bottom', description: 'Sets bottom margin' },
    'ml': { property: 'margin-left', description: 'Sets left margin' },
    'p': { property: 'padding', description: 'Sets padding on all sides' },
    'pt': { property: 'padding-top', description: 'Sets top padding' },
    'pr': { property: 'padding-right', description: 'Sets right padding' },
    'pb': { property: 'padding-bottom', description: 'Sets bottom padding' },
    'pl': { property: 'padding-left', description: 'Sets left padding' },
    'mx': { property: 'margin-left/right', description: 'Sets horizontal margins' },
    'my': { property: 'margin-top/bottom', description: 'Sets vertical margins' },
    'px': { property: 'padding-left/right', description: 'Sets horizontal padding' },
    'py': { property: 'padding-top/bottom', description: 'Sets vertical padding' },
    'd': { property: 'display', description: 'Sets display property' },
    'pos': { property: 'position', description: 'Sets position property' },
    'w': { property: 'width', description: 'Sets width' },
    'h': { property: 'height', description: 'Sets height' },
    'bg': { property: 'background', description: 'Sets background color/image' },
    'c': { property: 'color', description: 'Sets text color' },
    'fs': { property: 'font-size', description: 'Sets font size' },
    'fw': { property: 'font-weight', description: 'Sets font weight' },
    'flex': { property: 'display: flex', description: 'Creates a flex container' },
    'grid': { property: 'display: grid', description: 'Creates a grid container' }
  };
  
  const match = shorthandMap[shorthand];
  if (match) {
    return {
      suggestion: match.property,
      explanation: match.description
    };
  }
  
  // Try fuzzy match
  const matches = findBestMatches(shorthand, Object.keys(shorthandMap), 1, 2);
  if (matches.length > 0) {
    const best = matches[0];
    const matchInfo = shorthandMap[best.name];
    if (matchInfo) {
      return {
        suggestion: `${best.name} → ${matchInfo.property}`,
        explanation: matchInfo.description
      };
    }
  }
  
  return null;
}

// Validate and suggest fix for CSS value
export function getValueSuggestion(
  property: string,
  value: string
): { suggested: string; confidence: number } | null {
  // Common value corrections
  const corrections: Record<string, Record<string, string>> = {
    'display': {
      'flexbox': 'flex',
      'inline-flexbox': 'inline-flex',
      'gridbox': 'grid',
      'block-level': 'block',
      'inline-level': 'inline'
    },
    'position': {
      'static': 'static',
      'relative': 'relative',
      'absolute': 'absolute',
      'fixed': 'fixed',
      'sticky': 'sticky'
    },
    'text-align': {
      'center': 'center',
      'left': 'left',
      'right': 'right',
      'justify': 'justify'
    }
  };
  
  const propertyCorrections = corrections[property];
  if (propertyCorrections) {
    const lowerValue = value.toLowerCase();
    for (const [wrong, correct] of Object.entries(propertyCorrections)) {
      if (lowerValue === wrong) {
        return { suggested: correct, confidence: 0.95 };
      }
      if (lowerValue.includes(wrong)) {
        return { suggested: correct, confidence: 0.7 };
      }
    }
  }
  
  return null;
}

// Get all available suggestions for autocomplete
export function getAutocompleteSuggestions(prefix: string = '', limit: number = 10): SuggestionMatch[] {
  const allSuggestions = [
    ...KNOWN_SHORTHANDS.map(s => ({ name: s, type: 'shorthand' as const, distance: 0 })),
    ...KNOWN_MACROS.map(s => ({ name: s, type: 'macro' as const, distance: 0 })),
    ...COMMON_CSS_PROPERTIES.map(s => ({ name: s, type: 'css-property' as const, distance: 0 })),
    ...ANIMATION_PRESETS.map(s => ({ name: s, type: 'animation' as const, distance: 0 })),
    ...BREAKPOINTS.map(s => ({ name: s, type: 'breakpoint' as const, distance: 0 }))
  ];
  
  if (!prefix) {
    return allSuggestions.slice(0, limit);
  }
  
  const lowerPrefix = prefix.toLowerCase();
  const matches = allSuggestions
    .filter(s => s.name.toLowerCase().startsWith(lowerPrefix))
    .slice(0, limit);
  
  if (matches.length < limit) {
    // Also include fuzzy matches
    const fuzzyMatches = findBestMatches(prefix, allSuggestions.map(s => s.name), limit - matches.length);
    for (const match of fuzzyMatches) {
      if (!matches.some(m => m.name === match.name)) {
        matches.push(match as any);
      }
    }
  }
  
  return matches;
}

// Format suggestion for console output
export function formatSuggestion(suggestion: SuggestionMatch): string {
  const typeColors: Record<string, string> = {
    'shorthand': '🟢',
    'css-property': '🔵',
    'macro': '🟣',
    'animation': '🎬',
    'breakpoint': '📱'
  };
  
  const icon = typeColors[suggestion.type] || '⚪';
  return `${icon} ${suggestion.name} (${suggestion.type}, distance: ${suggestion.distance})`;
}

// Get suggestion with full details
export function getDetailedSuggestion(prop: string, validProperties: string[] = []): {
  suggestion: string | null;
  alternatives: SuggestionMatch[];
  type: string;
  confidence: number;
} | null {
  const suggestion = getSuggestion(prop, validProperties);
  
  if (!suggestion) {
    return null;
  }
  
  const match = typeof suggestion === 'object' ? suggestion : { name: suggestion, distance: 1, type: getTypeForCandidate(suggestion) };
  const confidence = 1 - (match.distance / Math.max(prop.length, match.name.length));
  
  return {
    suggestion: match.name,
    alternatives: getSuggestions(prop, validProperties, 3),
    type: match.type,
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

// Export default
export default {
  KNOWN_MACROS,
  getSuggestion,
  getSuggestions,
  getPropertySuggestion,
  getShorthandSuggestion,
  getValueSuggestion,
  getAutocompleteSuggestions,
  formatSuggestion,
  getDetailedSuggestion,
  KNOWN_SHORTHANDS,
  COMMON_CSS_PROPERTIES,
  ANIMATION_PRESETS,
  BREAKPOINTS
};