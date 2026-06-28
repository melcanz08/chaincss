// src/compiler/pipeline/normalizers/layout-macros.ts
//
// Layout macros — high-level semantic intents that compile complex
// multi-property layouts from simple intent names.
// Extracted from intent-detector.ts for separation of concerns.

// ============================================================================
// Types
// ============================================================================

export interface LayoutMacro {
  name: string;
  description: string;
  properties: Record<string, string | number>;
  defaults?: Record<string, string | number>;
  mediaQueries?: Record<string, Record<string, any>>;
}

// ============================================================================
// Macro Definitions
// ============================================================================

export const LAYOUT_MACROS: Record<string, LayoutMacro> = {
  stickyHeader: {
    name: 'stickyHeader',
    description: 'Sticky header with scroll shadow and entrance animation',
    properties: {
      position: 'sticky',
      top: '0',
      zIndex: '50',
      backgroundColor: 'var(--header-bg, white)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid transparent',
    },
    defaults: {
      '--header-bg': 'white',
      '--header-shadow': '0 4px 12px rgba(0,0,0,0.1)',
    },
    mediaQueries: {
      '(max-width: 768px)': {
        padding: '12px 16px',
      },
      '(min-width: 769px)': {
        padding: '16px 32px',
      },
    },
  },

  card: {
    name: 'card',
    description: 'Standard card container with hover lift effect',
    properties: {
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '12px',
      backgroundColor: 'var(--card-bg, white)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      overflow: 'hidden',
    },
    defaults: {
      '--card-bg': 'white',
      '--card-hover-shadow': '0 10px 30px rgba(0,0,0,0.15)',
    },
    mediaQueries: {
      '(hover: hover)': {
        '&:hover': {
          boxShadow: 'var(--card-hover-shadow)',
          transform: 'translateY(-2px)',
        },
      },
    },
  },

  hero: {
    name: 'hero',
    description: 'Full-width hero section with centered content',
    properties: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      minHeight: '60vh',
      padding: '48px 24px',
      textAlign: 'center',
    },
    defaults: {},
    mediaQueries: {
      '(max-width: 768px)': {
        minHeight: '40vh',
        padding: '32px 16px',
      },
    },
  },

  container: {
    name: 'container',
    description: 'Responsive centered container with max-width',
    properties: {
      width: '100%',
      maxWidth: '1200px',
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
    defaults: {},
    mediaQueries: {
      '(min-width: 768px)': {
        paddingLeft: '24px',
        paddingRight: '24px',
      },
      '(min-width: 1024px)': {
        paddingLeft: '32px',
        paddingRight: '32px',
      },
    },
  },

  center: {
    name: 'center',
    description: 'Absolute centering using flexbox',
    properties: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    defaults: {},
  },

  gridList: {
    name: 'gridList',
    description: 'Responsive grid list with auto-fit columns',
    properties: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '24px',
    },
    defaults: {},
    mediaQueries: {
      '(max-width: 640px)': {
        gridTemplateColumns: '1fr',
        gap: '16px',
      },
    },
  },

  sidebar: {
    name: 'sidebar',
    description: 'Two-column layout: sidebar + main content',
    properties: {
      display: 'grid',
      gridTemplateColumns: '280px 1fr',
      gap: '32px',
      minHeight: '100vh',
    },
    defaults: {},
    mediaQueries: {
      '(max-width: 1024px)': {
        gridTemplateColumns: '1fr',
        gap: '24px',
      },
    },
  },

  pill: {
    name: 'pill',
    description: 'Pill-shaped element (fully rounded)',
    properties: {
      borderRadius: '9999px',
      padding: '8px 20px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    defaults: {},
  },

  autoContrast: {
    name: 'autoContrast',
    description: 'Automatically sets text color (black/white) for WCAG AA contrast against the background',
    properties: {},
    defaults: {},
  },

  glass: {
    name: 'glass',
    description: 'Frosted glass morphism effect',
    properties: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '16px',
    },
    defaults: {},
  },

  truncate: {
    name: 'truncate',
    description: 'Single-line text truncation with ellipsis',
    properties: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    defaults: {},
  },

  srOnly: {
    name: 'srOnly',
    description: 'Screen-reader only (visually hidden but accessible)',
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
    defaults: {},
  },
};

// ============================================================================
// Resolvers
// ============================================================================

export function resolveLayoutMacro(name: string): LayoutMacro | null {
  return LAYOUT_MACROS[name] || null;
}

export function expandLayoutMacro(name: string): Record<string, any> | null {
  const macro = resolveLayoutMacro(name);
  if (!macro) return null;

  const result: Record<string, any> = { ...macro.properties };

  if (macro.defaults) {
    Object.assign(result, macro.defaults);
  }

  if (macro.mediaQueries) {
    result.atRules = result.atRules || [];
    for (const [query, props] of Object.entries(macro.mediaQueries)) {
      result.atRules.push({
        type: 'media',
        query,
        styles: props,
      });
    }
  }

  return result;
}

export function getAvailableMacros(): string[] {
  return Object.keys(LAYOUT_MACROS);
}

export function getMacroDescription(name: string): string | null {
  const macro = resolveLayoutMacro(name);
  return macro?.description || null;
}

/**
 * Auto-set text color for accessible contrast against the background.
 * Uses WCAG AA contrast ratio to pick black or white.
 */
export function autoContrast(bgColor: string): string {
  let r = 128, g = 128, b = 128;
  const hex = bgColor.replace('#', '');
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
