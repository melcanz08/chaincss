// src/compiler/utils/entangle.ts
// Wires chain().entangle('scroll' | 'peerDim' | 'group:...' | 'token:...') to native CSS
// Zero runtime. All outputs are pure CSS.

import { createScrollTimeline } from "../pipeline/normalizers/scroll-timeline.js";

export type EntangleType =
  | "scroll"
  | "view"
  | "peerDim"
  | "group"
  | `group:${string}`
  | `token:${string}`
  | `contrast:${string}`
  | "state"
  | `state:${string}`
  | "focus"
  | "hasCount";

export interface EntangleOptions {
  // scroll/view
  range?: string;
  y?: string;
  x?: string;
  opacity?: string | number;
  scale?: string | number;
  timeline?: "scroll" | "view";
  axis?: "block" | "inline";
  // peerDim
  dimOpacity?: number;
  blur?: string;
  selector?: string; // Overrides hardcoded class contexts
  // group
  sync?: string[];
  group?: string;
  span?: string | number;
  // token
  tokenPath?: string;
  // state & focus elements
  styles?: Record<string, string | number | undefined>;
  targetSelector?: string;
  // hasCount
  count?: number;
  // generic
  [key: string]: any;
}

export interface NestedRule {
  selector: string;
  styles: Record<string, string | number | undefined>;
}

export interface EntangleMeta {
  type: string;
  opts: EntangleOptions;
  native: boolean;
  groupName?: string;
  cssVar?: string;
  tokenPath?: string;
}

export interface StyleContext {
  _selector?: string;
  _nativeCSS?: string[];
  _entangle?: EntangleMeta[];
  _entangleMeta?: { type: string; groupName: string; sync: string[] };
  _needsContrastCheck?: boolean;
  willChange?: string;
  transform?: string;
  transition?: string;
  gridRow?: string;
  containerType?: string;
  nestedRules?: NestedRule[];
  [key: string]: any;
}

