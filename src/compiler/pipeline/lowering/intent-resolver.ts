// src/compiler/generators/intent-resolver.ts

import type { StyleIR, IRRule } from '../../style-ir.js';
import type { LoweringPass, LoweringResult, LoweringContext } from '../pipeline-types.js';
import { createDeclaration } from '../../style-ir.js';
import { resolveSemantic } from '../../legacy/semantic-tokens.js';

// ============================================================================
// Intent Catalog (unchanged - this is the knowledge base)
// ============================================================================

interface IntentDefinition {
  name: string;
  category: 'layout' | 'component' | 'semantic' | 'interaction';
  description: string;
  semantics?: Array<{ category: string; intent: string }>;
  properties?: Record<string, string | number>;
  states?: Record<string, Record<string, string | number>>;
  responsive?: Record<string, Record<string, string | number>>;
  a11y?: string[];
}

const INTENT_CATALOG: Record<string, IntentDefinition> = {
  // ==========================================================================
  // LAYOUT INTENTS
  // ==========================================================================
  'center-content': {
    name: 'center-content',
    category: 'layout',
    description: 'Center content both horizontally and vertically',
    semantics: [
      { category: 'surface', intent: 'container' },
    ],
    properties: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
  },
  'stack': {
    name: 'stack',
    category: 'layout',
    description: 'Vertical stack with consistent spacing',
    properties: {
      display: 'flex',
      flexDirection: 'column',
    },
    semantics: [
      { category: 'spacing', intent: 'comfortable' },
    ],
  },
  'sidebar-layout': {
    name: 'sidebar-layout',
    category: 'layout',
    description: 'Two-column layout with mobile collapse',
    properties: {
      display: 'grid',
      gridTemplateColumns: '280px 1fr',
      minHeight: '100vh',
    },
    semantics: [
      { category: 'spacing', intent: 'comfortable' },
    ],
    responsive: {
      'mobile': { gridTemplateColumns: '1fr' },
    },
  },
  'grid-list': {
    name: 'grid-list',
    category: 'layout',
    description: 'Responsive auto-fit grid',
    properties: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    },
    semantics: [
      { category: 'spacing', intent: 'comfortable' },
    ],
  },

  // ==========================================================================
  // COMPONENT INTENTS
  // ==========================================================================
  'card': {
    name: 'card',
    category: 'component',
    description: 'Content card with shadow, radius, and hover lift',
    semantics: [
      { category: 'surface', intent: 'container' },
      { category: 'elevation', intent: 'raised' },
      { category: 'spacing', intent: 'comfortable' },
    ],
    properties: {
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    },
    states: {
      hover: {
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        transform: 'translateY(-2px)',
      },
    },
    responsive: {
      'mobile': { padding: '16px' },
    },
    a11y: ['contrast', 'focus-visible'],
  },
  'button-primary': {
    name: 'button-primary',
    category: 'component',
    description: 'Primary call-to-action button',
    semantics: [
      { category: 'surface', intent: 'interactive' },
      { category: 'spacing', intent: 'compact' },
      { category: 'state', intent: 'hover' },
      { category: 'state', intent: 'focus' },
      { category: 'state', intent: 'active' },
      { category: 'state', intent: 'disabled' },
    ],
    properties: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '600',
      border: 'none',
      userSelect: 'none',
    },
    a11y: ['contrast', 'touch-target', 'focus-visible'],
  },
  'button-secondary': {
    name: 'button-secondary',
    category: 'component',
    description: 'Secondary outlined button',
    semantics: [
      { category: 'spacing', intent: 'compact' },
      { category: 'state', intent: 'focus' },
      { category: 'state', intent: 'disabled' },
    ],
    properties: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '500',
      backgroundColor: 'transparent',
      border: '1px solid $colors.neutral.300',
      color: '$colors.neutral.700',
      userSelect: 'none',
    },
    states: {
      hover: { backgroundColor: '$colors.neutral.50' },
    },
    a11y: ['contrast', 'touch-target', 'focus-visible'],
  },
  'input-field': {
    name: 'input-field',
    category: 'component',
    description: 'Text input with focus and error states',
    semantics: [
      { category: 'surface', intent: 'input' },
      { category: 'spacing', intent: 'compact' },
      { category: 'state', intent: 'focus' },
      { category: 'state', intent: 'disabled' },
    ],
    properties: {
      width: '100%',
      fontSize: '16px',
      lineHeight: '1.5',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    },
    a11y: ['contrast'],
  },
  'modal': {
    name: 'modal',
    category: 'component',
    description: 'Modal dialog with overlay backdrop',
    semantics: [
      { category: 'surface', intent: 'overlay' },
      { category: 'elevation', intent: 'modal' },
      { category: 'spacing', intent: 'spacious' },
    ],
    properties: {
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '560px',
      margin: 'auto',
    },
    a11y: ['contrast', 'focus-visible'],
  },
  'tooltip': {
    name: 'tooltip',
    category: 'component',
    description: 'Hover tooltip',
    semantics: [
      { category: 'surface', intent: 'tooltip' },
    ],
    properties: {
      position: 'absolute',
      zIndex: '50',
      pointerEvents: 'none',
    },
    a11y: ['contrast'],
  },

  // ==========================================================================
  // SEMANTIC INTENTS
  // ==========================================================================
  'hero-section': {
    name: 'hero-section',
    category: 'semantic',
    description: 'Full-width hero banner',
    semantics: [
      { category: 'spacing', intent: 'generous' },
    ],
    properties: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      minHeight: '60vh',
      textAlign: 'center',
    },
    responsive: {
      'mobile': { minHeight: '40vh', padding: '32px 16px' },
    },
  },
  'sticky-header': {
    name: 'sticky-header',
    category: 'semantic',
    description: 'Sticky header with backdrop blur',
    semantics: [
      { category: 'elevation', intent: 'sticky' },
      { category: 'spacing', intent: 'compact' },
    ],
    properties: {
      backgroundColor: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid rgba(0,0,0,0.05)',
    },
  },
  'call-to-action': {
    name: 'call-to-action',
    category: 'semantic',
    description: 'Attention-grabbing CTA section',
    semantics: [
      { category: 'surface', intent: 'interactive' },
      { category: 'spacing', intent: 'spacious' },
    ],
    properties: {
      textAlign: 'center',
    },
  },
  'muted-text': {
    name: 'muted-text',
    category: 'semantic',
    description: 'Secondary, less prominent text',
    semantics: [
      { category: 'text', intent: 'muted' },
    ],
  },
  'visually-hidden': {
    name: 'visually-hidden',
    category: 'semantic',
    description: 'Visible only to screen readers',
    properties: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: '0',
    },
  },

  // ==========================================================================
  // INTERACTION INTENTS
  // ==========================================================================
  'hover-lift': {
    name: 'hover-lift',
    category: 'interaction',
    description: 'Subtle lift on hover',
    states: {
      hover: {
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
        transition: 'all 0.2s ease',
      },
    },
    a11y: ['focus-visible'],
  },
  'focus-ring': {
    name: 'focus-ring',
    category: 'interaction',
    description: 'Accessible focus indicator',
    states: {
      'focus-visible': {
        outline: '2px solid $colors.primary.500',
        outlineOffset: '2px',
      },
    },
  },
};

