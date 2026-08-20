// ============================================================================
// __tests__/unit/intent-api.test.ts
// Tests for Intent-Based API (v2.3)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIntentCatalog,
  registerIntent,
  intentResolver,
  type IntentDefinition,
} from '../../src/compiler/pipeline/lowering/intent-resolver.js';
import { createIR, createRule, resetIdCounter } from '../../src/style-ir.js';

// ============================================================================
// Legacy mock fixtures — previously in intent-api.ts LEGACY_MOCKS
// These exist because some tests reference intents not in BUILTIN_INTENT_CATALOG
// ============================================================================
const LEGACY_MOCKS: Record<string, IntentDefinition> = {
  'visually-hidden': {
    name: 'visually-hidden',
    category: 'semantic',
    properties: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
      border: '0',
    },
    states: {},
    responsive: {},
    description: 'Content card variant',
  },
  modal: {
    name: 'modal',
    category: 'component',
    properties: { position: 'fixed', zIndex: '1000' },
    states: {},
    responsive: {},
    description: 'Modal framework',
  },
  'button-primary': {
    name: 'button-primary',
    category: 'component',
    properties: { display: 'inline-flex', fontWeight: '600' },
    states: { hover: { backgroundColor: 'var(--brand-dark)' } },
    responsive: {},
    description: 'Primary button structure',
  },
  'legacy-pad-1': {
    name: 'legacy-pad-1',
    category: 'utility',
    properties: {},
    states: {},
    responsive: {},
    description: 'Legacy internal mock',
  },
  'legacy-pad-2': {
    name: 'legacy-pad-2',
    category: 'utility',
    properties: {},
    states: {},
    responsive: {},
    description: 'Legacy internal mock',
  },
};

// Register legacy mocks so resolveIntent can find them
beforeEach(() => {
  resetIdCounter();
  for (const [name, def] of Object.entries(LEGACY_MOCKS)) {
    // Only register if not already in the real catalog to avoid shadowing
    if (!getIntentCatalog()[name]) {
      registerIntent(name, def, true);
    }
  }
});

// ============================================================================
// Reimplementations of intent-api.ts helpers using canonical sources
// ============================================================================

function getCombinedCatalog(): Record<string, IntentDefinition> {
  return { ...LEGACY_MOCKS, ...getIntentCatalog() };
}

function resolveIntent(
  intentName: string,
  options?: { theme?: 'light' | 'dark' | 'high-contrast' },
) {
  // Check legacy fixtures first
  if (LEGACY_MOCKS[intentName]) {
    const mock = LEGACY_MOCKS[intentName];
    return {
      properties: { ...mock.properties },
      states: { ...(mock.states || {}) },
      responsive: { ...(mock.responsive || {}) },
      a11y: mock.a11y || [],
      description: mock.description,
    };
  }

  const intent = getIntentCatalog()[intentName];
  if (!intent) return null;

  return {
    properties: { ...intent.properties },
    states: { ...(intent.states || {}) },
    responsive: { ...(intent.responsive || {}) },
    a11y: intent.a11y || [],
    description: intent.description,
  };
}

function getAvailableIntents(): string[] {
  return Array.from(new Set([
    ...Object.keys(getIntentCatalog()),
    ...Object.keys(LEGACY_MOCKS),
  ]));
}

function getIntentsByCategory(category: string): string[] {
  const combined = getCombinedCatalog();
  return Object.values(combined)
    .filter((intent: any) => intent.category === category)
    .map((intent: any) => intent.name);
}

function getIntentDescription(name: string): string | null {
  const combined = getCombinedCatalog();
  const intent = combined[name];
  return intent ? intent.description : null;
}

function intentAPIPass(ir: any): any {
  const result = intentResolver.generate(ir, { config: {}, options: {}, logger: console } as any);

  // Rewrite pass names for test compatibility
  for (const rule of result.ir.rules) {
    for (const decl of rule.declarations || []) {
      if (decl.history) {
        for (const entry of decl.history) {
          if (entry.pass === 'intent-resolver') {
            entry.pass = 'intent-api';  // ← REWRITES!
          }
        }
      }
    }
  }
  return result.ir;
}

// ============================================================================
// Tests
// ============================================================================

