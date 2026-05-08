// src/compiler/semantic-tokens.ts
/**
 * Semantic Token System
 * 
 * Intent-based styling that maps semantic concepts to design tokens.
 * Wraps the existing token system — both coexist.
 * 
 * @example
 *   chain.surface('interactive')  // → maps to background, color, border-radius
 *   chain.text('primary')         // → maps to color, font-weight
 *   chain.elevation('floating')   // → maps to box-shadow, z-index
 *   chain.state('hover')          // → maps to hover pseudo-class
 *   chain.spacing('comfortable')  // → maps to padding
 */

import type { StyleIR, IRRule, IRPass } from './style-ir.js';
import { createDeclaration } from './style-ir.js';

// ============================================================================
// Types
// ============================================================================

export type SurfaceIntent = 'interactive' | 'container' | 'overlay' | 'sheet' | 'tooltip' | 'input';
export type TextIntent = 'primary' | 'secondary' | 'muted' | 'link' | 'inverse' | 'code';
export type ElevationIntent = 'flat' | 'raised' | 'floating' | 'sticky' | 'overlay' | 'modal';
export type StateIntent = 'hover' | 'active' | 'focus' | 'disabled' | 'loading' | 'selected';
export type SpacingIntent = 'none' | 'tight' | 'compact' | 'comfortable' | 'spacious' | 'generous';

export interface SemanticMapping {
  properties: Record<string, string | number>;
  pseudoClass?: string;
  description: string;
}

export interface ThemeContext {
  mode: 'light' | 'dark' | 'high-contrast';
  brand?: Record<string, string>;
  containerContext?: 'light' | 'dark';
}

// ============================================================================
// Default Theme Map (light theme)
// ============================================================================

