// src/compiler/pipeline/lowering/token-resolver.ts
import { recordHistory } from '../ir/utils.js';

import type { StyleIR } from '../ir/types.js';
import type { LoweringPass, LoweringResult } from '../pipeline-types.js';
import { createDeclaration } from '../ir/factory.js';
import { resolveSemantic } from '../../tokens/semantic-tokens.js';

/**
 * Resolve a $token.path.string to its value from a token store.
 * e.g., "$colors.primary" → "#6C63FF"
 * Also handles embedded tokens: "1px solid $colors.border" → "1px solid #2A2A4A"
 * And compound tokens: "$spacing.xs $spacing.sm" → "4px 8px"
 */
function resolveTokenPath(tokenPath: string, tokens: Record<string, any>): any {
  const path = tokenPath.startsWith('$') ? tokenPath.slice(1).split('.') : tokenPath.split('.');
  let current: any = tokens;
  for (const segment of path) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Resolve ALL $token references within a value string.
 * Handles: "$colors.primary", "$spacing.xs $spacing.sm", "1px solid $colors.border"
 */
function resolveAllTokens(value: string, tokens: Record<string, any>): { value: string; hadUnresolved: boolean } {
  // Find all $token references in the string.
  // Use matchAll instead of exec() with /g to avoid stale lastIndex bugs.
  let resolved = value;
  let hadUnresolved = false;
  const matches = [...value.matchAll(/\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g)];
  
  for (const match of matches) {
    const fullMatch = match[0];  // e.g., "$colors.primary"
    const tokenPath = match[1];  // e.g., "colors.primary"
    
    const resolved_value = resolveTokenPath(fullMatch, tokens);
    if (resolved_value !== undefined) {
      // Use split/join for replaceAll to handle duplicate tokens
      resolved = resolved.split(fullMatch).join(String(resolved_value));
    } else {
      hadUnresolved = true;
    }
  }
  
  return { value: resolved, hadUnresolved };
}


export const tokenLowering: LoweringPass = {
  name: 'token-resolver',

  generate(ir: StyleIR, context?: any): LoweringResult {
    let generatedNodes = 0;
    const tokens = context?.tokens || {};

    // Phase 1: Resolve $token references in declarations
    for (const rule of ir.rules) {
      for (const decl of rule.declarations) {
        if (typeof decl.value === 'string' && decl.value.includes('$')) {
          const { value: resolved, hadUnresolved } = resolveAllTokens(decl.value, tokens);
          if (!hadUnresolved) {
            const previous = decl.value;
            decl.value = resolved;
            recordHistory(decl, 'token-resolver', 'resolved-token', previous, `${previous} → ${resolved}`);
            generatedNodes++;
          } else {
            // Fallback: emit as CSS custom property for runtime resolution
            // e.g., $colors.primary → var(--colors-primary)
            // Convert unresolved $token to CSS custom property fallback
            // e.g., $colors.primary → var(--colors-primary)
            const fallback = decl.value.replace(
              /\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g,
              (_, path: string) => `var(--${path.replace(/\./g, '-')})`
            );
            if (fallback !== decl.value) {
              decl.value = fallback;
              generatedNodes++;
            }
            ir.diagnostics.push({
              id: `unresolved-token-${rule.id}-${decl.property}`,
              nodeId: rule.id,
              severity: 'warning',
              message: `Unresolved token: ${decl.value} → emitted as CSS variable`,
              suggestion: 'Add the token to chaincss.config.js or a createTheme() export',
              pass: 'token-resolver',
            });
          }
        }
      }
    }

    // Phase 1b: Resolve $token references in pseudo-class declarations (hover, focus, etc.)
    for (const rule of ir.rules) {
      if (rule.pseudoClasses) {
        for (const pc of rule.pseudoClasses) {
          for (const decl of pc.declarations) {
            if (typeof decl.value === 'string' && decl.value.includes('$')) {
              const { value: resolved, hadUnresolved: pcUnresolved } = resolveAllTokens(decl.value, tokens);
              if (!pcUnresolved && resolved !== decl.value) {
                const previous = decl.value;
                decl.value = resolved;
                recordHistory(decl, 'token-resolver', 'resolved-token', previous, `${previous} → ${resolved}`);
                generatedNodes++;
              }
            }
          }
        }
      }
    }

    // Phase 2: Resolve semantic intents (existing behavior)
    for (const rule of ir.rules) {
      const semanticIntents: Array<{ category: string; intent: string; theme?: any }> =
  (rule.meta._semantic as Array<{ category: string; intent: string; theme?: any }>) || [];

      // Track resolved properties to detect conflicts
      const resolvedProps = new Set<string>();

      for (const { category, intent, theme } of semanticIntents) {
        if (resolvedProps.has(`${category}:${intent}`)) continue; // Skip duplicate intents
        resolvedProps.add(`${category}:${intent}`);
        const resolved = resolveSemantic(category as any, intent, theme);
        if (!resolved) continue;

        for (const [prop, value] of Object.entries(resolved.properties)) {
          const decl = createDeclaration(prop, value);
          recordHistory(decl, 'token-resolver', 'resolved-token', undefined, `${category}:${intent} → ${prop}: ${value}`);
          decl.meta.semantic = { category, intent };

          if (resolved.pseudoClass) {
            let pc = rule.pseudoClasses.find(p => p.name === resolved.pseudoClass);
            if (!pc) {
              pc = {
                id: `token-pc-${rule.id}-${resolved.pseudoClass}`,
                name: resolved.pseudoClass!,
                declarations: [],
                source: rule.source,
                history: [],
              };
              rule.pseudoClasses.push(pc);
            }
            pc.declarations.push(decl);
          } else {
            rule.declarations.push(decl);
          }
          generatedNodes++;
        }
      }
    }

    return { ir, generatedNodes };
  },
};