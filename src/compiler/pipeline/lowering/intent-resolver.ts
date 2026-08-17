// ============================================================================
// FILE: src/compiler/pipeline/lowering/intent-resolver.ts
// ============================================================================

import type { StyleIR } from "../ir/types.js";
import type {
  LoweringPass,
  LoweringResult,
  LoweringContext,
} from "../pipeline-types.js";
import { createDeclaration } from "../ir/index.js";
import { recordHistory } from "../ir/utils.js";
import { resolveSemantic } from "../../tokens/semantic-tokens.js";
import {
  registerSemanticIntents,
  resolveSemanticIntent,
  hasSemanticIntent,
} from "../intent/semantic-intent-registry.js";
import type { SemanticIntentContext } from "../intent/semantic-intent-types.js";
import { setIntentCatalog, addToCatalog } from "../intent/intent-catalog.js";
import type { IntentDefinition } from "../intent/semantic-intent-types.js";
import { validateIntentCombination } from "../intent/intent-validator.js";
import { resolveCompositions } from "../intent/intent-composer.js";

// ============================================================================
// NEW: Property normalization helper (same as parser)
// ============================================================================

const propCache = new Map<string, string>();
const PROP_CACHE_LIMIT = 500;

function normalizeProperty(prop: string): string {
  if (propCache.has(prop)) return propCache.get(prop)!;

  let result: string;
  if (prop.startsWith("--")) {
    result = prop;
  } else if (!/[A-Z]/.test(prop)) {
    result = prop;
  } else {
    const needsLeadingDash = /^[A-Z]/.test(prop) || /^ms[A-Z]/.test(prop);
    const kebabed = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
    result = needsLeadingDash
      ? kebabed.startsWith("-")
        ? kebabed
        : "-" + kebabed
      : kebabed;
  }

  if (propCache.size >= PROP_CACHE_LIMIT) {
    const firstKey = propCache.keys().next().value as string | undefined;
    if (firstKey) propCache.delete(firstKey);
  }
  propCache.set(prop, result);
  return result;
}