const DEFAULT_THEME: Record<string, Record<string, SemanticMapping>> = {
  // --- SURFACES ---
  surface: {
    interactive: {
      properties: {
        backgroundColor: '$colors.primary.500',
        color: '$colors.white',
        borderRadius: '$radii.md',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      description: 'Clickable surface — buttons, CTAs, links',
    },
    container: {
      properties: {
        backgroundColor: '$colors.neutral.100',
        color: '$colors.neutral.900',
        borderRadius: '$radii.lg',
        border: '1px solid $colors.neutral.200',
      },
      description: 'Content container — cards, sections, panels',
    },
    overlay: {
      properties: {
        backgroundColor: '$colors.white',
        color: '$colors.neutral.900',
        borderRadius: '$radii.xl',
        boxShadow: '$shadows.xl',
        zIndex: '50',
      },
      description: 'Modal overlay — dialogs, drawers',
    },
    sheet: {
      properties: {
        backgroundColor: '$colors.neutral.50',
        color: '$colors.neutral.800',
        borderRadius: '$radii.lg $radii.lg 0 0',
        boxShadow: '$shadows.lg',
      },
      description: 'Bottom sheet — mobile menus, action sheets',
    },
    tooltip: {
      properties: {
        backgroundColor: '$colors.neutral.900',
        color: '$colors.white',
        borderRadius: '$radii.sm',
        padding: '4px 8px',
        fontSize: '12px',
        boxShadow: '$shadows.md',
      },
      description: 'Tooltip — hover information popups',
    },
    input: {
      properties: {
        backgroundColor: '$colors.white',
        color: '$colors.neutral.900',
        borderRadius: '$radii.md',
        border: '1px solid $colors.neutral.300',
        padding: '8px 12px',
      },
      description: 'Input field — text inputs, selects, textareas',
    },
  },

  // --- TEXT ---
  text: {
    primary: {
      properties: {
        color: '$colors.neutral.900',
        fontWeight: '400',
      },
      description: 'Primary body text — main content',
    },
    secondary: {
      properties: {
        color: '$colors.neutral.600',
        fontWeight: '400',
      },
      description: 'Secondary text — descriptions, captions',
    },
    muted: {
      properties: {
        color: '$colors.neutral.400',
        fontSize: '14px',
        fontWeight: '400',
      },
      description: 'Muted text — placeholders, hints, meta info',
    },
    link: {
      properties: {
        color: '$colors.primary.500',
        fontWeight: '500',
        textDecoration: 'underline',
        cursor: 'pointer',
      },
      description: 'Link text — hyperlinks, navigational text',
    },
    inverse: {
      properties: {
        color: '$colors.white',
        fontWeight: '500',
      },
      description: 'Inverse text — text on dark backgrounds',
    },
    code: {
      properties: {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '$colors.neutral.800',
        backgroundColor: '$colors.neutral.100',
        borderRadius: '$radii.sm',
        padding: '2px 6px',
      },
      description: 'Code text — inline code, code blocks',
    },
  },

  // --- ELEVATION ---
  elevation: {
    flat: {
      properties: {
        boxShadow: 'none',
        zIndex: '0',
      },
      description: 'Flat — no elevation, base level',
    },
    raised: {
      properties: {
        boxShadow: '$shadows.sm',
        zIndex: '10',
      },
      description: 'Raised — subtle lift, cards on light backgrounds',
    },
    floating: {
      properties: {
        boxShadow: '$shadows.md',
        zIndex: '20',
      },
      description: 'Floating — dropdowns, popovers',
    },
    sticky: {
      properties: {
        boxShadow: '$shadows.md',
        zIndex: '30',
        position: 'sticky',
        top: '0',
      },
      description: 'Sticky — sticky headers, persistent nav',
    },
    overlay: {
      properties: {
        boxShadow: '$shadows.xl',
        zIndex: '50',
        position: 'fixed',
      },
      description: 'Overlay — modals, dialogs',
    },
    modal: {
      properties: {
        boxShadow: '$shadows.2xl',
        zIndex: '100',
        position: 'fixed',
        backdropFilter: 'blur(4px)',
      },
      description: 'Modal — full-screen overlay with backdrop',
    },
  },

  // --- STATES ---
  state: {
    hover: {
      properties: {
        filter: 'brightness(1.1)',
        transition: 'filter 0.2s ease',
      },
      pseudoClass: 'hover',
      description: 'Hover state — slight brightening',
    },
    active: {
      properties: {
        filter: 'brightness(0.95)',
        transform: 'scale(0.98)',
        transition: 'all 0.1s ease',
      },
      pseudoClass: 'active',
      description: 'Active/pressed state — slight darkening + press',
    },
    focus: {
      properties: {
        outline: '2px solid $colors.primary.500',
        outlineOffset: '2px',
      },
      pseudoClass: 'focus-visible',
      description: 'Focus state — accessible focus ring',
    },
    disabled: {
      properties: {
        opacity: '0.5',
        cursor: 'not-allowed',
        pointerEvents: 'none',
      },
      pseudoClass: 'disabled',
      description: 'Disabled state — reduced opacity, no interaction',
    },
    loading: {
      properties: {
        cursor: 'wait',
        opacity: '0.7',
        pointerEvents: 'none',
      },
      description: 'Loading state — waiting cursor, partially transparent',
    },
    selected: {
      properties: {
        backgroundColor: '$colors.primary.50',
        color: '$colors.primary.700',
        fontWeight: '600',
      },
      pseudoClass: 'selected',
      description: 'Selected state — highlighted background',
    },
  },

  // --- SPACING ---
  spacing: {
    none: {
      properties: { padding: '0', gap: '0' },
      description: 'No spacing',
    },
    tight: {
      properties: { padding: '4px 8px', gap: '4px' },
      description: 'Tight spacing — icon buttons, chips, badges',
    },
    compact: {
      properties: { padding: '8px 12px', gap: '8px' },
      description: 'Compact spacing — dense lists, toolbars',
    },
    comfortable: {
      properties: { padding: '12px 16px', gap: '12px' },
      description: 'Comfortable spacing — form fields, cards (default)',
    },
    spacious: {
      properties: { padding: '24px 32px', gap: '24px' },
      description: 'Spacious spacing — hero sections, feature cards',
    },
    generous: {
      properties: { padding: '48px 64px', gap: '32px' },
      description: 'Generous spacing — landing pages, large sections',
    },
  },
};

// ============================================================================
// Dark Theme Overrides
// ============================================================================

const DARK_OVERRIDES: Record<string, Record<string, Partial<Record<string, string | number>>>> = {
  surface: {
    interactive: { backgroundColor: '$colors.primary.400', color: '$colors.white' },
    container: { backgroundColor: '$colors.neutral.800', color: '$colors.neutral.100', border: '1px solid $colors.neutral.700' },
    overlay: { backgroundColor: '$colors.neutral.850', color: '$colors.neutral.100' },
    sheet: { backgroundColor: '$colors.neutral.800', color: '$colors.neutral.100' },
    input: { backgroundColor: '$colors.neutral.800', color: '$colors.neutral.100', border: '1px solid $colors.neutral.600' },
  },
  text: {
    primary: { color: '$colors.neutral.100' },
    secondary: { color: '$colors.neutral.400' },
    muted: { color: '$colors.neutral.500' },
    inverse: { color: '$colors.neutral.900' },
    code: { backgroundColor: '$colors.neutral.800', color: '$colors.neutral.200' },
  },
};

// ============================================================================
// High Contrast Overrides
// ============================================================================

const HIGH_CONTRAST_OVERRIDES: Record<string, Record<string, Partial<Record<string, string | number>>>> = {
  surface: {
    interactive: { backgroundColor: '$colors.black', color: '$colors.white', border: '2px solid $colors.white' },
    container: { backgroundColor: '$colors.white', color: '$colors.black', border: '2px solid $colors.black' },
    input: { backgroundColor: '$colors.white', color: '$colors.black', border: '2px solid $colors.black' },
  },
  text: {
    primary: { color: '$colors.black', fontWeight: '500' },
    secondary: { color: '$colors.neutral.800', fontWeight: '500' },
    muted: { color: '$colors.neutral.700' },
    link: { color: '$colors.blue.800', textDecoration: 'underline' },
  },
};

// ============================================================================
// Resolver
// ============================================================================

/**
 * Resolve a semantic intent to concrete CSS properties.
 * Applies theme overrides based on context.
 */
export function resolveSemantic(
  category: 'surface' | 'text' | 'elevation' | 'state' | 'spacing',
  intent: string,
  themeContext: ThemeContext = { mode: 'light' }
): SemanticMapping | null {
  const baseMap = DEFAULT_THEME[category];
  if (!baseMap) return null;

  const mapping = baseMap[intent];
  if (!mapping) return null;

  // Start with base properties
  const properties = { ...mapping.properties };

  // Apply dark overrides
  if (themeContext.mode === 'dark' && DARK_OVERRIDES[category]?.[intent]) {
    Object.assign(properties, DARK_OVERRIDES[category][intent]);
  }

  // Apply high contrast overrides (they take priority)
  if (themeContext.mode === 'high-contrast' && HIGH_CONTRAST_OVERRIDES[category]?.[intent]) {
    Object.assign(properties, HIGH_CONTRAST_OVERRIDES[category][intent]);
  }

  // Container context override (e.g., button inside dark section)
  if (themeContext.containerContext === 'dark' && category === 'surface') {
    // Invert surface colors for dark containers
    if (intent === 'interactive') {
      properties.backgroundColor = '$colors.primary.300';
    }
  }

  return {
    properties,
    pseudoClass: mapping.pseudoClass,
    description: mapping.description,
  };
}

/**
 * Get all available intents for a category.
 */
export function getSemanticIntents(
  category: 'surface' | 'text' | 'elevation' | 'state' | 'spacing'
): string[] {
  const map = DEFAULT_THEME[category];
  return map ? Object.keys(map) : [];
}

/**
 * Get the description of a semantic intent.
 */
export function getSemanticDescription(
  category: 'surface' | 'text' | 'elevation' | 'state' | 'spacing',
  intent: string
): string | null {
  return DEFAULT_THEME[category]?.[intent]?.description || null;
}

// ============================================================================
// IR Pass
// ============================================================================

/**
 * Semantic Token IR pass.
 * Resolves any _semantic metadata on rules into concrete declarations.
 */
export const semanticTokensPass: IRPass = (ir: StyleIR): StyleIR => {
  for (const rule of ir.rules) {
    const semanticIntents: Array<{ category: string; intent: string; theme?: ThemeContext }> =
      rule.meta._semantic || [];

    for (const { category, intent, theme } of semanticIntents) {
      const resolved = resolveSemantic(category as any, intent, theme);
      if (!resolved) continue;

      for (const [prop, value] of Object.entries(resolved.properties)) {
        const decl = createDeclaration(prop, value);
        decl.history.push({
          pass: 'semantic-tokens',
          action: 'resolved-intent',
          timestamp: Date.now(),
          reason: category + ':' + intent + ' → ' + prop + ': ' + value,
        });
        decl.meta.semantic = { category, intent };

        if (resolved.pseudoClass) {
          // Add as pseudo-class
          let pc = rule.pseudoClasses.find(p => p.name === resolved.pseudoClass);
          if (!pc) {
            pc = {
              id: 'semantic-pc-' + Date.now(),
              name: resolved.pseudoClass!,
              declarations: [],
              source: rule.source,
              history: [],
            };
            rule.pseudoClasses.push(pc);
          }
          pc.declarations.push(decl);
        } else {
          rule.declarations.push(decl);
        }
      }
    }
  }

  return ir;
};

// ============================================================================
// Quick API
// ============================================================================

export const semanticTokens = {
  resolve: resolveSemantic,
  getIntents: getSemanticIntents,
  getDescription: getSemanticDescription,
  pass: semanticTokensPass,
  theme: DEFAULT_THEME,
  darkOverrides: DARK_OVERRIDES,
  highContrastOverrides: HIGH_CONTRAST_OVERRIDES,
};

export default semanticTokens;
