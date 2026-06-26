// benchmarks/comparable-scenarios.ts
// These ensure we're testing equivalent features
export const COMPARABLE_SCENARIOS = {
  componentLibrary: {
    name: 'Component Library (100 components)',
    fileCount: 100,
    totalRules: 2500,
    features: ['variants', 'theming', 'media-queries', 'pseudo-states'],
  },
  
  designSystem: {
    name: 'Design System (500 components)',
    fileCount: 500,
    totalRules: 15000,
    features: ['variants', 'theming', 'design-tokens', 'container-queries', 'keyframes'],
  },
  
  largeApp: {
    name: 'Large Application (2000+ components)',
    fileCount: 2000,
    totalRules: 50000,
    features: ['all'],
  },
  
  incrementalUpdate: {
    name: 'Incremental Update (1 file changed)',
    fileCount: 1000,
    changeCount: 1,
    features: ['variants', 'theming'],
  },
};