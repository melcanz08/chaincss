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
  if (!selector) return "";
  return selector
    .split(",")
    .map((s) => appendModifierToSingleSelector(s.trim(), modifier))
    .join(", ");
}

function appendModifierToSingleSelector(
  selector: string,
  modifier: string
): string {
  if (!selector) return "";

  // Sanitize modifier to ensure valid CSS class name format
  const formattedMod = modifier.startsWith(".")
    ? modifier
    : modifier.startsWith("--")
    ? `.${modifier.slice(2)}`
    : `.${modifier}`;

  // Balance parentheses to safely isolate trailing pseudo-classes/elements
  let pseudoIndex = selector.length;
  let parenDepth = 0;

  for (let i = selector.length - 1; i >= 0; i--) {
    const char = selector[i];
    if (char === ")") parenDepth++;
    else if (char === "(") parenDepth--;
    else if (parenDepth === 0 && char === ":" && i > 0 && selector[i - 1] !== "\\") {
      // Look back to verify this colon marks a pseudo element/class start
      pseudoIndex = i;
    } else if (parenDepth === 0 && /[\s>+~]/.test(char)) {
      break;
    }
  }

  const base = selector.slice(0, pseudoIndex);
  const pseudos = selector.slice(pseudoIndex);

  // Split base by combinators (\s, >, +, ~)
  const parts = base.split(/(\s+|\s*>\s*|\s*\+\s*|\s*~\s*)/);

  // Find last non-combinator segment
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && !/^\s*$/.test(part) && !/^\s*[>+~]\s*$/.test(part)) {
      if (part.includes(".")) {
        // Compound class handling: append modifier to the last class in sequence
        const lastDotIdx = part.lastIndexOf(".");
        parts[i] = part.slice(0, lastDotIdx) + part.slice(lastDotIdx) + formattedMod;
      } else {
        // Tag or ID selector: append modifier as a class attachment (e.g., div.modifier)
        parts[i] = part + formattedMod;
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
  styles: Record<string, any>
): DetectedCondition[] {
  const conditions: DetectedCondition[] = [];
  if (!styles || typeof styles !== "object" || !styles._conditions) {
    return conditions;
  }

  for (const [rawVar, branchObj] of Object.entries(styles._conditions)) {
    if (!branchObj || typeof branchObj !== "object") continue;

    const variable = rawVar.startsWith("--") ? rawVar : `--${rawVar}`;
    const branches = branchObj as Record<string, Record<string, any>>;

    // Map properties across all conditional branches
    const propertyMap = new Map<string, Record<string, any>>();

    for (const [condKey, branchStyles] of Object.entries(branches)) {
      if (!branchStyles || typeof branchStyles !== "object") continue;

      for (const [prop, val] of Object.entries(branchStyles)) {
        if (prop.startsWith("_") || prop === "selectors") continue;
        if (!propertyMap.has(prop)) {
          propertyMap.set(prop, {});
        }
        propertyMap.get(prop)![condKey] = val;
      }
    }

    for (const [prop, condValues] of propertyMap.entries()) {
      // Check if all condition values are the same
      const uniqueValues = new Set(Object.values(condValues));
      if (uniqueValues.size <= 1) continue; // skip — no actual variation
      
      // Determine default value: check explicit false/default branch or root style property
      const defaultValue =
        condValues.false ??
        condValues.default ??
        styles[prop] ??
        "initial";

      const activeConditions: Record<string, string | number> = {};
      for (const [condKey, val] of Object.entries(condValues)) {
        if (condKey !== "false" && condKey !== "default") {
          activeConditions[condKey] = val;
        }
      }

      if (Object.keys(activeConditions).length > 0) {
        conditions.push({
          property: prop,
          variable,
          conditions: activeConditions,
          defaultValue,
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
  baseProperties: Record<string, string | number> = {}
): string {
  if (!detectedConditions || detectedConditions.length === 0) return "";

  let css = "";

  // 1. Native CSS if() block - Compliant with W3C CSS Values Level 5 spec
  css += "/* Native CSS if() — CSS Values Level 5 compliant */\n";
  css += `${selector} {\n`;

  for (const [prop, value] of Object.entries(baseProperties)) {
    css += `  ${prop}: ${value};\n`;
  }

  for (const cond of detectedConditions) {
    const entries = Object.entries(cond.conditions);
    const conditionParts: string[] = [];

    for (const [condition, val] of entries) {
      conditionParts.push(`style(${cond.variable}: ${condition}): ${val}`);
    }
    conditionParts.push(`else: ${cond.defaultValue}`);

    css += `  ${cond.property}: if(${conditionParts.join("; ")});\n`;
  }
  css += "}\n\n";

  // 2. Structural @supports fallback block
  css += "/* Fallback for browsers without CSS if() support */\n";
  css += "@supports not (margin: if(style(--a: b): 0; else: 0)) {\n";

  // Emit fallback default property values only
  css += `  ${selector} {\n`;
  for (const cond of detectedConditions) {
    css += `    ${cond.property}: ${cond.defaultValue};\n`;
  }
  css += "  }\n";

  // Emit state modifier rule overrides
  for (const cond of detectedConditions) {
    const cleanVar = cond.variable.replace(/^--/, "");
    for (const [condition, val] of Object.entries(cond.conditions)) {
      const modifier = `${cleanVar}-${condition}`;
      const modSelector = appendModifierToLastClass(selector, modifier);
      css += `  ${modSelector} { ${cond.property}: ${val}; }\n`;
    }
  }
  css += "}\n";

  return css;
}

export default { detectIfPatterns, emitCSSIf, appendModifierToLastClass };
