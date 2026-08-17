// ============================================================================
// FILE: src/compiler/pipeline/intent/intent-relationships.ts (EXPANDED)
// Defines relationships between intents
// ============================================================================

import type { IntentDefinition } from "./semantic-intent-types.js";

export const INTENT_RELATIONSHIPS: Record<string, Partial<IntentDefinition>> = {
  // ==========================================================================
  // LAYOUT INTENTS
  // ==========================================================================
  
  "center-content": {
    enhances: ["hero-section", "modal", "container"],
    conflicts: ["full-width"],  // Can't center and be full-width
    priority: 5,
  },
  
  stack: {
    enhances: ["card", "modal", "spacious"],
    conflicts: ["flex-row", "grid-list"],  // Can't be both stack and row/grid
    priority: 5,
  },
  
  "sidebar-layout": {
    enhances: ["sticky-header", "container"],
    conflicts: ["center-content"],
    responsive: { mobile: { gridTemplateColumns: "1fr" } },
    priority: 6,
  },
  
  "grid-list": {
    enhances: ["card", "spacious"],
    conflicts: ["stack"],  // Can't be both grid and stack
    priority: 5,
  },
  
  container: {
    enhances: ["section", "hero-section", "spacious"],
    conflicts: ["full-width"],
    priority: 4,
  },
  
  "grid-two-column": {
    enhances: ["card", "compact"],
    conflicts: ["stack", "flex-col"],
    priority: 5,
  },
  
  "flex-row": {
    enhances: ["compact", "center-content"],
    conflicts: ["stack", "flex-col"],
    priority: 5,
  },
  
  "flex-col": {
    enhances: ["stack", "compact"],
    conflicts: ["flex-row", "grid-list"],
    priority: 5,
  },
  
  "full-width": {
    conflicts: ["container", "center-content"],
    priority: 4,
  },
  
  stretch: {
    enhances: ["stack", "flex-col"],
    priority: 3,
  },

  // ==========================================================================
  // COMPONENT INTENTS
  // ==========================================================================
  
  card: {
    requires: ["rounded"],
    conflicts: ["transparent", "flat"],
    enhances: ["elevated", "glass", "hover-lift", "bordered"],
    maxCombinations: 5,
    priority: 10,
  },
  
  "button-primary": {
    requires: ["focus-ring"],
    conflicts: ["disabled", "muted", "transparent"],
    enhances: ["hover-lift", "compact", "elevated"],
    maxCombinations: 4,
    priority: 10,
  },
  
  "button-secondary": {
    requires: ["focus-ring"],
    conflicts: ["disabled"],
    enhances: ["bordered", "compact", "hover-lift"],
    maxCombinations: 4,
    priority: 10,
  },
  
  "input-field": {
    requires: ["focus-ring"],
    conflicts: ["disabled"],
    enhances: ["bordered", "compact"],
    maxCombinations: 4,
    priority: 9,
  },
  
  modal: {
    requires: ["elevated", "rounded"],
    conflicts: ["transparent"],
    enhances: ["glass", "center-content", "spacious"],
    maxCombinations: 5,
    priority: 9,
  },
  
  tooltip: {
    requires: ["elevated", "rounded"],
    conflicts: ["transparent"],
    enhances: ["compact", "muted"],
    maxCombinations: 4,
    priority: 7,
  },
  
  badge: {
    requires: ["rounded"],
    conflicts: ["transparent"],
    enhances: ["compact", "bold"],
    maxCombinations: 4,
    priority: 7,
  },
  
  avatar: {
    requires: ["rounded"],
    conflicts: ["bordered"],
    enhances: ["elevated"],
    maxCombinations: 3,
    priority: 7,
  },
  
  divider: {
    conflicts: ["bordered"],  // Divider IS a border
    enhances: ["spacious"],
    maxCombinations: 3,
    priority: 3,
  },
  
  accordion: {
    enhances: ["bordered", "compact"],
    requires: ["clickable"],
    maxCombinations: 4,
    priority: 6,
  },
  
  tab: {
    requires: ["clickable", "focus-ring"],
    conflicts: ["disabled"],
    enhances: ["compact", "bold"],
    maxCombinations: 4,
    priority: 7,
  },
  
  dropdown: {
    requires: ["elevated", "rounded"],
    conflicts: ["transparent"],
    enhances: ["bordered", "compact"],
    maxCombinations: 4,
    priority: 7,
  },
  
  banner: {
    requires: ["rounded"],
    enhances: ["bordered", "compact"],
    maxCombinations: 4,
    priority: 6,
  },
  
  breadcrumb: {
    enhances: ["muted", "compact"],
    conflicts: ["heading"],
    maxCombinations: 3,
    priority: 4,
  },
  
  pagination: {
    enhances: ["compact", "bordered"],
    requires: ["clickable"],
    maxCombinations: 4,
    priority: 6,
  },
  
  "progress-bar": {
    requires: ["rounded"],
    conflicts: ["bordered"],
    maxCombinations: 3,
    priority: 5,
  },
  
  skeleton: {
    requires: ["rounded"],
    conflicts: ["elevated", "bordered"],
    maxCombinations: 3,
    priority: 5,
  },
  
  toast: {
    requires: ["elevated", "rounded"],
    enhances: ["glass", "compact"],
    conflicts: ["transparent"],
    maxCombinations: 4,
    priority: 8,
  },
  
  drawer: {
    requires: ["elevated"],
    enhances: ["bordered", "spacious"],
    conflicts: ["transparent"],
    maxCombinations: 4,
    priority: 7,
  },
  
  carousel: {
    enhances: ["elevated", "rounded"],
    conflicts: ["stack"],
    maxCombinations: 4,
    priority: 6,
  },

  // ==========================================================================
  // SEMANTIC INTENTS
  // ==========================================================================
  
  "hero-section": {
    enhances: ["gradient", "glass", "center-content", "heading"],
    conflicts: ["compact"],
    maxCombinations: 5,
    priority: 8,
  },
  
  "sticky-header": {
    enhances: ["glass", "bordered", "compact"],
    conflicts: ["transparent"],
    maxCombinations: 4,
    priority: 7,
  },
  
  header: {
    enhances: ["bordered", "compact"],
    conflicts: ["transparent"],
    maxCombinations: 4,
    priority: 6,
  },
  
  footer: {
    enhances: ["bordered", "muted", "compact"],
    maxCombinations: 4,
    priority: 5,
  },
  
  sidebar: {
    enhances: ["bordered", "spacious"],
    conflicts: ["full-width"],
    maxCombinations: 4,
    priority: 6,
  },
  
  section: {
    enhances: ["container", "spacious", "heading"],
    maxCombinations: 4,
    priority: 5,
  },
  
  article: {
    enhances: ["body-text", "spacious"],
    conflicts: ["compact"],
    maxCombinations: 3,
    priority: 5,
  },
  
  aside: {
    enhances: ["bordered", "muted"],
    maxCombinations: 3,
    priority: 4,
  },

  // ==========================================================================
  // INTERACTION INTENTS
  // ==========================================================================
  
  "hover-lift": {
    enhances: ["card", "button-primary", "clickable"],
    conflicts: ["disabled"],
    maxCombinations: 3,
    priority: 6,
  },
  
  "focus-ring": {
    conflicts: ["disabled"],
    enhances: ["button-primary", "button-secondary", "input-field"],
    priority: 9,
  },
  
  clickable: {
    conflicts: ["disabled"],
    enhances: ["hover-lift", "focus-ring"],
    priority: 6,
  },
  
  disabled: {
    conflicts: ["clickable", "hover-lift", "focus-ring", "selected", "button-primary"],
    priority: 8,
  },
  
  selected: {
    conflicts: ["disabled", "muted"],
    enhances: ["bold"],
    priority: 7,
  },

  // ==========================================================================
  // VISUAL INTENTS
  // ==========================================================================
  
  glass: {
    requires: ["rounded"],
    conflicts: ["flat", "transparent"],
    enhances: ["elevated", "gradient", "bordered"],
    priority: 8,
  },
  
  elevated: {
    enhances: ["card", "modal", "toast"],
    conflicts: ["flat"],
    priority: 6,
  },
  
  bordered: {
    enhances: ["card", "sticky-header", "input-field"],
    conflicts: ["flat"],
    priority: 4,
  },
  
  rounded: {
    enhances: ["card", "glass", "modal"],
    conflicts: ["flat"],
    priority: 4,
  },
  
  gradient: {
    enhances: ["glass", "hero-section"],
    conflicts: ["transparent", "flat"],
    priority: 5,
  },

  // ==========================================================================
  // SPACING INTENTS
  // ==========================================================================
  
  compact: {
    conflicts: ["spacious", "padded"],
    enhances: ["button-primary", "button-secondary", "badge"],
    priority: 3,
  },
  
  spacious: {
    conflicts: ["compact", "padded"],
    enhances: ["section", "hero-section", "modal"],
    priority: 3,
  },
  
  padded: {
    conflicts: ["compact", "spacious"],
    priority: 2,
  },
  
  "margin-auto": {
    enhances: ["container", "center-content"],
    priority: 2,
  },

  // ==========================================================================
  // TYPOGRAPHY INTENTS
  // ==========================================================================
  
  heading: {
    enhances: ["hero-section", "section"],
    conflicts: ["caption", "muted"],
    priority: 5,
  },
  
  "body-text": {
    enhances: ["article", "section"],
    conflicts: ["heading", "caption"],
    priority: 4,
  },
  
  caption: {
    enhances: ["muted"],
    conflicts: ["heading"],
    priority: 2,
  },
  
  muted: {
    conflicts: ["button-primary", "heading"],
    enhances: ["caption", "footer"],
    priority: 2,
  },
  
  truncate: {
    enhances: ["compact"],
    conflicts: ["spacious"],
    priority: 3,
  },
  
  bold: {
    enhances: ["heading", "button-primary"],
    priority: 3,
  },
};

export function applyIntentRelationships(
  catalog: Record<string, IntentDefinition>,
): void {
  for (const [intentName, relationships] of Object.entries(INTENT_RELATIONSHIPS)) {
    if (catalog[intentName]) {
      catalog[intentName] = {
        ...catalog[intentName],
        ...relationships,
      };
    }
  }
}