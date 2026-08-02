// ============================================================================
// FILE: src/compiler/pipeline/lowering/css-if-lowering.ts
// ============================================================================

export interface DetectedCondition {
  property: string;
  variable: string;
  conditions: Record<string, string | number>;
  defaultValue: string | number;
}

// ============================================================================
// Selector Utilities
// ============================================================================

/**
 * Safely appends a modifier to a CSS selector.
 * Preserves pseudo-classes, pseudo-elements, and handles chained compound classes.
 */
function appendModifierToLastClass(selector: string, modifier: string): string {
  return selector
    .split(",")
    .map((s) => appendModifierToSingleSelector(s.trim(), modifier))
    .join(", ");
}

function appendModifierToSingleSelector(
  selector: string,
  modifier: string,
): string {
  // Isolate pseudo-elements and pseudo-classes at the end of the selector string
  const pseudoMatch = selector.match(
    /^(.+?)((?:::[a-zA-Z-]+|:[a-zA-Z-]+(?:\([^)]*\))?)*)$/,
  );

  if (!pseudoMatch) return selector + modifier;

  const base = pseudoMatch[1];
  const pseudos = pseudoMatch[2] || "";

  // Split selector tokens by common CSS structural combinators
  const parts = base.split(/(\s+|\s*>\s*|\s*\+\s*|\s*~\s*)/);

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && !part.match(/^\s*$/) && !part.match(/^\s*[>+~]\s*$/)) {
      // If compound classes exist (e.g. .card.active), target the base class segment instead of the state modifier
      if (part.includes(".")) {
        const classes = part.split(".");
        // classes[0] might be an element name (e.g., div) or empty string if it started with a dot
        if (classes.length > 1) {
          classes[1] = classes[1] + modifier;
          parts[i] = classes.join(".");
        } else {
          parts[i] = part + modifier;
        }
      } else {
        parts[i] = part + modifier;
      }
      break;
    }
  }

  return parts.join("") + pseudos;
}

// ============================================================================
// Detection
// ============================================================================

export function detectIfPatterns(
  styles: Record<string, any>,
): DetectedCondition[] {
  const conditions: DetectedCondition[] = [];
  if (!styles || !styles._conditions) return conditions;

  for (const [variable, branches] of Object.entries(styles._conditions)) {
    if (!branches || typeof branches !== "object") continue;

    const branch = branches as {
      true?: Record<string, any>;
      false?: Record<string, any>;
    };
    const trueStyles = branch.true || {};
    const falseStyles = branch.false || {};

    const champions = new Set([
      ...Object.keys(trueStyles),
      ...Object.keys(falseStyles),
    ]);
    for (const prop of champions) {
      if (prop.startsWith("_") || prop === "selectors") continue;

      const trueVal = trueStyles[prop];
      const falseVal = falseStyles[prop];

      if (
        trueVal !== undefined &&
        falseVal !== undefined &&
        trueVal !== falseVal
      ) {
        conditions.push({
          property: prop,
          variable: variable.startsWith("--") ? variable : "--" + variable,
          conditions: { true: trueVal },
          defaultValue: falseVal,
        });
      }
    }
  }
  return conditions;
}

// ============================================================================
// CSS Emission
// ============================================================================

export function emitCSSIf(
  selector: string,
  detectedConditions: DetectedCondition[],
  baseProperties: Record<string, string | number> = {},
): string {
  if (!detectedConditions || detectedConditions.length === 0) return "";

  let css = "";

  // 1. Native CSS if() block — Compliant with CSS Values Level 5 flat specification format
  css += "/* Native CSS if() — Chrome 137+ compliant */\n";
  css += `${selector} {\n`;
  for (const [prop, value] of Object.entries(baseProperties)) {
    css += `  ${prop}: ${value};\n`;
  }
  for (const cond of detectedConditions) {
    const entries = Object.entries(cond.conditions);
    let conditionChain = "";

    for (const [condition, val] of entries) {
      conditionChain += `style(${cond.variable}: ${condition}): ${val}; `;
    }
    conditionChain += `else: ${cond.defaultValue}`;
    css += `  ${cond.property}: if(${conditionChain});\n`;
  }
  css += "}\n\n";

  // 2. Structural @supports fallback block using functional evaluation rules
  css += "/* Fallback for browsers without CSS if() */\n";
  css += "@supports not (margin: if(style(--a: b): 0; else: 0)) {\n";
  css += `  ${selector} {\n`;
  for (const [prop, value] of Object.entries(baseProperties)) {
    css += `    ${prop}: ${value};\n`;
  }
  for (const cond of detectedConditions) {
    css += `    ${cond.property}: ${cond.defaultValue};\n`;
  }
  css += "  }\n";

  for (const cond of detectedConditions) {
    const cleanVar = cond.variable.replace(/^--/, "");
    for (const [condition, val] of Object.entries(cond.conditions)) {
      const modifier = `--${cleanVar}-${condition}`;
      const modSelector = appendModifierToLastClass(selector, modifier);
      css += `  ${modSelector} { ${cond.property}: ${val}; }\n`;
    }
  }
  css += "}\n";

  return css;
}

export default { detectIfPatterns, emitCSSIf };