// ============================================================================
// Intent Resolver (pure function - no IR mutation)
// ============================================================================

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

  // Resolve semantic tokens
  if (intent.semantics) {
    for (const sem of intent.semantics) {
      const resolved = resolveSemantic(sem.category as any, sem.intent, {
        mode: theme || 'light',
      });
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

  // Apply direct properties
  if (intent.properties) Object.assign(properties, intent.properties);
  
  // Apply states
  if (intent.states) {
    for (const [state, props] of Object.entries(intent.states)) {
      if (!states[state]) states[state] = {};
      Object.assign(states[state], props);
    }
  }

  // Apply responsive overrides
  if (intent.responsive) Object.assign(responsive, intent.responsive);

  return {
    properties,
    states,
    responsive,
    a11y: intent.a11y || [],
    description: intent.description,
  };
}

// ============================================================================
// Generation Pass
// ============================================================================

export const intentResolver: LoweringPass = {
  name: 'intent-resolver',
  
  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    let generatedNodes = 0;

    for (const rule of ir.rules) {
      const intentName: string = rule.meta._intent;
      if (!intentName) continue;

      const resolved = resolveIntent(intentName);
      if (!resolved) continue;

      // Lower properties to declarations using factory
      for (const [prop, value] of Object.entries(resolved.properties)) {
        rule.declarations.push(
          createDeclaration(prop, value, rule.source, { 
            intent: intentName,
            category: 'lowered-intent',
          })
        );
        // Add history entry
        const decl = rule.declarations[rule.declarations.length - 1];
        decl.history.push({
          pass: 'intent-resolver',
          action: 'lowered-intent',
          timestamp: Date.now(),
          reason: `intent("${intentName}") → ${prop}: ${value}`,
        });
        generatedNodes++;
      }

      // Lower states to pseudo-classes
      for (const [stateName, stateProps] of Object.entries(resolved.states)) {
        rule.pseudoClasses.push({
          id: `intent-state-${rule.id}-${stateName}`,
          name: stateName,
          declarations: Object.entries(stateProps).map(([prop, value]) => {
            const decl = createDeclaration(prop, value, rule.source, { intent: intentName });
            decl.history.push({
              pass: 'intent-resolver',
              action: 'lowered-state',
              timestamp: Date.now(),
              reason: `intent("${intentName}") state:${stateName}`,
            });
            generatedNodes++;
            return decl;
          }),
          source: rule.source,
          history: [{
            pass: 'intent-resolver',
            action: 'created-pseudo-class',
            timestamp: Date.now(),
            reason: `Lowered intent state: ${stateName}`,
          }],
        });
      }

      // Store responsive info for responsive-analyzer (metadata, not mutation)
      if (Object.keys(resolved.responsive).length > 0) {
        rule.meta._responsiveIntents = resolved.responsive;
      }

      // Store a11y requirements for accessibility-optimizer
      if (resolved.a11y.length > 0) {
        rule.meta._a11yRequirements = resolved.a11y;
      }
    }

    return {
      ir,
      generatedNodes,
    };
  },
};