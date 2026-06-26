// src/compiler/css-if-transpiler.ts
/**
 * CSS if() Transpiler
 * Detects conditional style patterns and emits:
 *   1. Native CSS if() — Chrome 137+
 *   2. @supports fallback — Firefox, Safari
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

/**
 * Detect conditional patterns from _conditions metadata.
 * When chain.when() branches set the same property to different values,
 * those can be compiled to CSS if().
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

/**
 * Generate CSS if() output for detected conditions.
 */
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
    for (const [condition, val] of Object.entries(cond.conditions)) {
      const modClass = selector + '--' + cond.variable.replace('--', '') + '-' + condition;
      css += '  ' + modClass + ' { ' + cond.property + ': ' + val + '; }\n';
    }
  }
  css += '}\n';

  return css;
}

export default { detectIfPatterns, emitCSSIf };
