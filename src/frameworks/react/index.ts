// src/frameworks/react/index.tsx 

// — Zero-leak, concurrent-safe React runtime
// Uses CSS custom properties instead of DOM injection for dynamic styles.
// No textContent mutation, no memory leaks, React concurrent-mode safe.

import React, { useMemo, useEffect, createContext, useContext } from "react";
import type { UseChainStylesOptions } from "@shared/types/index.js";
import { kebabCase } from "../core/utils.js";

const toKebabCase = kebabCase;

interface StyleDefinition {
  className?: string;
  selectors?: string[];
  dynamic?: Record<string, Function>;
  [key: string]: any;
}

// ============================================================================
// useChainStyles — evaluates dynamic functions and returns CSS custom properties
// ============================================================================

/**
 * Evaluates dynamic functions and returns CSS custom property values.
 *
 * Takes style objects from chain.dynamic().$el() and:
 * 1. Extracts className for each style
 * 2. Calls dynamic functions with merged context (theme + deps)
 * 3. Returns CSS custom properties as styleVars
 *
 * @param styles - Style definitions from .chain.ts files
 * @param deps - Component state/props passed to dynamic functions as context
 * @param options - Additional options
 *
 * @example
 * ```tsx
 * const { classes, styleVars } = useChainStyles(
 *   { themeToggle, counterBadge },
 *   { isDark, count }  // Passed to dynamic functions as (ctx)
 * );
 * // Inside themeToggle's dynamic function: (ctx) => ctx.isDark ? '#333' : '#fff'
 * ```
 */
export function useChainStyles(
  styles: Record<string, StyleDefinition>,
  deps: Record<string, any> = {},
  options: UseChainStylesOptions = {},
): {
  classes: Record<string, string>;
  styleVars: Record<string, string>;
  cx: (...names: any[]) => string;
  cn: (...names: any[]) => string;
} {
  const depValues = Object.values(deps);

  return useMemo(() => {
    const classes: Record<string, string> = {};
    const styleVars: Record<string, string> = {};
    const context = { ...deps };

    for (const [key, styleObj] of Object.entries(styles)) {
      if (!styleObj) continue;

      const baseClass =
        styleObj.className ||
        styleObj.selectors?.[0]?.replace(/^\./, "") ||
        key;
      classes[key] = baseClass;

      if (styleObj.dynamic) {
        // Process ALL entries in dynamic
        for (const [prop, value] of Object.entries(styleObj.dynamic)) {
          // Skip internal keys
          if (prop.startsWith('_')) continue;

          // ============================================
          // CASE 1: Base dynamic property (function)
          // ============================================
          if (typeof value === "function") {
            try {
              const result = (value as Function)(context);
              const cleanProp = toKebabCase(prop);
              const varName = `--${baseClass}-${cleanProp}`;
              if (result !== undefined && result !== null) {
                styleVars[varName] = String(result);
              }
            } catch (err) {
              if (options.debug) {
                console.warn(`[ChainCSS] Error evaluating "${key}.${prop}":`, err);
              }
            }
          }
          // ============================================
          // CASE 2: Pseudo-class object ('&:hover', 'hover', etc.)
          // ============================================
          else if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Extract pseudo name from '&:hover' or 'hover'
            const pseudoName = prop.replace(/^&:/, '').replace(/^:/, '');
            
            // Process nested dynamic properties in the pseudo-class
            for (const [nestedProp, nestedValue] of Object.entries(value)) {
              if (nestedProp.startsWith('_')) continue;
              
              if (typeof nestedValue === "function") {
                try {
                  const result = (nestedValue as Function)(context);
                  const cleanProp = toKebabCase(nestedProp);
                  const varName = `--${baseClass}-${pseudoName}-${cleanProp}`;
                  if (result !== undefined && result !== null) {
                    styleVars[varName] = String(result);
                  }
                } catch (err) {
                  if (options.debug) {
                    console.warn(`[ChainCSS] Error evaluating "${key}.${pseudoName}.${nestedProp}":`, err);
                  }
                }
              }
            }
          }
        }
      }
    }

    return { classes, styleVars, cx, cn: cx };
  }, [...depValues]);
}

/**
 * Convenience hook that merges classes and styleVars for direct use.
 * Returns className string and style object ready for JSX.
 */
export function useChainStylesApplied(
  styles: Record<string, StyleDefinition>,
  deps: Record<string, any> = {},
  options?: UseChainStylesOptions,
): { className: string; style: Record<string, string> } {
  const { classes, styleVars } = useChainStyles(styles, deps, options);

  return {
    className: [...new Set(Object.values(classes))].filter(Boolean).join(" "),
    style: styleVars,
  };
}

