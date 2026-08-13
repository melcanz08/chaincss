// ============================================================================
// FILE: src/compiler/pipeline/dynamic/dynamic-variable.ts
// Canonical dynamic CSS custom property naming.
// Single source of truth for parser, css-printer, and runtime adapter.
// ============================================================================

/**
 * Derive a CSS custom property name from a selector and property.
 * Matches the algorithm previously duplicated in style-compiler.ts.
 *
 * @example
 *   getDynamicVariableName(".chain-btn", "color") → "--chain-btn-color"
 *   getDynamicVariableName("#hero", "fontSize")  → "--hero-font-size"
 */
export function getDynamicVariableName(
  selector: string,
  property: string,
): string {
  const prefix = selector
    .replace(/^\./, "")
    .replace(/^#/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "chain-dynamic";

  const kebabProp = property.replace(/([A-Z])/g, "-$1").toLowerCase();

  return `--${prefix}-${kebabProp}`;
}