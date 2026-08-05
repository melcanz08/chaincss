// src/compiler/tokens/entanglement.ts

import {
  parseColor as parseColorBase,
  contrastRatio as baseContrastRatio,
} from "./design-orchestrator.js";

export type TokenPath = string;
export type ContrastMethod = "auto" | "darken" | "lighten";

export interface ContrastRelationship {
  type: "contrast";
  id?: string;
  foreground: TokenPath;
  background: TokenPath | TokenPath[];
  target?: number;
  autoFix?: ContrastMethod;
  priority?: number;
}

export type DerivedMethod =
  | `mix-white ${number}%`
  | `mix-black ${number}%`
  | `lighten ${number}`
  | `darken ${number}`
  | `alpha ${number}`
  | `tint ${number}%`
  | `shade ${number}%`
  | `saturate ${number}`
  | `desaturate ${number}`;

export interface DerivedRelationship {
  type: "derived";
  id?: string;
  source: TokenPath;
  target: TokenPath;
  method: DerivedMethod;
}

export interface HarmonyRelationship {
  type: "harmony";
  id?: string;
  source: TokenPath;
  targets: TokenPath[];
  rule: "complementary" | "analogous" | "triadic" | "same-lightness";
}

export type Relationship =
  | ContrastRelationship
  | DerivedRelationship
  | HarmonyRelationship;

export interface Violation {
  relationship: Relationship;
  foreground: string;
  background: string;
  ratio: number;
  target: number;
  message: string;
}

export interface Change {
  path: TokenPath;
  from: string;
  to: string;
  reason: string;
  method?: string;
  ratio?: number;
}

export interface EntanglementReport {
  valid: boolean;
  violations: Violation[];
  changes: Change[];
  tokens: Record<string, any>;
}

type RGB = { r: number; g: number; b: number; a?: number };
type OKLCH = { l: number; c: number; h: number };

