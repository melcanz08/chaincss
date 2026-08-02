// ============================================================================
// FILE: src/compiler/pipeline/lowering/token-lowering.ts
// ============================================================================

import { recordHistory } from '../ir/utils.js';
import type { StyleIR } from '../ir/types.js';
import type { LoweringPass, LoweringResult } from '../pipeline-types.js';
import { createDeclaration } from '../ir/index.js';
import { resolveSemantic } from '../../tokens/semantic-tokens.js';
// Pull in the core contract system safely
import { TokenResolver } from '../../tokens/token-resolver.js';

export interface TokenLoweringOptions {
  inlineLiterals?: boolean;
  activeTheme?: string;
}

/**
 * Resolve a token path string using the centralized contract resolver.
 */
function resolveTokenPath(tokenPath: string, resolver: TokenResolver, activeTheme?: string): string | undefined {
  const path = tokenPath.startsWith('$') ? tokenPath.slice(1) : tokenPath;
  // Use the formal token contract methods instead of arbitrary object lookups
  return resolver.getLiteralValue(path, activeTheme);
}

/**
 * Resolve ALL $token references within a value string.
 */
function resolveAllTokens(
  value: string, 
  resolver: TokenResolver, 
  activeTheme?: string
): { value: string; hadUnresolved: boolean } {
  let resolved = value;
  let hadUnresolved = false;
  
  const matches = [...value.matchAll(/\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g)];
  
  for (const match of matches) {
    const fullMatch = match[0];
    const resolvedValue = resolveTokenPath(fullMatch, resolver, activeTheme);
    
    if (resolvedValue !== undefined) {
      resolved = resolved.split(fullMatch).join(String(resolvedValue));
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
    
    // Initialize or fallback to a blank token resolver instance safely
    const tokenContract = context?.tokenContract || {};
    const resolver = new TokenResolver(tokenContract);
    const options: TokenLoweringOptions = context?.options || {};

    if (!ir || !ir.rules) return { ir, generatedNodes };

    // Phase 1: Resolve $token references in structural declarations
    for (const rule of ir.rules) {
      if (!rule.declarations) continue;
      
      for (const decl of (rule.declarations || [])) {
        if (typeof decl.value === 'string' && decl.value.includes('$')) {
          const originalRawValue = decl.value;
          
          if (options.inlineLiterals) {
            const { value: resolved, hadUnresolved } = resolveAllTokens(originalRawValue, resolver, options.activeTheme);
            
            if (!hadUnresolved) {
              decl.value = resolved;
              recordHistory(decl, 'token-resolver', 'resolved-token', originalRawValue, `${originalRawValue} → ${resolved}`);
              generatedNodes++;
              continue;
            }
          }

          // Default Fallback: Lower to clean CSS Custom Variables natively
          const fallback = originalRawValue.replace(
            /\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g,
            (match: string, rawPath: string) => {
              const checked = resolveTokenPath(match, resolver, options.activeTheme);
              if (options.inlineLiterals && checked !== undefined) {
                return String(checked);
              }
              // Translates 'colors.primary' into '--colors-primary'
              return `var(--${rawPath.replace(/\./g, '-')})`;
            }
          );
          
          if (fallback !== originalRawValue) {
            decl.value = fallback;
            generatedNodes++;
          }
          
          // Only log a warning if we explicitly wanted static inlining but paths were broken
          const checkUnresolved = resolveAllTokens(originalRawValue, resolver, options.activeTheme);
          if (checkUnresolved.hadUnresolved) {
            ir.diagnostics.push({
              id: `unresolved-token-${rule.id}-${decl.property}`,
              nodeId: rule.id,
              severity: 'warning',
              message: `Unresolved token string: ${originalRawValue} → emitted as CSS variable`,
              suggestion: 'Verify that the key footprint is defined inside your active theme contract.',
              pass: 'token-resolver',
            });
          }
        }
      }
    }

    // Phase 1b: Resolve $token references in pseudo-class rules safely
    for (const rule of ir.rules) {
      if (!rule.pseudoClasses) continue;
      
      for (const pc of (rule.pseudoClasses || [])) {
        if (!pc.declarations) continue;
        for (const decl of pc.declarations) {
          if (typeof decl.value === 'string' && decl.value.includes('$')) {
            const originalRawValue = decl.value;
            
            const fallback = originalRawValue.replace(
              /\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g,
              (match: string, rawPath: string) => {
                const checked = resolveTokenPath(match, resolver, options.activeTheme);
                if (options.inlineLiterals && checked !== undefined) return String(checked);
                return `var(--${rawPath.replace(/\./g, '-')})`;
              }
            );

            if (fallback !== originalRawValue) {
              decl.value = fallback;
              recordHistory(decl, 'token-resolver', 'resolved-token', originalRawValue, `${originalRawValue} → ${fallback}`);
              generatedNodes++;
            }
          }
        }
      }
    }

    // Phase 2: Resolve semantic layout intents
    for (const rule of ir.rules) {
      const semanticIntents = (
        rule.passMeta?.analysis?.semantic?.tokens ??
        rule.meta?._semantic ??
        []
      ) as Array<{ category: string; intent: string; theme?: any }>;
      const resolvedProps = new Set<string>();

      if (!rule.pseudoClasses) {
        rule.pseudoClasses = [];
      }

      for (const { category, intent, theme } of semanticIntents) {
        const intentKey = `${category}:${intent}`;
        if (resolvedProps.has(intentKey)) continue; 
        resolvedProps.add(intentKey);
        
        const resolved = resolveSemantic(category as any, intent, theme);
        if (!resolved || !resolved.properties) continue;

        for (const [prop, value] of Object.entries(resolved.properties)) {
          const decl = createDeclaration(prop, value);
          recordHistory(decl, 'token-resolver', 'resolved-token', undefined, `${category}:${intent} → ${prop}: ${value}`);
          
          if (!decl.meta) decl.meta = {};
          decl.meta.semantic = { category, intent };

          if (resolved.pseudoClass) {
            let pc = rule.pseudoClasses.find(p => p.name === resolved.pseudoClass);
            if (!pc) {
              pc = {
                id: `token-pc-${rule.id}-${resolved.pseudoClass}`,
                name: resolved.pseudoClass!,
                parentId: rule.id,
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