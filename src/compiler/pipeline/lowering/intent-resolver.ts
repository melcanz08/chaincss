// src/compiler/pipeline/lowering/intent-resolver.ts 
// Now supports custom intents from chaincss.config.ts via registerIntent

import { recordHistory } from '../ir/utils.js';
import type { StyleIR } from '../ir/types.js';
import type { LoweringPass, LoweringResult, LoweringContext } from '../pipeline-types.js';
import { createDeclaration } from '../ir/factory.js';
import { resolveSemantic } from '../../legacy/semantic-tokens.js';

interface IntentDefinition {
  name: string;
  category: 'layout' | 'component' | 'semantic' | 'interaction' | string;
  description: string;
  semantics?: Array<{ category: string; intent: string }>;
  properties?: Record<string, string | number>;
  states?: Record<string, Record<string, string | number>>;
  responsive?: Record<string, Record<string, string | number>>;
  a11y?: string[];
}

const BUILTIN_INTENT_CATALOG: Record<string, IntentDefinition> = {
  'center-content': {
    name: 'center-content', category: 'layout', description: 'Center content both horizontally and vertically',
    semantics: [{ category: 'surface', intent: 'container' }],
    properties: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
  },
  'stack': {
    name: 'stack', category: 'layout', description: 'Vertical stack with consistent spacing',
    properties: { display: 'flex', flexDirection: 'column' },
    semantics: [{ category: 'spacing', intent: 'comfortable' }],
  },
  'sidebar-layout': {
    name: 'sidebar-layout', category: 'layout', description: 'Two-column layout with mobile collapse',
    properties: { display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: '100vh' },
    semantics: [{ category: 'spacing', intent: 'comfortable' }],
    responsive: { mobile: { gridTemplateColumns: '1fr' } },
  },
  'grid-list': {
    name: 'grid-list', category: 'layout', description: 'Responsive auto-fit grid',
    properties: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' },
    semantics: [{ category: 'spacing', intent: 'comfortable' }],
  },
  'card': {
    name: 'card', category: 'component', description: 'Content card with shadow, radius, and hover lift',
    semantics: [{ category: 'surface', intent: 'container' }, { category: 'elevation', intent: 'raised' }, { category: 'spacing', intent: 'comfortable' }],
    properties: { display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'box-shadow 0.2s ease, transform 0.2s ease' },
    states: { hover: { boxShadow: '0 10px 30px rgba(0,0,0,0.15)', transform: 'translateY(-2px)' } },
    responsive: { mobile: { padding: '16px' } },
    a11y: ['contrast', 'focus-visible'],
  },
  'button-primary': {
    name: 'button-primary', category: 'component', description: 'Primary call-to-action button',
    semantics: [{ category: 'surface', intent: 'interactive' }, { category: 'spacing', intent: 'compact' }, { category: 'state', intent: 'hover' }, { category: 'state', intent: 'focus' }, { category: 'state', intent: 'active' }, { category: 'state', intent: 'disabled' }],
    properties: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', border: 'none', userSelect: 'none' },
    a11y: ['contrast', 'touch-target', 'focus-visible'],
  },
  'button-secondary': {
    name: 'button-secondary', category: 'component', description: 'Secondary outlined button',
    semantics: [{ category: 'spacing', intent: 'compact' }, { category: 'state', intent: 'focus' }, { category: 'state', intent: 'disabled' }],
    properties: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', backgroundColor: 'transparent', border: '1px solid $colors.neutral.300', color: '$colors.neutral.700', userSelect: 'none' },
    states: { hover: { backgroundColor: '$colors.neutral.50' } },
    a11y: ['contrast', 'touch-target', 'focus-visible'],
  },
  'input-field': {
    name: 'input-field', category: 'component', description: 'Text input with focus and error states',
    semantics: [{ category: 'surface', intent: 'input' }, { category: 'spacing', intent: 'compact' }, { category: 'state', intent: 'focus' }, { category: 'state', intent: 'disabled' }],
    properties: { width: '100%', fontSize: '16px', lineHeight: '1.5', transition: 'border-color 0.2s ease, box-shadow 0.2s ease' },
    a11y: ['contrast'],
  },
  'modal': {
    name: 'modal', category: 'component', description: 'Modal dialog with overlay backdrop',
    semantics: [{ category: 'surface', intent: 'overlay' }, { category: 'elevation', intent: 'modal' }, { category: 'spacing', intent: 'spacious' }],
    properties: { display: 'flex', flexDirection: 'column', maxWidth: '560px', margin: 'auto' },
    a11y: ['contrast', 'focus-visible'],
  },
  'tooltip': {
    name: 'tooltip', category: 'component', description: 'Hover tooltip',
    semantics: [{ category: 'surface', intent: 'tooltip' }],
    properties: { position: 'absolute', zIndex: '50', pointerEvents: 'none' },
    a11y: ['contrast'],
  },
  'hero-section': {
    name: 'hero-section', category: 'semantic', description: 'Full-width hero banner',
    semantics: [{ category: 'spacing', intent: 'generous' }],
    properties: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: '60vh', textAlign: 'center' },
    responsive: { mobile: { minHeight: '40vh', padding: '32px 16px' } },
  },
  'sticky-header': {
    name: 'sticky-header', category: 'semantic', description: 'Sticky header with backdrop blur',
    semantics: [{ category: 'elevation', intent: 'sticky' }, { category: 'spacing', intent: 'compact' }],
    properties: { backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(0,0,0,0.05)' },
  },
  'hover-lift': {
    name: 'hover-lift', category: 'interaction', description: 'Subtle lift on hover',
    states: { hover: { transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(0,0,0,0.12)', transition: 'all 0.2s ease' } },
    a11y: ['focus-visible'],
  },
  'focus-ring': {
    name: 'focus-ring', category: 'interaction', description: 'Accessible focus indicator',
    states: { 'focus-visible': { outline: '2px solid $colors.primary.500', outlineOffset: '2px' } },
  },
};

// Mutable catalog that merges builtins + customs
const INTENT_CATALOG: Record<string, IntentDefinition> = { ...BUILTIN_INTENT_CATALOG };

export function registerIntent(name: string, def: IntentDefinition, allowOverride = false) {
  if (!allowOverride && BUILTIN_INTENT_CATALOG[name]) {
    console.warn(`[ChainCSS] intent '${name}' overrides builtin. Use allowOverride:true to silence.`);
  }
  INTENT_CATALOG[name] = {...def,name};
}
export function registerIntents(intents: Record<string, IntentDefinition>, allowOverride = false) {
  for (const [k, v] of Object.entries(intents || {})) registerIntent(k, v, allowOverride);
}
export function resetIntents() {
  for (const k of Object.keys(INTENT_CATALOG)) delete INTENT_CATALOG[k];
  Object.assign(INTENT_CATALOG, BUILTIN_INTENT_CATALOG);
}
export function getIntentCatalog() { return { ...INTENT_CATALOG }; }

interface ResolvedIntent {
  properties: Record<string, string | number>;
  states: Record<string, Record<string, string | number>>;
  responsive: Record<string, Record<string, string | number>>;
  a11y: string[];
  description: string;
}

function resolveIntent(intentName: string, theme?: 'light' | 'dark' | 'high-contrast'): ResolvedIntent | null {
  const intent = INTENT_CATALOG[intentName];
  if (!intent) return null;
  const properties: Record<string, string | number> = {};
  const states: Record<string, Record<string, string | number>> = {};
  const responsive: Record<string, Record<string, string | number>> = {};
  if (intent.semantics) {
    for (const sem of intent.semantics) {
      const resolved = resolveSemantic(sem.category as any, sem.intent, { mode: theme || 'light' });
      if (resolved) {
        for (const [prop, value] of Object.entries(resolved.properties)) {
          if (resolved.pseudoClass) {
            if (!states[resolved.pseudoClass]) states[resolved.pseudoClass] = {};
            states[resolved.pseudoClass][prop] = value;
          } else {
            properties[prop] = value;
          }
        }
      }
    }
  }
  if (intent.properties) Object.assign(properties, intent.properties);
  if (intent.states) for (const [s, p] of Object.entries(intent.states)) { if (!states[s]) states[s] = {}; Object.assign(states[s], p); }
  if (intent.responsive) Object.assign(responsive, intent.responsive);
  return { properties, states, responsive, a11y: intent.a11y || [], description: intent.description };
}

export const intentResolver: LoweringPass = {
  name: 'intent-resolver',
  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    let generatedNodes = 0;
    for (const rule of ir.rules) {
      const intentName: string = (rule.meta as any)._intent as string;
      if (!intentName) continue;
      const resolved = resolveIntent(intentName);
      if (!resolved) continue;
      for (const [prop, value] of Object.entries(resolved.properties)) {
        rule.declarations.push(createDeclaration(prop, value, rule.source, { intent: intentName, category: 'lowered-intent' }));
        const decl = rule.declarations[rule.declarations.length - 1];
        recordHistory(decl, 'intent-resolver', 'lowered-intent', undefined, `intent("${intentName}") → ${prop}: ${value}`);
        generatedNodes++;
      }
      for (const [stateName, stateProps] of Object.entries(resolved.states)) {
        rule.pseudoClasses.push({
          id: `intent-state-${rule.id}-${stateName}`,
          name: stateName,
          declarations: Object.entries(stateProps).map(([prop, value]) => {
            const decl = createDeclaration(prop, value, rule.source, { intent: intentName });
            recordHistory(decl, 'intent-resolver', 'lowered-state', undefined, `intent("${intentName}") state:${stateName}`);
            generatedNodes++;
            return decl;
          }),
          source: rule.source,
          history: [{ pass: 'intent-resolver', action: 'created-pseudo-class', timestamp: Date.now(), reason: `Lowered intent state: ${stateName}` }],
        });
      }
      if (Object.keys(resolved.responsive).length > 0) (rule.meta as any)._responsiveIntents = resolved.responsive;
      if (resolved.a11y.length > 0) (rule.meta as any)._a11yRequirements = resolved.a11y;
    }
    return { ir, generatedNodes };
  },
};