// Legacy support: convert array deps to object
export function useDynamicChainStyles(s: any, d: any[], o?: any) {
  // Convert array to object using indices as keys (backward compat)
  const depsObj: Record<string, any> = {};
  d.forEach((val, i) => {
    depsObj[`arg${i}`] = val;
  });
  return useChainStyles(s, depsObj, { ...o, watch: true });
}

export function useThemeChainStyles(t: any, s: any, d: any[]) {
  const depsObj: Record<string, any> = { ...t };
  d.forEach((val, i) => {
    depsObj[`arg${i}`] = val;
  });
  return useChainStyles(s, depsObj);
}

// ============================================================================
// ChainCSSGlobal — inject global styles with cleanup
// ============================================================================

export function ChainCSSGlobal({ styles, children }: any) {
  const serializedStyles = useMemo(() => {
    if (typeof styles === "string") return styles;
    if (typeof styles === "object" && styles !== null) {
      try {
        return JSON.stringify(styles);
      } catch {
        return "";
      }
    }
    return "";
  }, [styles]);

  useEffect(() => {
    if (!serializedStyles) return;
    const el = document.createElement("style");
    el.setAttribute("data-chaincss", "global");

    if (typeof styles === "string") {
      el.textContent = styles;
    } else if (typeof styles === "object") {
      el.textContent = Object.entries(styles as Record<string, any>)
        .map(([_, def]) => {
          if (!def?.selectors) return "";
          const props = Object.entries(def)
            .filter(
              ([k, v]) =>
                !k.startsWith("_") &&
                k !== "selectors" &&
                typeof v !== "object",
            )
            .map(
              ([k, v]) =>
                `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`,
            )
            .join("\n");
          return `${def.selectors.join(", ")} {\n${props}\n}`;
        })
        .filter(Boolean)
        .join("\n");
    }

    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [serializedStyles]);

  return children || null;
}

// ============================================================================
// cx — ClassName utility
// ============================================================================

export function cx(...classes: any[]): string {
  return classes
    .flatMap((c) => {
      if (!c) return [];
      if (typeof c === "string") return [c];
      if (typeof c === "object") {
        if (c.className) return [c.className];
        return Object.entries(c)
          .filter(([_, v]) => v)
          .map(([k]) => k);
      }
      return [];
    })
    .join(" ");
}

// ============================================================================
// createStyledComponent
// ============================================================================

const styledComponentCache = new Map<string, any>();

export function createStyledComponent(
  tag: string = "div",
  baseStyle?: any,
): any {
  const cacheKey = `${tag}:${baseStyle?.className || baseStyle?.selectors?.[0] || "div"}`;

  if (styledComponentCache.has(cacheKey)) {
    return styledComponentCache.get(cacheKey);
  }

  const cn =
    baseStyle?.className || baseStyle?.selectors?.[0]?.replace(/^\./, "") || "";

  const StyledComponent = React.forwardRef((props: any, ref: any) => {
    const { class: omitClass, className, ...restProps } = props;

    return React.createElement(tag || "div", {
      ...restProps,
      ref,
      className: cx(cn, className, omitClass),
    });
  });

  StyledComponent.displayName = `ChainCSSStyled(${tag})`;
  styledComponentCache.set(cacheKey, StyledComponent);

  return StyledComponent;
}

export function createStyledComponents(comps: any): any {
  const r: any = {};
  for (const [n, c] of Object.entries(comps)) {
    r[n] = createStyledComponent(
      (c as any).element || "div",
      (c as any).styles,
    );
  }
  return r;
}

// ============================================================================
// withChainStyles HOC
// ============================================================================

export function withChainStyles<P extends object>(
  Component: React.ComponentType<P>,
  styles: any,
): React.FC<P> {
  function WrappedComponent(props: P) {
    const { classes, styleVars } = useChainStyles(styles);
    return React.createElement(Component, {
      ...props,
      classes,
      styleVars,
    } as any);
  }
  WrappedComponent.displayName = `withChainStyles(${
    Component.displayName || Component.name || "Component"
  })`;
  return WrappedComponent as React.FC<P>;
}

// ============================================================================
// useComputedStyles
// ============================================================================

export function useComputedStyles<T extends Record<string, any>>(
  s: T,
  d: Record<string, any> = {},
) {
  return useChainStyles(s as any, d);
}

// ============================================================================
// Debug
// ============================================================================

let debugEnabled = false;
export function enableChainCSSDebug() {
  debugEnabled = true;
}
export function disableChainCSSDebug() {
  debugEnabled = false;
}
export function isDebugEnabled() {
  return debugEnabled;
}
