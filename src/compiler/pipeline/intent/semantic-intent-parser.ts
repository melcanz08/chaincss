// ============================================================================
// FILE: src/compiler/pipeline/intent/semantic-intent-parser.ts
// Natural language → intents (+ theme/variant hints)
// Deterministic — no AI
// ============================================================================

import { hasSemanticIntent } from "./semantic-intent-registry.js";
import { getIntentCatalog } from "./intent-catalog.js";

// ============================================================================
// Dictionary — canonical phrases → intent name
// ============================================================================

const DEFAULT_DICTIONARY: Record<string, string> = {
  // visual
  glass: "glass",
  frosted: "glass",
  glassmorphism: "glass",
  elevated: "elevated",
  raised: "elevated",
  bordered: "bordered",
  outlined: "outlined",
  rounded: "rounded",
  soft: "rounded",
  glow: "glow",
  glowing: "glow",

  // surfaces
  card: "card",
  panel: "card",
  modal: "modal",
  dialog: "modal",
  tooltip: "tooltip",
  badge: "badge",
  toast: "toast",
  banner: "banner",
  drawer: "drawer",
  sidebar: "sidebar",
  header: "header",
  footer: "footer",

  // layout
  centered: "center-content",
  center: "center-content",
  stack: "stack",
  stacked: "stack",
  grid: "grid-list",
  gridlist: "grid-list",
  "grid list": "grid-list",
  row: "flex-row",
  "flex row": "flex-row",
  column: "flex-col",
  "flex col": "flex-col",
  "flex column": "flex-col",
  container: "container",
  spacious: "spacious",
  compact: "compact",
  padded: "padded",

  // interaction
  clickable: "clickable",
  pressable: "clickable",
  "hover lift": "hover-lift",
  "hover-lift": "hover-lift",
  "focus ring": "focus-ring",
  focusable: "focus-ring",

  // buttons
  button: "button-primary",
  "primary button": "button-primary",
  "premium button": "premium-button",
  btn: "button-primary",

  // composite
  "glass panel": "glass-panel",
  "glass card": "glass-card",
  "premium card": "premium-card",
  "hero banner": "hero-banner",
  "modal glass": "modal-glass",
  "input group": "input-group",
  "dark card": "dark-card",

  // typography
  heading: "heading",
  title: "heading",
  "body text": "body-text",
  body: "body-text",
  caption: "caption",
  muted: "muted",
  bold: "bold",
  truncate: "truncate",
};

// ============================================================================
// Theme / variant detection
// ============================================================================

const THEME_WORDS: Record<string, "light" | "dark" | "high-contrast"> = {
  dark: "dark",
  darkmode: "dark",
  "dark mode": "dark",
  light: "light",
  lightmode: "light",
  "light mode": "light",
  "high contrast": "high-contrast",
  highcontrast: "high-contrast",
};

const VARIANT_WORDS: Record<string, string> = {
  premium: "premium",
  outlined: "outlined",
  success: "success",
  danger: "danger",
  error: "error",
  warning: "warning",
};

// ============================================================================
// Stop words — ignored but not counted as unmatched
// ============================================================================

const STOP_WORDS = new Set([
  "a", "an", "the", "with", "and", "of", "for", "to", "in", "on",
  "style", "styles", "ui", "component", "components", "use", "using",
  "make", "create", "build", "have", "has", "look", "looks", "looking",
]);

// ============================================================================
// Tokenizer
// ============================================================================

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[,;.!?]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ============================================================================
// Public API
// ============================================================================

export interface ParsedDescription {
  intents: string[];
  theme?: "light" | "dark" | "high-contrast";
  variant?: string;
  matchedPhrases: string[];
  unmatchedWords: string[];
  ignoredStopWords: string[];
}

export function parseDescription(
  description: string,
  customDictionary?: Record<string, string>,
): ParsedDescription {
  const dict = { ...DEFAULT_DICTIONARY, ...customDictionary };
  const words = tokenize(description);
  const intents: string[] = [];
  const matchedPhrases: string[] = [];
  const unmatchedWords: string[] = [];
  const ignoredStopWords: string[] = [];

  let theme: ParsedDescription["theme"];
  let variant: string | undefined;

  const seen = new Set<string>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const twoWordTheme = words.slice(i, i + 2).join(" ");
    const threeWordTheme = words.slice(i, i + 3).join(" ");

    // Detect theme first
    if (THEME_WORDS[threeWordTheme] && !theme) {
      theme = THEME_WORDS[threeWordTheme];
      matchedPhrases.push(threeWordTheme);
      i += 2;
      continue;
    }

    if (THEME_WORDS[twoWordTheme] && !theme) {
      theme = THEME_WORDS[twoWordTheme];
      matchedPhrases.push(twoWordTheme);
      i++;
      continue;
    }

    if (THEME_WORDS[word] && !theme) {
      theme = THEME_WORDS[word];
      matchedPhrases.push(word);
      continue;
    }

    // Ignore stop words
    if (STOP_WORDS.has(word)) {
      ignoredStopWords.push(word);
      continue;
    }

    // Try phrase matching first (3-word, 2-word)
    let matched = false;

    for (let len = Math.min(3, words.length - i); len >= 2; len--) {
      const phrase = words.slice(i, i + len).join(" ");
      const intent = dict[phrase];

      if (intent && !seen.has(intent)) {
        intents.push(intent);
        seen.add(intent);
        matchedPhrases.push(phrase);
        i += len - 1;
        matched = true;
        break;
      }
    }

    // If no multi-word phrase matched, try variant
    if (!matched && VARIANT_WORDS[word] && !variant) {
      variant = VARIANT_WORDS[word];
      matchedPhrases.push(word);
      continue;
    }

    // Single word intent
    if (!matched) {
      const single = dict[word];
      if (single && !seen.has(single)) {
        intents.push(single);
        seen.add(single);
        matchedPhrases.push(word);
        matched = true;
      }
    }

    if (!matched) {
      unmatchedWords.push(word);
    }
  }

  // Validate against known registry/catalog
  const validIntents = intents.filter(
    (name) => hasSemanticIntent(name) || getIntentCatalog()[name],
  );

  const finalIntents = validIntents.length > 0 ? validIntents : intents;

  return {
    intents: finalIntents,
    theme,
    variant,
    matchedPhrases,
    unmatchedWords,
    ignoredStopWords,
  };
}

export function parseDescriptionToIntents(description: string): string[] {
  return parseDescription(description).intents;
}

export function isKnownDescriptionWord(word: string): boolean {
  return word.toLowerCase() in DEFAULT_DICTIONARY;
}

export function extendDictionary(additions: Record<string, string>): void {
  Object.assign(DEFAULT_DICTIONARY, additions);
}

export function getDictionary(): Record<string, string> {
  return { ...DEFAULT_DICTIONARY };
}