function parseColor(input: string): RGB | null {
  if (!input || typeof input !== "string") return null;
  const c = parseColorBase(input.trim()) as any;
  if (!c) return null;
  return { r: c.r, g: c.g, b: c.b, a: c.a ?? 1 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

const toLinear = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const toSrgb = (c: number) => {
  const clamped = Math.max(0, Math.min(1, c));
  const v =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

function rgbToOklch({ r, g, b }: RGB): OKLCH {
  const rl = toLinear(r),
    gl = toLinear(g),
    bl = toLinear(b);
  const l_ = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m_ = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s_ = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const l = Math.cbrt(l_),
    m = Math.cbrt(m_),
    s = Math.cbrt(s_);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h };
}

function oklchToRgb({ l, c, h }: OKLCH): RGB {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad),
    b = c * Math.sin(hRad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ * l_ * l_,
    m3 = m_ * m_ * m_,
    s3 = s_ * s_ * s_;
  const rL = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gL = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bL = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  return { r: toSrgb(rL), g: toSrgb(gL), b: toSrgb(bL) };
}

function luminance({ r, g, b }: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: RGB, bg: RGB): number {
  const l1 = luminance(fg) + 0.05,
    l2 = luminance(bg) + 0.05;
  return Math.max(l1, l2) / Math.min(l1, l2);
}

function mixOklch(a: RGB, b: RGB, t: number): RGB {
  const ca = rgbToOklch(a),
    cb = rgbToOklch(b);
  let dh = cb.h - ca.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return oklchToRgb({
    l: ca.l + (cb.l - ca.l) * t,
    c: ca.c + (cb.c - ca.c) * t,
    h: (ca.h + dh * t + 360) % 360,
  });
}

function findClosestFix(
  fgStr: string,
  bgStr: string,
  target = 4.5,
  method: ContrastMethod = "auto"
): { fixed: string; ratio: number; fixMethod: string } | null {
  const fg = parseColor(fgStr),
    bg = parseColor(bgStr);
  if (!fg || !bg) return null;
  if (contrast(fg, bg) >= target) return null;
  const fgOklch = rgbToOklch(fg);
  const bgLum = luminance(bg);
  const shouldDarken =
    method === "darken" ? true : method === "lighten" ? false : bgLum > 0.5;
  let lo = shouldDarken ? 0 : fgOklch.l,
    hi = shouldDarken ? fgOklch.l : 1;
  let best: { l: number; ratio: number } | null = null;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const rgb = oklchToRgb({ ...fgOklch, l: mid });
    const ratio = contrast(rgb, bg);
    if (ratio >= target) {
      best = { l: mid, ratio };
      if (shouldDarken) lo = mid;
      else hi = mid;
      if (Math.abs(hi - lo) < 0.0005) break;
    } else {
      if (shouldDarken) hi = mid;
      else lo = mid;
    }
  }
  if (!best) {
    const extreme = shouldDarken
      ? { r: 0, g: 0, b: 0 }
      : { r: 255, g: 255, b: 255 };
    const er = contrast(extreme, bg);
    if (er >= target)
      return {
        fixed: shouldDarken ? "#000000" : "#ffffff",
        ratio: Math.round(er * 100) / 100,
        fixMethod: "extreme",
      };
    return null;
  }
  const fixedRgb = oklchToRgb({ ...fgOklch, l: best.l });
  return {
    fixed: rgbToHex(fixedRgb.r, fixedRgb.g, fixedRgb.b),
    ratio: Math.round(best.ratio * 100) / 100,
    fixMethod: shouldDarken ? "darken" : "lighten",
  };
}

function applyDerived(source: string, method: DerivedMethod): string | null {
  const rgb = parseColor(source);
  if (!rgb) return null;
  const oklch = rgbToOklch(rgb);
  const m = method.trim();
  const num = (s: string) => parseFloat(s.replace("%", ""));
  if (m.startsWith("mix-white") || m.startsWith("tint")) {
    const pct = num(m.split(" ")[1]) / 100;
    const mixed = mixOklch(rgb, { r: 255, g: 255, b: 255 }, pct);
    return rgbToHex(mixed.r, mixed.g, mixed.b);
  }
  if (m.startsWith("mix-black") || m.startsWith("shade")) {
    const pct = num(m.split(" ")[1]) / 100;
    const mixed = mixOklch(rgb, { r: 0, g: 0, b: 0 }, pct);
    return rgbToHex(mixed.r, mixed.g, mixed.b);
  }
  if (m.startsWith("lighten")) {
    const amt = num(m.split(" ")[1]) / 100;
    const out = oklchToRgb({ ...oklch, l: Math.min(1, oklch.l + amt) });
    return rgbToHex(out.r, out.g, out.b);
  }
  if (m.startsWith("darken")) {
    const amt = num(m.split(" ")[1]) / 100;
    const out = oklchToRgb({ ...oklch, l: Math.max(0, oklch.l - amt) });
    return rgbToHex(out.r, out.g, out.b);
  }
  if (m.startsWith("saturate")) {
    const amt = num(m.split(" ")[1]) / 100;
    const out = oklchToRgb({ ...oklch, c: oklch.c + amt });
    return rgbToHex(out.r, out.g, out.b);
  }
  if (m.startsWith("desaturate")) {
    const amt = num(m.split(" ")[1]) / 100;
    const out = oklchToRgb({ ...oklch, c: Math.max(0, oklch.c - amt) });
    return rgbToHex(out.r, out.g, out.b);
  }
  if (m.startsWith("alpha")) {
    const a = num(m.split(" ")[1]);
    const aHex = Math.round(Math.max(0, Math.min(1, a)) * 255)
      .toString(16)
      .padStart(2, "0");
    return `${rgbToHex(rgb.r, rgb.g, rgb.b)}${aHex}`;
  }
  return null;
}

function applyHarmony(
  sourceStr: string,
  rule: HarmonyRelationship["rule"],
  index: number
): string | null {
  const rgb = parseColor(sourceStr);
  if (!rgb) return null;
  const o = rgbToOklch(rgb);
  if (rule === "complementary") {
    const out = oklchToRgb({ ...o, h: (o.h + 180) % 360 });
    return rgbToHex(out.r, out.g, out.b);
  }
  if (rule === "analogous") {
    const shift = index === 0 ? -30 : 30;
    const out = oklchToRgb({ ...o, h: (o.h + shift + 360) % 360 });
    return rgbToHex(out.r, out.g, out.b);
  }
  if (rule === "triadic") {
    const shift = index === 0 ? 120 : 240;
    const out = oklchToRgb({ ...o, h: (o.h + shift) % 360 });
    return rgbToHex(out.r, out.g, out.b);
  }
  if (rule === "same-lightness") return rgbToHex(rgb.r, rgb.g, rgb.b);
  return null;
}

function getByPath(obj: any, dot: string): any {
  const parts = dot.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  if (cur && typeof cur === "object" && "value" in cur)
    return (cur as any).value;
  return cur;
}

function setByPath(obj: any, dot: string, value: any) {
  const parts = dot.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (cur[last] && typeof cur[last] === "object" && "value" in cur[last])
    (cur[last] as any).value = value;
  else cur[last] = value;
}

function cloneTokens<T>(t: T): T {
  try {
    // @ts-ignore
    return typeof structuredClone === "function"
      ? structuredClone(t)
      : JSON.parse(JSON.stringify(t));
  } catch {
    return JSON.parse(JSON.stringify(t));
  }
}

type PipelineStep =
  | DerivedRelationship
  | {
      type: "harmony_single";
      source: string;
      target: string;
      rule: HarmonyRelationship["rule"];
      index: number;
      total: number;
    };

function topoSort(
  derived: DerivedRelationship[],
  harmonies: HarmonyRelationship[]
): PipelineStep[] {
  const graph = new Map<string, Set<string>>();
  const indeg = new Map<string, number>();
  const flat: PipelineStep[] = [];

  const touch = (n: string) => {
    if (!indeg.has(n)) indeg.set(n, 0);
  };

  for (const r of derived) {
    flat.push(r);
    touch(r.source);
    touch(r.target);
    indeg.set(r.target, (indeg.get(r.target) || 0) + 1);
    if (!graph.has(r.source)) graph.set(r.source, new Set());
    graph.get(r.source)!.add(r.target);
  }

  for (const h of harmonies) {
    h.targets.forEach((target, index) => {
      const single: PipelineStep = {
        type: "harmony_single",
        source: h.source,
        target,
        rule: h.rule,
        index,
        total: h.targets.length,
      };
      flat.push(single);
      touch(h.source);
      touch(target);
      indeg.set(target, (indeg.get(target) || 0) + 1);
      if (!graph.has(h.source)) graph.set(h.source, new Set());
      graph.get(h.source)!.add(target);
    });
  }

  const q: string[] = [...indeg.entries()]
    .filter(([, d]) => d === 0)
    .map(([n]) => n);
  const order: string[] = [];

  while (q.length) {
    const n = q.shift()!;
    order.push(n);
    for (const o of graph.get(n) || []) {
      const nd = (indeg.get(o) || 1) - 1;
      indeg.set(o, nd);
      if (nd === 0) q.push(o);
    }
  }

  if (order.length !== indeg.size) {
    throw new Error(
      `[entanglement] Cycle detected: ${[...indeg.entries()]
        .filter(([, d]) => d > 0)
        .map(([n]) => n)
        .join(", ")}`
    );
  }

  const pos = new Map(order.map((n, i) => [n, i]));
  return flat.sort(
    (a, b) => (pos.get(a.source) ?? 0) - (pos.get(b.source) ?? 0)
  );
}

export class TokenEntanglementEngine {
  private relationships: Relationship[] = [];
  private compiledPipeline: PipelineStep[] | null = null;

  constructor(relationships: Relationship[] = []) {
    this.addMany(relationships);
  }

  add(r: Relationship) {
    this.relationships.push(r);
    this.compiledPipeline = null;
  }

  addMany(rs: Relationship[]) {
    this.relationships.push(...rs);
    this.compiledPipeline = null;
  }

  private getPipeline(): PipelineStep[] {
    if (!this.compiledPipeline) {
      const derived = this.relationships.filter(
        (r) => r.type === "derived"
      ) as DerivedRelationship[];
      const harmonies = this.relationships.filter(
        (r) => r.type === "harmony"
      ) as HarmonyRelationship[];
      this.compiledPipeline = topoSort(derived, harmonies);
    }
    return this.compiledPipeline;
  }

  validate(tokens: Record<string, any>): Violation[] {
    const v: Violation[] = [];
    for (const rel of this.relationships) {
      if (rel.type !== "contrast") continue;
      const fgVal = getByPath(tokens, rel.foreground);
      if (!fgVal) continue;
      const bgs = Array.isArray(rel.background)
        ? rel.background
        : [rel.background];
      const target = rel.target ?? 4.5;

      for (const bgPath of bgs) {
        const bgVal = getByPath(tokens, bgPath);
        if (!bgVal) continue;
        const ratio = baseContrastRatio(String(fgVal), String(bgVal));
        if (ratio < target && ratio !== -1) {
          v.push({
            relationship: rel,
            foreground: String(fgVal),
            background: String(bgVal),
            ratio: Math.round(ratio * 100) / 100,
            target,
            message: `${rel.foreground} on ${bgPath} is ${ratio.toFixed(
              2
            )}:1, needs ${target}:1`,
          });
        }
      }
    }
    return v;
  }

  propagate(
    tokens: Record<string, any>,
    sourcePath: TokenPath,
    newValue: string,
    opts: { autoFixContrast?: boolean } = {}
  ): EntanglementReport {
    const next = cloneTokens(tokens);
    const changes: Change[] = [];
    const from = String(getByPath(next, sourcePath) ?? "");

    setByPath(next, sourcePath, newValue);
    if (from !== newValue) {
      changes.push({
        path: sourcePath,
        from,
        to: newValue,
        reason: "source change",
      });
    }

    const pipeline = this.getPipeline();
    let mutated = true;
    let iter = 0;

    while (mutated && iter < 25) {
      mutated = false;
      iter++;

      for (const edge of pipeline) {
        const srcVal = getByPath(next, edge.source);
        if (!srcVal) continue;

        let computed: string | null = null;
        let reason = "";

        if ("method" in edge) {
          computed = applyDerived(String(srcVal), edge.method);
          reason = `derived from ${edge.source} via ${edge.method}`;
        } else {
          if (edge.rule === "same-lightness") {
            const curTarget = getByPath(next, edge.target);
            const srcRgb = parseColor(String(srcVal));
            const tgtRgb = parseColor(String(curTarget || "#ffffff"));
            if (srcRgb && tgtRgb) {
              const srcO = rgbToOklch(srcRgb);
              const tgtO = rgbToOklch(tgtRgb);
              const out = oklchToRgb({ ...tgtO, l: srcO.l });
              computed = rgbToHex(out.r, out.g, out.b);
            }
          } else {
            computed = applyHarmony(String(srcVal), edge.rule, edge.index);
          }
          reason = `harmony ${edge.rule} from ${edge.source}`;
        }

        if (!computed) continue;
        const cur = getByPath(next, edge.target);
        if (String(cur) === computed) continue;

        setByPath(next, edge.target, computed);
        changes.push({
          path: edge.target,
          from: String(cur ?? ""),
          to: computed,
          reason,
          method: "method" in edge ? edge.method : edge.rule,
        });
        mutated = true;
      }
    }

    if (opts.autoFixContrast !== false) {
      const contrastRels = (
        this.relationships.filter(
          (r) => r.type === "contrast"
        ) as ContrastRelationship[]
      ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      for (const rel of contrastRels) {
        const bgs = Array.isArray(rel.background)
          ? rel.background
          : [rel.background];
        const target = rel.target ?? 4.5;
        let worstRatio = Infinity;
        let worstBg = "";

        for (const bgPath of bgs) {
          const fgVal = getByPath(next, rel.foreground);
          const bgVal = getByPath(next, bgPath);
          if (!fgVal || !bgVal) continue;
          const ratio = baseContrastRatio(String(fgVal), String(bgVal));
          if (ratio === -1) continue;
          if (ratio < worstRatio) {
            worstRatio = ratio;
            worstBg = bgPath;
          }
        }

        if (worstRatio >= target) continue;
        const fgVal = getByPath(next, rel.foreground);
        const bgVal = getByPath(next, worstBg);
        const fix = findClosestFix(
          String(fgVal),
          String(bgVal),
          target,
          rel.autoFix ?? "auto"
        );
        if (!fix) continue;

        setByPath(next, rel.foreground, fix.fixed);
        changes.push({
          path: rel.foreground,
          from: String(fgVal),
          to: fix.fixed,
          reason: `auto fix contrast ${worstRatio.toFixed(2)} -> ${
            fix.ratio
          } on ${worstBg}`,
          method: fix.fixMethod,
          ratio: fix.ratio,
        });
      }
    }

    const violations = this.validate(next);
    return {
      valid: violations.length === 0,
      violations,
      changes,
      tokens: next,
    };
  }

  fixAll(tokens: Record<string, any>): EntanglementReport {
    let currentTokens = cloneTokens(tokens);
    const allChanges: Change[] = [];

    const rels = (
      this.relationships.filter(
        (r) => r.type === "contrast"
      ) as ContrastRelationship[]
    ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const rel of rels) {
      const bgs = Array.isArray(rel.background)
        ? rel.background
        : [rel.background];

      for (const bgPath of bgs) {
        const fgVal = getByPath(currentTokens, rel.foreground);
        const bgVal = getByPath(currentTokens, bgPath);
        if (!fgVal || !bgVal) continue;

        const ratio = baseContrastRatio(String(fgVal), String(bgVal));
        if (ratio >= (rel.target ?? 4.5) || ratio === -1) continue;

        const fix = findClosestFix(
          String(fgVal),
          String(bgVal),
          rel.target ?? 4.5,
          rel.autoFix ?? "auto"
        );
        if (!fix) continue;

        // Re-propagate the auto-fixed token so derived children stay synchronized
        const report = this.propagate(
          currentTokens,
          rel.foreground,
          fix.fixed,
          { autoFixContrast: false }
        );

        currentTokens = report.tokens;
        allChanges.push(...report.changes);
        break;
      }
    }

    const violations = this.validate(currentTokens);
    return {
      valid: violations.length === 0,
      violations,
      changes: allChanges,
      tokens: currentTokens,
    };
  }
}

export function createEntanglementEngine(config: {
  relationships: Relationship[];
}) {
  return new TokenEntanglementEngine(config.relationships);
}