// --- Module-scoped Security Regex Constants ---
const SAFE_TOKEN_PATH_RE = /^[a-zA-Z0-9._-]+$/;
const SAFE_STATE_NAME_RE = /[^a-zA-Z0-9_-]/g;
const SAFE_SELECTOR_RE = /^[a-zA-Z0-9_.#:\s>+~*[\]="'\-()]+$/;
const DISALLOWED_SELECTOR_CHARS_RE = /[{};]/;

// --- Security Helpers ---
function toSafeTokenPath(p: string): string {
  const cleanPath = p.startsWith("$") ? p.slice(1) : p;
  if (!SAFE_TOKEN_PATH_RE.test(cleanPath)) {
    throw new Error(`Invalid token: ${p}`);
  }
  return cleanPath;
}

function toSafeStateName(s: string): string {
  const clean = s.replace(SAFE_STATE_NAME_RE, "");
  if (!clean) throw new Error(`Invalid state: ${s}`);
  return clean;
}

function toSafeSelector(sel: string, fallback: string): string {
  return SAFE_SELECTOR_RE.test(sel) && !DISALLOWED_SELECTOR_CHARS_RE.test(sel)
    ? sel
    : fallback;
}

/**
 * Main entry for chain().entangle(type, opts)
 * Called from chain builder: chainEntangle.call(styleCtx, type, opts)
 */
export function entangle(
  type: string,
  opts: EntangleOptions = {},
  ctx: StyleContext,
): void {
  if (type.startsWith("group:")) {
    const groupName = type.slice(6);
    return entangleGroup(groupName, opts, ctx);
  }
  if (type.startsWith("token:") || type.startsWith("$")) {
    const tokenPath = type.startsWith("token:") ? type.slice(6) : type;
    return entangleToken(tokenPath, opts, ctx);
  }
  if (type.startsWith("state:")) {
    const stateName = toSafeStateName(type.slice(6));
    return entangleState(stateName, opts, ctx);
  }
  if (type.startsWith("contrast:")) {
    return entangleContrast(ctx);
  }

  switch (type) {
    case "scroll":
    case "view":
      return entangleScroll({ ...opts, timeline: type as any }, ctx);
    case "peerDim":
      return entanglePeerDim(opts, ctx);
    case "group":
      return entangleGroup(opts.group || "default", opts, ctx);
    case "focus":
      return entangleFocus(opts, ctx);
    case "hasCount":
      return entangleHasCount(opts, ctx);
    default:
      (ctx._entangle ??= []).push({ type, opts, native: false });
      return;
  }
}

// --- Implementations ---

function entangleScroll(opts: EntangleOptions, ctx: StyleContext): void {
  const selector = ctx._selector || ":root";
  const result = createScrollTimeline(selector, {
    range: opts.range,
    y: opts.y as string,
    x: opts.x as string,
    opacity: String(opts.opacity ?? ""),
    scale: String(opts.scale ?? ""),
    timeline: opts.timeline || "view",
    axis: opts.axis as any,
  });

  (ctx._nativeCSS ??= []).push(result.css);

  // Deduplicate willChange properties
  const existingWillChange = ctx.willChange
    ? ctx.willChange.split(",").map((s) => s.trim())
    : [];
  const propsToAdd = ["transform", "opacity"].filter(
    (p) => !existingWillChange.includes(p),
  );

  if (propsToAdd.length > 0) {
    ctx.willChange =
      existingWillChange.length > 0
        ? `${ctx.willChange}, ${propsToAdd.join(", ")}`
        : propsToAdd.join(", ");
  }

  ctx.transform ||= "translateZ(0)";
}

function entanglePeerDim(opts: EntangleOptions, ctx: StyleContext): void {
  const opacity = opts.opacity ?? opts.dimOpacity ?? 0.6;
  const scale = opts.scale ?? 1;
  const baseGroup = toSafeSelector(opts.selector || ".group", ".group");

  (ctx.nestedRules ??= []).push({
    selector: `${baseGroup}:has(> :hover) > &:not(:hover)`,
    styles: {
      opacity,
      filter: opts.blur ? `blur(${opts.blur})` : "none",
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      transition: "opacity .25s ease, transform .25s ease, filter .25s ease",
    },
  });

  ctx.transition ??= "transform .2s ease, opacity .2s ease, box-shadow .2s ease";
}

function entangleGroup(
  groupName: string,
  opts: EntangleOptions,
  ctx: StyleContext,
): void {
  if (opts.sync?.includes("height") || !opts.sync) {
    const rowSpan = opts.span ? `span ${opts.span}` : "span 3";
    ctx.gridRow ||= rowSpan;
    ctx._entangleMeta = {
      type: "group",
      groupName,
      sync: opts.sync || ["height"],
    };
  }

  (ctx._entangle ??= []).push({ type: "group", groupName, opts, native: true });
}

function entangleToken(
  tokenPath: string,
  opts: EntangleOptions,
  ctx: StyleContext,
): void {
  const safePath = toSafeTokenPath(tokenPath);
  const cssVar = `--${safePath.replace(/\./g, "-")}`;

  (ctx._entangle ??= []).push({
    type: "token",
    tokenPath: safePath,
    cssVar,
    opts,
    native: true,
  });

  ctx._needsContrastCheck = true;
}

function entangleState(
  rawStateName: string,
  opts: EntangleOptions,
  ctx: StyleContext,
): void {
  const stateName = toSafeStateName(rawStateName);
  const targetStyles = opts.styles || {};

  (ctx.nestedRules ??= []).push({
    selector: `[data-chain-${stateName}] &, [data-chain-state="${stateName}"] &`,
    styles: targetStyles,
  });
}

function entangleContrast(ctx: StyleContext): void {
  ctx._needsContrastCheck = true;
}

function entangleFocus(opts: EntangleOptions, ctx: StyleContext): void {
  const target = toSafeSelector(opts.targetSelector || "label", "label");
  const targetStyles = opts.styles || {
    transform: "translateY(-1.2rem) scale(0.85)",
    opacity: 1,
  };

  (ctx.nestedRules ??= []).push({
    selector: `&:focus-within ${target}, &:has(input:not(:placeholder-shown)) ${target}`,
    styles: targetStyles,
  });
}

function entangleHasCount(opts: EntangleOptions, ctx: StyleContext): void {
  const count = Math.max(1, Math.floor(Number(opts.count) || 3));
  const styles = opts.styles ?? {};

  (ctx.nestedRules ??= []).push({
    selector: `&:has(> :nth-child(${count}))`,
    styles,
  });
}

// --- Macro Transpiler Evaluator ---
export const entangleMacro = (v: unknown, c: StyleContext): void => {
  if (typeof v === "string") {
    return entangle(v, {}, c);
  }
  if (Array.isArray(v)) {
    const [type, opts] = v;
    if (typeof type === "string") {
      return entangle(type, opts || {}, c);
    }
  }
  if (
    v &&
    typeof v === "object" &&
    "type" in v &&
    typeof (v as { type: unknown }).type === "string"
  ) {
    const item = v as { type: string; [key: string]: any };
    return entangle(item.type, item, c);
  }
};