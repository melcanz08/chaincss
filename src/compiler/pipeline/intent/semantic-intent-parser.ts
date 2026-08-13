// ============================================================================
// FILE: src/compiler/pipeline/intent/semantic-intent-parser.ts
// Parses natural language descriptions into semantic intent arrays
// No AI — pure deterministic tokenizer + dictionary
// ============================================================================

import { hasSemanticIntent } from "./semantic-intent-registry.js";
import { getIntentCatalog } from "./intent-catalog.js";

// ============================================================================
// Dictionary
// ============================================================================

/**
 * Maps natural language words to semantic intent names.
 * Users can extend this via config.
 */
const DEFAULT_DICTIONARY: Record<string, string> = {
  // Visual
  glass: "glass",
  frosted: "glass",
  elevated: "elevated",
  raised: "elevated",
  outlined: "outlined",
  bordered: "outlined",
  rounded: "rounded",
  soft: "soft",
  flat: "flat",

  // Color
  blue: "blueBg",
  "light-blue": "lightBlueBg",
  dark: "darkBg",
  white: "whiteBg",
  "light-text": "lightText",
  "dark-text": "darkText",
  muted: "mutedText",
  accent: "accentText",

  // Layout
  centered: "centered",
  spacious: "spacious",
  compact: "compact",
  stacked: "stacked",
  "side-by-side": "sidebar-layout",

  // Typography
  heading: "heading",
  "large-text": "heading",
  body: "body",
  "normal-text": "body",
  caption: "caption",
  "small-text": "caption",
  bold: "bold",
  "light-weight": "lightWeight",

  // Interaction
  "hover-lift": "hover-lift",
  "focus-ring": "focus-ring",

  // Components
  card: "card",
  modal: "modal",
  tooltip: "tooltip",
  "hero-section": "hero-section",
  "sticky-header": "sticky-header",
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse a natural language description into an array of semantic intent names.
 *
 * @example
 *   parseDescription("glass blue navbar with light text")
 *   // → ["glass", "blueBg", "lightText"]
 *
 * @param description - Natural language description
 * @param customDictionary - Additional word→intent mappings
 * @returns Array of intent names that exist in the registry
 */
export function parseDescription(
  description: string,
  customDictionary?: Record<string, string>,
): string[] {
  const dict = { ...DEFAULT_DICTIONARY, ...customDictionary };
  const words = tokenize(description);
  const intents: string[] = [];
  const seen = new Set<string>();

  // Try multi-word matches first (greedy), then single words
  let i = 0;
  while (i < words.length) {
    let matched = false;

    // Try 3-word, 2-word, then 1-word matches
    for (let len = Math.min(3, words.length - i); len >= 1; len--) {
      const phrase = words.slice(i, i + len).join("-").toLowerCase();
      const intentName = dict[phrase];

      if (intentName && !seen.has(intentName) && (hasSemanticIntent(intentName) || getIntentCatalog()[intentName])) {
        intents.push(intentName);
        seen.add(intentName);
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      i++;
    }
  }

  return intents;
}

/**
 * Check if a word or phrase maps to a known intent.
 */
export function isKnownDescriptionWord(word: string): boolean {
  return word.toLowerCase() in DEFAULT_DICTIONARY;
}

/**
 * Extend the dictionary with custom mappings.
 */
export function extendDictionary(
  additions: Record<string, string>,
): void {
  Object.assign(DEFAULT_DICTIONARY, additions);
}

// ============================================================================
// Internal
// ============================================================================

/**
 * Tokenize a description string into lowercase words.
 * Splits on whitespace and common punctuation.
 */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[,;.!?]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}