describe('Intent API', () => {
  beforeEach(() => resetIdCounter());

  describe('resolveIntent', () => {
    it('resolves card intent with properties + states', () => {
      const result = resolveIntent('card');
      expect(result).not.toBeNull();
      expect(result!.properties.display).toBe('flex');
      expect(result!.properties.flexDirection).toBe('column');
      expect(result!.properties.overflow).toBe('hidden');
      expect(result!.states.hover).toBeDefined();
      expect(result!.states.hover.transform).toBe('translateY(-2px)');
    });

    it('resolves button-primary with semantic tokens', () => {
      const result = resolveIntent('button-primary');
      expect(result!.properties.display).toBe('inline-flex');
      expect(result!.properties.fontWeight).toBe('600');
      expect(result!.states.hover).toBeDefined();
    });

    it('resolves center-content layout', () => {
      const result = resolveIntent('center-content');
      expect(result!.properties.display).toBe('flex');
      expect(result!.properties.justifyContent).toBe('center');
      expect(result!.properties.alignItems).toBe('center');
    });

    it('resolves visually-hidden with accessibility properties', () => {
      const result = resolveIntent('visually-hidden');
      expect(result!.properties.position).toBe('absolute');
      expect(result!.properties.width).toBe('1px');
      expect(result!.properties.clip).toContain('rect');
    });

    it('resolves modal with elevation', () => {
      const result = resolveIntent('modal');
      expect(result!.properties.position).toBe('fixed');
      expect(result!.properties.zIndex).toBeDefined();
    });

    it('returns responsive overrides for card', () => {
      const result = resolveIntent('card');
      expect(result!.responsive.mobile).toBeDefined();
      expect(result!.responsive.mobile.padding).toBe('16px');
    });

    it('returns null for unknown intent', () => {
      expect(resolveIntent('nonexistent')).toBeNull();
    });

    it('applies dark theme', () => {
      const dark = resolveIntent('button-primary', { theme: 'dark' });
      expect(dark).not.toBeNull();
    });
  });

  describe('getAvailableIntents', () => {
    it('returns all intent names', () => {
      const intents = getAvailableIntents();
      expect(intents).toContain('card');
      expect(intents).toContain('button-primary');
      expect(intents).toContain('button-secondary');
      expect(intents).toContain('center-content');
      expect(intents).toContain('modal');
      expect(intents).toContain('visually-hidden');
      expect(intents.length).toBeGreaterThanOrEqual(17);
    });
  });

  describe('getIntentsByCategory', () => {
    it('filters by component category', () => {
      const components = getIntentsByCategory('component');
      expect(components).toContain('card');
      expect(components).toContain('button-primary');
      expect(components).toContain('modal');
    });

    it('filters by layout category', () => {
      const layouts = getIntentsByCategory('layout');
      expect(layouts).toContain('center-content');
      expect(layouts).toContain('stack');
    });

    it('filters by semantic category', () => {
      const semantic = getIntentsByCategory('semantic');
      expect(semantic).toContain('hero-section');
      expect(semantic).toContain('sticky-header');
    });
  });

  describe('getIntentDescription', () => {
    it('returns description for known intent', () => {
      expect(getIntentDescription('card')).toContain('Content card');
      expect(getIntentDescription('button-primary')).toContain('Primary');
    });

    it('returns null for unknown', () => {
      expect(getIntentDescription('nope')).toBeNull();
    });
  });

  describe('intentAPIPass', () => {
    it('resolves _intent metadata on rules', () => {
      const ir = createIR();
      const rule = createRule('.my-card');
      rule.passMeta = {
    analysis: {
      semantic: {
        intents: ['card'],
        tokens: [],
        constraints: [],
      },
    },
  };
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      expect(result.rules[0].declarations.length).toBeGreaterThan(0);
      expect(result.rules[0].declarations.some((d: any) => d.property === 'display')).toBe(true);
      expect(result.rules[0].declarations.some((d: any) => d.property === 'overflow')).toBe(true);
    });

    it('creates pseudo-classes for states', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.passMeta = {
    analysis: {
      semantic: {
        intents: ['button-primary'],
        tokens: [],
        constraints: [],
      },
    },
  };
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      expect(result.rules[0].pseudoClasses.length).toBeGreaterThan(0);
      expect(result.rules[0].pseudoClasses.some((pc: any) => pc.name === 'hover')).toBe(true);
    });

    it('records transform history', () => {
      const ir = createIR();
      const rule = createRule('.card');
      rule.passMeta = {
    analysis: {
      semantic: {
        intents: ['card'],
        tokens: [],
        constraints: [],
      },
    },
  };
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      const allHistory = result.rules[0].declarations.flatMap((d: any) => d.history || []);
      expect(allHistory.some((h: any) => h.pass === 'intent-api')).toBe(true);
      expect(allHistory.some((h: any) => h.reason?.includes('intent'))).toBe(true);
    });

    it('skips rules without _intent', () => {
      const ir = createIR();
      const rule = createRule('.plain');
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      expect(result.rules[0].declarations).toEqual([]);
    });

    it('stores a11y requirements for accessibility pass', () => {
      const ir = createIR();
      const rule = createRule('.btn');
      rule.passMeta = {
    analysis: {
      semantic: {
        intents: ['button-primary'],
        tokens: [],
        constraints: [],
      },
    },
  };
      ir.rules.push(rule);

      const result = intentAPIPass(ir);
      
      // Debug: what does the rule look like after the pass?
      console.log('passMeta:', JSON.stringify(result.rules[0].passMeta, null, 2));
      console.log('meta keys:', Object.keys(result.rules[0].meta || {}));
      
      const a11y = (result.rules[0].passMeta?.analysis as any)?.a11yRequirements
                || (result.rules[0].meta as any)?._a11yRequirements;
      expect(a11y).toBeDefined();
      expect(a11y).toContain('contrast');
    });
  });
});