const BUILTIN_INTENT_CATALOG: Record<string, IntentDefinition> = {
  "center-content": {
    name: "center-content",
    category: "layout",
    description: "Center content both horizontally and vertically",
    properties: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
  },
  stack: {
    name: "stack",
    category: "layout",
    description: "Vertical stack with consistent spacing",
    properties: { display: "flex", flexDirection: "column" },
    semantics: [{ category: "spacing", intent: "comfortable" }],
  },
  "sidebar-layout": {
    name: "sidebar-layout",
    category: "layout",
    description: "Two-column layout with mobile collapse",
    properties: {
      display: "grid",
      gridTemplateColumns: "280px 1fr",
      minHeight: "100vh",
    },
    semantics: [{ category: "spacing", intent: "comfortable" }],
    responsive: { mobile: { gridTemplateColumns: "1fr" } },
  },
  "grid-list": {
    name: "grid-list",
    category: "layout",
    description: "Responsive auto-fit grid",
    properties: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    },
    semantics: [{ category: "spacing", intent: "comfortable" }],
  },
  card: {
    name: "card",
    category: "component",
    description: "Content card with shadow, radius, and hover lift",
    semantics: [
      { category: "surface", intent: "container" },
      { category: "elevation", intent: "raised" },
      { category: "spacing", intent: "comfortable" },
    ],
    properties: {
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      transition: "box-shadow 0.2s ease, transform 0.2s ease",
    },
    states: {
      hover: {
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        transform: "translateY(-2px)",
      },
    },
    responsive: { mobile: { padding: "16px" } },
    a11y: ["contrast", "focus-visible"],
    themes: {
      dark: {
        properties: {
          backgroundColor: "#1e293b",
          color: "#f1f5f9",
        },
      },
      "high-contrast": {
        properties: {
          backgroundColor: "#000000",
          color: "#ffffff",
        },
      },
    },
    variants: {
      outlined: {
        properties: {
          backgroundColor: "transparent",
          border: "2px solid #6366f1",
        },
      },
      premium: {
        properties: {
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "#ffffff",
        },
      },
    },
  },
  "button-primary": {
    name: "button-primary",
    category: "component",
    description: "Primary call-to-action button",
    semantics: [
      { category: "surface", intent: "interactive" },
      { category: "spacing", intent: "compact" },
      { category: "state", intent: "hover" },
      { category: "state", intent: "focus" },
      { category: "state", intent: "active" },
      { category: "state", intent: "disabled" },
    ],
    properties: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "600",
      border: "none",
      userSelect: "none",
    },
    a11y: ["contrast", "touch-target", "focus-visible"],
    themes: {
      dark: {
        properties: {
          backgroundColor: "#818cf8",
          color: "#1e293b",
        },
      },
    },
  },
  "button-secondary": {
    name: "button-secondary",
    category: "component",
    description: "Secondary outlined button",
    semantics: [
      { category: "spacing", intent: "compact" },
      { category: "state", intent: "focus" },
      { category: "state", intent: "disabled" },
    ],
    properties: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "500",
      backgroundColor: "transparent",
      border: "1px solid $colors.neutral.300",
      color: "$colors.neutral.700",
      userSelect: "none",
    },
    states: { hover: { backgroundColor: "$colors.neutral.50" } },
    a11y: ["contrast", "touch-target", "focus-visible"],
    themes: {
      dark: {
        properties: {
          border: "1px solid #475569",
          color: "#e2e8f0",
        },
        states: {
          hover: { backgroundColor: "#334155" },
        },
      },
    },
  },
  "input-field": {
    name: "input-field",
    category: "component",
    description: "Text input with focus and error states",
    semantics: [
      { category: "surface", intent: "input" },
      { category: "spacing", intent: "compact" },
      { category: "state", intent: "focus" },
      { category: "state", intent: "disabled" },
    ],
    properties: {
      width: "100%",
      fontSize: "16px",
      lineHeight: "1.5",
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    },
    a11y: ["contrast"],
    themes: {
      dark: {
        properties: {
          backgroundColor: "#1e293b",
          color: "#f1f5f9",
          border: "1px solid #475569",
        },
      },
    },
  },
  modal: {
    name: "modal",
    category: "component",
    description: "Modal dialog with overlay backdrop",
    semantics: [
      { category: "surface", intent: "overlay" },
      { category: "elevation", intent: "modal" },
      { category: "spacing", intent: "spacious" },
    ],
    properties: {
      display: "flex",
      flexDirection: "column",
      maxWidth: "560px",
      margin: "auto",
    },
    a11y: ["contrast", "focus-visible"],
    themes: {
      dark: {
        properties: {
          backgroundColor: "#1e293b",
          color: "#f1f5f9",
        },
      },
    },
    variants: {
      fullscreen: {
        properties: {
          maxWidth: "100vw",
          minHeight: "100vh",
          margin: "0",
        },
      },
    },
  },
  tooltip: {
    name: "tooltip",
    category: "component",
    description: "Hover tooltip",
    semantics: [{ category: "surface", intent: "tooltip" }],
    properties: { position: "absolute", zIndex: "50", pointerEvents: "none" },
    a11y: ["contrast"],
  },
  "hero-section": {
    name: "hero-section",
    category: "semantic",
    description: "Full-width hero banner",
    semantics: [{ category: "spacing", intent: "generous" }],
    properties: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      minHeight: "60vh",
      textAlign: "center",
    },
    responsive: { mobile: { minHeight: "40vh", padding: "32px 16px" } },
  },
  "sticky-header": {
    name: "sticky-header",
    category: "semantic",
    description: "Sticky header with backdrop blur",
    semantics: [
      { category: "elevation", intent: "sticky" },
      { category: "spacing", intent: "compact" },
    ],
    properties: {
      backgroundColor: "rgba(255,255,255,0.9)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid rgba(0,0,0,0.05)",
    },
    themes: {
      dark: {
        properties: {
          backgroundColor: "rgba(30,41,59,0.9)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        },
      },
    },
  },
  "hover-lift": {
    name: "hover-lift",
    category: "interaction",
    description: "Subtle lift on hover",
    states: {
      hover: {
        transform: "translateY(-2px)",
        boxShadow: "0 8px 25px rgba(0,0,0,0.12)",
        transition: "all 0.2s ease",
      },
    },
    a11y: ["focus-visible"],
  },
  "focus-ring": {
    name: "focus-ring",
    category: "interaction",
    description: "Accessible focus indicator",
    states: {
      "focus-visible": {
        outline: "2px solid $colors.primary.500",
        outlineOffset: "2px",
      },
    },
  },
  // Visual intents
  glass: {
    name: "glass",
    category: "visual",
    description: "Frosted glassmorphism effect",
    properties: {
      background: "rgba(255,255,255,0.1)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "16px",
    },
    themes: {
      dark: {
        properties: {
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.1)",
        },
      },
    },
  },
  elevated: {
    name: "elevated",
    category: "visual",
    description: "Raised shadow elevation",
    properties: {
      boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
    },
  },
  bordered: {
    name: "bordered",
    category: "visual",
    description: "Visible border",
    properties: {
      border: "1px solid #e5e7eb",
    },
  },
  rounded: {
    name: "rounded",
    category: "visual",
    description: "Rounded corners",
    properties: {
      borderRadius: "8px",
    },
  },
  gradient: {
    name: "gradient",
    category: "visual",
    description: "Subtle gradient background",
    properties: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
  },
  glow: {
    name: "glow",
    category: "visual",
    description: "Glowing effect for dark mode",
    properties: {
      boxShadow: "0 0 20px rgba(102, 126, 234, 0.5), 0 0 40px rgba(102, 126, 234, 0.3)",
    },
  },
  // Spacing intents
  compact: {
    name: "compact",
    category: "spacing",
    description: "Tight padding",
    properties: {
      padding: "8px 12px",
    },
  },
  spacious: {
    name: "spacious",
    category: "spacing",
    description: "Generous padding",
    properties: {
      padding: "24px 32px",
    },
  },
  padded: {
    name: "padded",
    category: "spacing",
    description: "Default padding",
    properties: {
      padding: "16px",
    },
  },
  "margin-auto": {
    name: "margin-auto",
    category: "spacing",
    description: "Centered margin",
    properties: {
      margin: "0 auto",
    },
  },
  // Layout intents
  container: {
    name: "container",
    category: "layout",
    description: "Centered max-width container",
    properties: {
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "0 24px",
    },
  },
  "grid-two-column": {
    name: "grid-two-column",
    category: "layout",
    description: "Two equal columns",
    properties: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
    },
  },
  "flex-row": {
    name: "flex-row",
    category: "layout",
    description: "Simple horizontal flex",
    properties: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "12px",
    },
  },
  "flex-col": {
    name: "flex-col",
    category: "layout",
    description: "Simple vertical flex",
    properties: {
      display: "flex",
      flexDirection: "column",
    },
  },
  "full-width": {
    name: "full-width",
    category: "layout",
    description: "Full width element",
    properties: {
      width: "100%",
    },
  },
  stretch: {
    name: "stretch",
    category: "layout",
    description: "Fill available space",
    properties: {
      flex: "1",
    },
  },
  // Component intents
  badge: {
    name: "badge",
    category: "component",
    description: "Small status label",
    properties: {
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 10px",
      borderRadius: "9999px",
      fontSize: "12px",
      fontWeight: "600",
      lineHeight: "1.5",
    },
    variants: {
      success: {
        properties: {
          backgroundColor: "#48bb78",
          color: "#ffffff",
        },
      },
      danger: {
        properties: {
          backgroundColor: "#f56565",
          color: "#ffffff",
        },
      },
      warning: {
        properties: {
          backgroundColor: "#ed8936",
          color: "#ffffff",
        },
      },
    },
  },
  avatar: {
    name: "avatar",
    category: "component",
    description: "Circular profile image",
    properties: {
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      overflow: "hidden",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
  },
  divider: {
    name: "divider",
    category: "component",
    description: "Horizontal separator",
    properties: {
      borderTop: "1px solid #e5e7eb",
      margin: "12px 0",
    },
  },
  accordion: {
    name: "accordion",
    category: "component",
    description: "Collapsible section",
    properties: {
      borderBottom: "1px solid #e5e7eb",
      padding: "12px 16px",
    },
  },
  tab: {
    name: "tab",
    category: "component",
    description: "Tab navigation item",
    properties: {
      display: "inline-flex",
      alignItems: "center",
      padding: "8px 16px",
      cursor: "pointer",
      borderBottom: "2px solid transparent",
    },
    states: {
      hover: { borderBottomColor: "#6366f1" },
    },
  },
  dropdown: {
    name: "dropdown",
    category: "component",
    description: "Popup menu",
    properties: {
      position: "absolute",
      zIndex: "50",
      minWidth: "160px",
      padding: "8px 0",
      borderRadius: "8px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    },
  },
  banner: {
    name: "banner",
    category: "component",
    description: "Notification banner",
    properties: {
      display: "flex",
      alignItems: "center",
      padding: "12px 16px",
      borderRadius: "8px",
    },
    variants: {
      success: {
        properties: {
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          color: "#15803d",
        },
      },
      danger: {
        properties: {
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
        },
      },
    },
  },
  breadcrumb: {
    name: "breadcrumb",
    category: "component",
    description: "Navigation trail",
    properties: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
    },
  },
  pagination: {
    name: "pagination",
    category: "component",
    description: "Page numbers",
    properties: {
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
  },
  "progress-bar": {
    name: "progress-bar",
    category: "component",
    description: "Loading indicator",
    properties: {
      width: "100%",
      height: "8px",
      borderRadius: "9999px",
      overflow: "hidden",
    },
  },
  skeleton: {
    name: "skeleton",
    category: "component",
    description: "Loading placeholder",
    properties: {
      background: "#e5e7eb",
      borderRadius: "4px",
      animation: "pulse 1.5s ease-in-out infinite",
    },
  },
  toast: {
    name: "toast",
    category: "component",
    description: "Transient notification",
    properties: {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      padding: "12px 16px",
      borderRadius: "8px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
      zIndex: "100",
    },
    variants: {
      success: {
        properties: {
          backgroundColor: "#48bb78",
          color: "#ffffff",
        },
      },
      error: {
        properties: {
          backgroundColor: "#f56565",
          color: "#ffffff",
        },
      },
    },
  },
  drawer: {
    name: "drawer",
    category: "component",
    description: "Side panel",
    properties: {
      position: "fixed",
      top: "0",
      left: "0",
      height: "100vh",
      width: "280px",
      padding: "16px",
      boxShadow: "0 0 30px rgba(0,0,0,0.15)",
    },
  },
  carousel: {
    name: "carousel",
    category: "component",
    description: "Sliding content",
    properties: {
      display: "flex",
      overflow: "hidden",
      scrollSnapType: "x mandatory",
    },
  },
  // Semantic intents
  header: {
    name: "header",
    category: "semantic",
    description: "Page header",
    properties: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 24px",
      borderBottom: "1px solid #e5e7eb",
    },
  },
  footer: {
    name: "footer",
    category: "semantic",
    description: "Page footer",
    properties: {
      padding: "24px",
      borderTop: "1px solid #e5e7eb",
    },
  },
  sidebar: {
    name: "sidebar",
    category: "semantic",
    description: "Persistent side navigation",
    properties: {
      width: "240px",
      padding: "16px",
      borderRight: "1px solid #e5e7eb",
    },
  },
  section: {
    name: "section",
    category: "semantic",
    description: "Generic page section",
    properties: {
      padding: "48px 24px",
    },
  },
  article: {
    name: "article",
    category: "semantic",
    description: "Long-form content",
    properties: {
      maxWidth: "720px",
      margin: "0 auto",
      lineHeight: "1.7",
    },
  },
  aside: {
    name: "aside",
    category: "semantic",
    description: "Supplementary content",
    properties: {
      flex: "1",
      maxWidth: "320px",
    },
  },
  // Interaction intents
  clickable: {
    name: "clickable",
    category: "interaction",
    description: "Clickable element",
    properties: {
      cursor: "pointer",
      userSelect: "none",
    },
  },
  disabled: {
    name: "disabled",
    category: "interaction",
    description: "Disabled state",
    properties: {
      opacity: "0.5",
      pointerEvents: "none",
      cursor: "not-allowed",
    },
  },
  selected: {
    name: "selected",
    category: "interaction",
    description: "Selected/active state",
    properties: {
      backgroundColor: "#6366f1",
      color: "#ffffff",
    },
  },
  // Typography intents
  heading: {
    name: "heading",
    category: "typography",
    description: "Large heading",
    properties: {
      fontSize: "32px",
      fontWeight: "700",
      lineHeight: "1.2",
    },
  },
  "body-text": {
    name: "body-text",
    category: "typography",
    description: "Body paragraph",
    properties: {
      fontSize: "16px",
      lineHeight: "1.6",
    },
  },
  caption: {
    name: "caption",
    category: "typography",
    description: "Small caption",
    properties: {
      fontSize: "12px",
      lineHeight: "1.5",
      color: "#6b7280",
    },
  },
  muted: {
    name: "muted",
    category: "typography",
    description: "Muted text color",
    properties: {
      color: "#6b7280",
    },
  },
  truncate: {
    name: "truncate",
    category: "typography",
    description: "Single-line ellipsis",
    properties: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  bold: {
    name: "bold",
    category: "typography",
    description: "Bold text",
    properties: {
      fontWeight: "700",
    },
  },

  // ==========================================================================
  // PHASE 3: Composition Intents
  // ==========================================================================
  "premium-card": {
    name: "premium-card",
    category: "composite",
    description: "Premium card composing card, glass, and elevated",
    compose: [
      { intent: "card" },
      { intent: "glass", args: { intensity: 0.8 } },
      { intent: "elevated", args: { level: 3 } },
    ],
    conditions: [
      {
        when: { theme: "dark" },
        add: ["glow"],
        remove: ["elevated"],
      },
    ],
  },
  "premium-button": {
    name: "premium-button",
    category: "composite",
    description: "Premium button composing primary, elevated, and hover-lift",
    compose: [
      { intent: "button-primary" },
      { intent: "elevated" },
      { intent: "hover-lift" },
    ],
    conditions: [
      {
        when: { theme: "dark" },
        add: ["glass"],
      },
    ],
  },
  "dark-card": {
    name: "dark-card",
    category: "composite",
    description: "Card with dark theme baked in",
    compose: [
      { intent: "card" },
      { intent: "bordered" },
    ],
    conditions: [
      {
        when: { theme: "light" },
        add: ["elevated"],
      },
      {
        when: { theme: "dark" },
        add: ["glass"],
        remove: ["elevated"],
      },
    ],
  },
  "glass-panel": {
    name: "glass-panel",
    category: "composite",
    description: "Glass panel with border and spacing",
    compose: [
      { intent: "glass" },
      { intent: "bordered" },
      { intent: "spacious" },
    ],
  },
  "hero-banner": {
    name: "hero-banner",
    category: "composite",
    description: "Hero banner with gradient and centered content",
    compose: [
      { intent: "hero-section" },
      { intent: "gradient" },
      { intent: "center-content" },
    ],
    conditions: [
      {
        when: { theme: "dark" },
        add: ["glass"],
      },
    ],
  },
  "modal-glass": {
    name: "modal-glass",
    category: "composite",
    description: "Modal with glass effect and elevation",
    compose: [
      { intent: "modal" },
      { intent: "glass" },
      { intent: "elevated" },
    ],
  },
  "input-group": {
    name: "input-group",
    category: "composite",
    description: "Input field with border and compact spacing",
    compose: [
      { intent: "input-field" },
      { intent: "bordered" },
      { intent: "compact" },
    ],
  },
};

export const INTENT_CATALOG: Record<string, IntentDefinition> = {
  ...BUILTIN_INTENT_CATALOG,
};
export const BUILTIN_CATALOG = BUILTIN_INTENT_CATALOG;

export function registerIntent(
  name: string,
  def: IntentDefinition,
  allowOverride = false,
) {
  if (!allowOverride && BUILTIN_INTENT_CATALOG[name]) {
    console.warn(
      `[ChainCSS] intent '${name}' overrides builtin. Use allowOverride:true to silence.`,
    );
  }
  INTENT_CATALOG[name] = { ...def, name };
  addToCatalog(name, INTENT_CATALOG[name]);
}

export function registerIntents(
  intents: Record<string, IntentDefinition>,
  allowOverride = false,
) {
  for (const [k, v] of Object.entries(intents || {})) {
    registerIntent(k, v, allowOverride);
  }
}

// Fix #4: Deep clone built-in catalog on reset
export function resetIntents() {
  for (const k of Object.keys(INTENT_CATALOG)) {
    delete INTENT_CATALOG[k];
  }
  // Deep clone to prevent shared reference mutation
  const cloned = JSON.parse(JSON.stringify(BUILTIN_INTENT_CATALOG));
  Object.assign(INTENT_CATALOG, cloned);
  setIntentCatalog(INTENT_CATALOG);
}

export function getIntentCatalog() {
  return { ...INTENT_CATALOG };
}

interface ResolvedIntent {
  properties: Record<string, string | number>;
  states: Record<string, Record<string, string | number>>;
  responsive: Record<string, Record<string, string | number>>;
  a11y: string[];
  description: string;
}

function resolveIntent(
  intentName: string,
  theme?: "light" | "dark" | "high-contrast",
  variant?: string,
): ResolvedIntent | null {
  const intent = INTENT_CATALOG[intentName];
  if (!intent) return null;

  const properties: Record<string, string | number> = {};
  const states: Record<string, Record<string, string | number>> = {};
  const responsive: Record<string, Record<string, string | number>> = {};

  // 1. Resolve semantics
  if (intent.semantics) {
    for (const sem of intent.semantics) {
      const resolved = resolveSemantic(sem.category as any, sem.intent, {
        mode: theme || "light",
      });
      if (resolved) {
        for (const [prop, value] of Object.entries(resolved.properties)) {
          if (resolved.pseudoClass) {
            if (!states[resolved.pseudoClass])
              states[resolved.pseudoClass] = {};
            states[resolved.pseudoClass][prop] = value;
          } else {
            properties[prop] = value;
          }
        }
      }
    }
  }

  // 2. Apply base properties
  if (intent.properties) Object.assign(properties, intent.properties);

  // 3. Apply base states
  if (intent.states) {
    for (const [s, p] of Object.entries(intent.states)) {
      if (!states[s]) states[s] = {};
      Object.assign(states[s], p);
    }
  }

  // 4. Apply responsive
  if (intent.responsive) Object.assign(responsive, intent.responsive);

  // 5. NEW: Apply theme overrides
  if (theme && intent.themes && intent.themes[theme]) {
    const themeOverrides = intent.themes[theme];

    if (themeOverrides.properties) {
      Object.assign(properties, themeOverrides.properties);
    }

    if (themeOverrides.states) {
      for (const [stateName, stateProps] of Object.entries(themeOverrides.states)) {
        if (!states[stateName]) states[stateName] = {};
        Object.assign(states[stateName], stateProps);
      }
    }

    if (themeOverrides.responsive) {
      Object.assign(responsive, themeOverrides.responsive);
    }
  }

  // 6. NEW: Apply variant overrides (after theme so variant wins)
  if (variant && intent.variants && intent.variants[variant]) {
    const variantOverrides = intent.variants[variant];

    if (variantOverrides.properties) {
      Object.assign(properties, variantOverrides.properties);
    }

    if (variantOverrides.states) {
      for (const [stateName, stateProps] of Object.entries(variantOverrides.states)) {
        if (!states[stateName]) states[stateName] = {};
        Object.assign(states[stateName], stateProps);
      }
    }

    if (variantOverrides.responsive) {
      Object.assign(responsive, variantOverrides.responsive);
    }
  }

  return {
    properties,
    states,
    responsive,
    a11y: intent.a11y || [],
    description: intent.description,
  };
}

export const intentResolver: LoweringPass = {
  name: "intent-resolver",
  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    let generatedNodes = 0;

    const globalStyles: Record<string, Record<string, string | number>> = {};

    // Read theme and variant from config
    const configTheme = (context as any)?.config?.theme as
      | "light" | "dark" | "high-contrast" | undefined;
    const configVariant = (context as any)?.config?.variant as string | undefined;

    for (const rule of ir.rules) {
      const intentNames: string[] =
        rule.passMeta?.analysis?.semantic?.intents ??
        ((rule.meta as any)._intent
          ? [(rule.meta as any)._intent as string]
          : []);

      if (intentNames.length === 0) continue;

      // ==========================================================================
      // Validate intent combination before resolution
      // ==========================================================================
      const validation = validateIntentCombination(intentNames, {
        autoResolve: true,
        suggestEnhancements: true,
      });

      for (const warning of validation.warnings) {
        if ((context as any)?.config?.verbose) {
          console.warn(`[ChainCSS Intent] ${warning}`);
        }
      }
      if (
        validation.suggestions.length > 0 &&
        (context as any)?.config?.verbose
      ) {
        console.log(
          `[ChainCSS Intent] 💡 Suggested enhancements: ${validation.suggestions.join(", ")}`,
        );
      }
      if (!validation.valid) {
        const errorMessage = validation.errors.join("\n");
        
        if ((context as any)?.config?.strictIntents) {
          throw new Error(`[ChainCSS Intent] ${errorMessage}`);
        } else {
          console.error(`[ChainCSS Intent] ❌ ${errorMessage}`);
          
          for (const error of validation.errors) {
            ir.diagnostics.push({
              id: `intent-validation-${Date.now()}-${Math.random()}`,
              nodeId: rule.id,
              severity: "error",
              message: error,
              pass: "intent-resolver",
            });
          }
        }
      }
      const resolvedIntentNames = validation.resolvedIntents;

      const compositionResult = resolveCompositions(resolvedIntentNames, {
        theme: configTheme || "light",
        variant: configVariant,
      });
      const finalIntentNames = compositionResult.intents;

      for (const warning of compositionResult.warnings) {
        if ((context as any)?.config?.verbose) {
          console.warn(`[ChainCSS Composition] ${warning}`);
        }
      }

      // Collect global styles from global intents
      // ==========================================================================
      for (const intentName of finalIntentNames) {
        const catalogIntent = INTENT_CATALOG[intentName];
        
        if (catalogIntent?.global && catalogIntent.globalStyles) {
          for (const [selector, styles] of Object.entries(catalogIntent.globalStyles)) {
            if (!globalStyles[selector]) {
              globalStyles[selector] = {};
            }
            Object.assign(globalStyles[selector], styles);
          }
        }
      }

      // ==========================================================================
      // Determine which themes to resolve
      // ==========================================================================
      const baseTheme = configTheme || "light";
      const themeModes: Array<"light" | "dark" | "high-contrast"> = 
        baseTheme === "dark" ? ["dark"] : ["light", "dark"];

      // ==========================================================================
      // Resolve intents for each theme and apply
      // ==========================================================================
      for (const activeTheme of themeModes) {
        const mergedProperties: Record<string, string | number> = {};
        const mergedStates: Record<string, Record<string, string | number>> = {};
        const mergedResponsive: Record<string, Record<string, string | number>> = {};
        const mergedA11y: string[] = [];

        // Resolve all intents for this theme
        for (const intentName of finalIntentNames) {
          const semanticCtx: SemanticIntentContext = {
            theme: activeTheme,
            config: (context as any)?.config,
            variant: configVariant,
          };

          let resolved: ResolvedIntent | null = null;

          if (hasSemanticIntent(intentName)) {
            const semResult = resolveSemanticIntent(intentName, semanticCtx);
            if (semResult && (semResult as any).properties) {
              resolved = {
                properties: (semResult as any).properties || {},
                states: (semResult as any).states || {},
                responsive: (semResult as any).responsive || {},
                a11y: (semResult as any).a11y || [],
                description: "",
              };
            }
          }

          if (!resolved) {
            resolved = resolveIntent(intentName, activeTheme, configVariant);
          }

          if (!resolved) continue;

          // Merge properties
          for (const [prop, value] of Object.entries(resolved.properties)) {
            if (!(prop in mergedProperties)) {
              mergedProperties[prop] = value;
            }
          }

          // Merge states
          for (const [stateName, stateProps] of Object.entries(resolved.states || {})) {
            if (!mergedStates[stateName]) mergedStates[stateName] = {};
            for (const [p, v] of Object.entries(stateProps)) {
              if (!(p in mergedStates[stateName])) {
                mergedStates[stateName][p] = v;
              }
            }
          }

          // Merge responsive
          for (const [bp, bpProps] of Object.entries(resolved.responsive || {})) {
            if (!mergedResponsive[bp]) mergedResponsive[bp] = {};
            for (const [p, v] of Object.entries(bpProps)) {
              if (!(p in mergedResponsive[bp])) {
                mergedResponsive[bp][p] = v;
              }
            }
          }

          // Merge a11y
          for (const req of resolved.a11y || []) {
            if (!mergedA11y.includes(req)) mergedA11y.push(req);
          }
        }

        // ======================================================================
        // Apply: base theme → rule directly, other themes → override rule
        // ======================================================================
        if (activeTheme === baseTheme) {
          // Apply as base styles on the original rule
          const userSetProps = new Set<string>();
          for (const decl of rule.declarations) {
            userSetProps.add(normalizeProperty(decl.property));
          }

          for (const [prop, value] of Object.entries(mergedProperties)) {
            const normalizedProp = normalizeProperty(prop);
            if (userSetProps.has(normalizedProp)) continue;
            
            const existingDecl = rule.declarations.find(
              (d) => normalizeProperty(d.property) === normalizedProp,
            );
            if (!existingDecl) {
              rule.declarations.push(
                createDeclaration(normalizedProp, value, rule.source, {
                  intent: resolvedIntentNames.join(","),
                  category: "lowered-intent",
                }),
              );
          recordHistory(
            rule.declarations[rule.declarations.length - 1],
            "intent-resolver",
            "lowered-intent",
            undefined,
            `intents([${resolvedIntentNames.join(", ")}]) → ${normalizedProp}: ${value}`,
          );
              generatedNodes++;
            }
          }

          // Apply states
          for (const [stateName, stateProps] of Object.entries(mergedStates)) {
            const pseudoClass = rule.pseudoClasses.find(
              (pc) => pc.name === stateName,
            );
            if (pseudoClass) {
              const pcUserSetProps = new Set<string>();
              for (const decl of pseudoClass.declarations) {
                pcUserSetProps.add(normalizeProperty(decl.property));
              }
              for (const [p, v] of Object.entries(stateProps)) {
                const normalizedP = normalizeProperty(p);
                if (pcUserSetProps.has(normalizedP)) continue;
                const existingDecl = pseudoClass.declarations.find(
                  (d) => normalizeProperty(d.property) === normalizedP,
                );
                if (!existingDecl) {
                  pseudoClass.declarations.push(
                    createDeclaration(normalizedP, v, rule.source),
                  );
                }
              }
            } else {
              rule.pseudoClasses.push({
                id: `intent-state-${rule.id}-${stateName}`,
                name: stateName,
                parentId: rule.id,
                source: rule.source,
                history: [],
                declarations: Object.entries(stateProps).map(([p, v]) =>
                  createDeclaration(normalizeProperty(p), v, rule.source),
                ),
              });
            }
          }

          // Apply responsive
          if (Object.keys(mergedResponsive).length > 0) {
            if (!rule.passMeta) rule.passMeta = {};
            if (!rule.passMeta.analysis) rule.passMeta.analysis = {};
            if (!rule.passMeta.analysis.semantic)
              rule.passMeta.analysis.semantic = {
                tokens: [],
                intents: [],
                constraints: [],
              };
            (rule.passMeta.analysis as any).responsiveIntents = mergedResponsive;
            (rule.meta as any)._responsiveIntents = mergedResponsive;
          }

          // Apply a11y
          if (mergedA11y.length > 0) {
            if (!rule.passMeta) rule.passMeta = {};
            if (!rule.passMeta.analysis) rule.passMeta.analysis = {};
            (rule.passMeta.analysis as any).a11yRequirements = mergedA11y;
            (rule.meta as any)._a11yRequirements = mergedA11y;
          }
        } else {
          // Create theme override rule with [data-theme="..."] selector
          const themeOverrideRule: any = {
            id: `${rule.id}-theme-${activeTheme}`,
            selector: `[data-theme="${activeTheme}"] ${rule.selector}`,
            declarations: [],
            pseudoClasses: [],
            atRules: [],
            nestedRules: [],
            conditions: [],
            meta: {
              dependencies: [rule.id],
              dependents: [],
              _themeOverride: true,
            },
            isDead: false,
            specificity: (rule.specificity || 10) + 10,
            hash: `${rule.hash}-theme-${activeTheme}`,
            source: rule.source,
            history: [],
          };

          // Add properties
          for (const [prop, value] of Object.entries(mergedProperties)) {
            themeOverrideRule.declarations.push(
              createDeclaration(normalizeProperty(prop), value, rule.source, {
                intent: resolvedIntentNames.join(","),
                category: "theme-override",
                theme: activeTheme,
              }),
            );
            recordHistory(
              themeOverrideRule.declarations[themeOverrideRule.declarations.length - 1],
              "intent-resolver",
              "theme-override",
              undefined,
              `intents([${resolvedIntentNames.join(", ")}]) theme=${activeTheme} → ${normalizeProperty(prop)}: ${value}`,
            );
          }

          // Add states
          for (const [stateName, stateProps] of Object.entries(mergedStates)) {
            themeOverrideRule.pseudoClasses.push({
              id: `theme-${activeTheme}-state-${rule.id}-${stateName}`,
              name: stateName,
              parentId: themeOverrideRule.id,
              source: rule.source,
              history: [],
              declarations: Object.entries(stateProps).map(([p, v]) =>
                createDeclaration(normalizeProperty(p), v, rule.source),
              ),
            });
          }

          ir.rules.push(themeOverrideRule);
          generatedNodes++;
        }
      }
    }

    // Store global styles
    if (Object.keys(globalStyles).length > 0) {
      if (!ir.meta) {
        ir.meta = {} as any;
      }
      (ir.meta as any).globalStyles = globalStyles;
    }

    return { ir, generatedNodes };
  },
};
// ============================================================================
// Semantic Intent Integration
// ============================================================================

export function registerSemanticIntentsFromConfig(
  configIntents?: Record<string, any>,
): void {
  if (!configIntents) return;

  const semanticIntents: Record<string, any> = {};

  for (const [name, def] of Object.entries(configIntents)) {
    if (typeof (def as any).resolve === "function") {
      semanticIntents[name] = def;
    } else if ((def as any).properties || (def as any).semantics) {
      continue;
    }
  }

  if (Object.keys(semanticIntents).length > 0) {
    // Fix #3: Removed debug console.log
    registerSemanticIntents(semanticIntents);
  }
}

// Re-export for convenience
export {
  registerSemanticIntent,
  resolveSemanticIntent,
  hasSemanticIntent,
  getSemanticIntentNames,
  clearSemanticIntents,
} from "../intent/semantic-intent-registry.js";

export { parseDescription, extendDictionary } from "../intent/semantic-intent-parser.js";

setIntentCatalog(INTENT_CATALOG);