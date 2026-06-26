// benchmarks/scenarios.ts
export const SCENARIOS = {
  // Real-world component scales
  COMPONENT_COUNTS: [1, 10, 100, 1000, 5000],
  
  // CSS complexity levels
  COMPLEXITY: {
    SIMPLE: 'simple',     // Single class, few properties
    MODERATE: 'moderate', // Multiple classes, pseudo-selectors, media queries
    COMPLEX: 'complex',   // Theming, variants, container queries, keyframes
    EXTREME: 'extreme',   // Large design system with all features
  },
  
  // File organization patterns
  FILE_PATTERNS: {
    MONOLITH: 'monolith',     // Single large file
    CO_LOCATED: 'co-located', // Styles next to components
    SEPARATE: 'separate',     // Separate styles directory
  }
};