// src/compiler/pipeline/lowering/css-if-lowering.ts

/**
 * CSS if() Transpiler
 * 
 * Detects conditional style patterns and emits:
 *   1. Native CSS if() — Chrome 137+
 *   2. @supports fallback — Firefox, Safari
 * 
 * Selector handling: modifier flags are safely appended to the LAST
 * base class in a complex selector to avoid breaking descendant selectors.
 */

export interface IfCondition {
  property: string;
  variable: string;
  conditions: Record<string, string | number>;
  defaultValue: string | number;
}

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
 * Safely append a modifier to a CSS selector.
 * 
 * .card              → .card--modifier
 * .card .title       → .card .title--modifier
 * .btn:hover         → .btn--modifier:hover
 * .btn:focus         → .btn--modifier:focus
 * #app .card.active  → #app .card--modifier.active
 * ul > li            → ul > li--modifier
 * .a, .b             → .a--modifier, .b--modifier
 * 
 * The modifier is appended to the last base class segment BEFORE
 * any pseudo-classes or structural selectors.
 */
function appendModifierToLastClass(selector: string, modifier: string): string {
  // Split on commas (multiple selectors)
  return selector
    .split(',')
    .map(s => appendModifierToSingleSelector(s.trim(), modifier))
    .join(', ');
}

function appendModifierToSingleSelector(selector: string, modifier: string): string {
  // Extract pseudo-classes from the end
  const pseudoMatch = selector.match(/^(.+?)((?::[a-zA-Z-]+(?:\([^)]*\))?)*)$/);
  
  if (!pseudoMatch) return selector + modifier;
  
  let base = pseudoMatch[1];
  const pseudos = pseudoMatch[2] || '';

  // Find the last class or element in the base
  const parts = base.split(/(\s+|\s*>\s*|\s*\+\s*|\s*~\s*)/);
  
  // Walk backwards to find the last non-whitespace, non-combinator segment
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && !part.match(/^\s*$/) && !part.match(/^\s*[>+~]\s*$/)) {
      if (part.startsWith('.')) {
        parts[i] = part + modifier;
      } else {
        parts[i] = part + modifier;
      }
      break;
    }
  }

  return parts.join('') + pseudos;
}

// ============================================================================
// Detection
// ============================================================================

/**
 * Detect conditional patterns from _conditions metadata.
 */
export function detectIfPatterns(
  styles: Record<string, any>
): DetectedCondition[] {
  const conditions: DetectedCondition[] = [];
  if (!styles._conditions) return conditions;

  const condEntries = Object.entries(styles._conditions || {});
  for (const [variable, branches] of condEntries) {
    const branch = branches as { true: Record<string, any>; false: Record<string, any> };
    const trueStyles = branch.true || {};
    const falseStyles = branch.false || {};

    const allProps = new Set([...Object.keys(trueStyles), ...Object.keys(falseStyles)]);
    for (const prop of allProps) {
      if (prop.startsWith('_') || prop === 'selectors') continue;
      const trueVal = trueStyles[prop];
      const falseVal = falseStyles[prop];
      if (trueVal !== undefined && falseVal !== undefined && trueVal !== falseVal) {
        conditions.push({
          property: prop,
          variable: variable.startsWith('--') ? variable : '--' + variable,
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
  baseProperties: Record<string, string | number> = {}
): string {
  if (detectedConditions.length === 0) return '';

  let css = '';

  // Native CSS if() block
  css += '/* Native CSS if() — Chrome 137+ */\n';
  css += selector + ' {\n';
  for (const [prop, value] of Object.entries(baseProperties)) {
    css += '  ' + prop + ': ' + value + ';\n';
  }
  for (const cond of detectedConditions) {
    const entries = Object.entries(cond.conditions);
    if (entries.length === 1) {
      const [condition, val] = entries[0];
      css += '  ' + cond.property + ': if(style(' + cond.variable + ': ' + condition + '): ' + val + ' else ' + cond.defaultValue + ');\n';
    } else {
      let chain = '';
      for (let i = 0; i < entries.length; i++) {
        const [condition, val] = entries[i];
        chain += i === 0
          ? 'if(style(' + cond.variable + ': ' + condition + '): ' + val
          : ' else if(style(' + cond.variable + ': ' + condition + '): ' + val;
      }
      chain += ' else ' + cond.defaultValue + ')'.repeat(entries.length);
      css += '  ' + cond.property + ': ' + chain + ';\n';
    }
  }
  css += '}\n\n';

  // @supports fallback
  css += '/* Fallback for browsers without CSS if() */\n';
  css += '@supports not (property: if()) {\n';
  css += '  ' + selector + ' {\n';
  for (const [prop, value] of Object.entries(baseProperties)) {
    css += '    ' + prop + ': ' + value + ';\n';
  }
  for (const cond of detectedConditions) {
    css += '    ' + cond.property + ': ' + cond.defaultValue + ';\n';
  }
  css += '  }\n';
  for (const cond of detectedConditions) {
    const cleanVar = cond.variable.replace(/^--/, '');
    for (const [condition, val] of Object.entries(cond.conditions)) {
      const modifier = '--' + cleanVar + '-' + condition;
      const modSelector = appendModifierToLastClass(selector, modifier);
      css += '  ' + modSelector + ' { ' + cond.property + ': ' + val + '; }\n';
    }
  }
  css += '}\n';

  return css;
}

export default { detectIfPatterns, emitCSSIf };
