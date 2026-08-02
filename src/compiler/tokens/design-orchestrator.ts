// src/compiler/tokens/design-orchestrator.ts

export interface ContrastResult {
  foreground: string;
  background: string;
  ratio: number;
  passes: { AA: boolean; AALarge: boolean; AAA: boolean; AAALarge: boolean };
  suggestion?: string;
}

export interface ContrastReport {
  checks: ContrastResult[];
  failures: ContrastResult[];
  warnings: ContrastResult[];
  passCount: number;
  failCount: number;
  summary: string;
}

export interface ContextualToken {
  name: string;
  default: string;
  contexts: Record<string, string>;
  id: string;
}

export interface TokenContext {
  name: string;
  parentSelector?: string;
  tokens: Record<string, any>;
}

const parseCache = new Map<
  string,
  { r: number; g: number; b: number; a: number } | null
>();
const MAX_CACHE = 1000;
function setCache(
  key: string,
  val: { r: number; g: number; b: number; a: number } | null,
) {
  if (parseCache.size >= MAX_CACHE) {
    const first = parseCache.keys().next().value;
    if (first) parseCache.delete(first);
  }
  parseCache.set(key, val);
}
let ctxCounter = 0;

function oklchToRgb(
  l: number,
  c: number,
  h: number,
): { r: number; g: number; b: number } {
  const hRad = (h * Math.PI) / 180;
  const l_ = l;
  const a_ = c * Math.cos(hRad);
  const b_ = c * Math.sin(hRad);

  const l__ = l_ + 0.3963377774 * a_ + 0.2158037573 * b_;
  const m__ = l_ - 0.1055613458 * a_ - 0.0638541728 * b_;
  const s__ = l_ - 0.0894841775 * a_ - 1.291485548 * b_;

  const l_cube = l__ * l__ * l__;
  const m_cube = m__ * m__ * m__;
  const s_cube = s__ * s__ * s__;

  // W3C CSS Color 4 Spec - OKLCH to sRGB
  // Source: https://www.w3.org/TR/css-color-4/#color-conversion-code
  // Based on Björn Ottosson's OKLab: https://bottosson.github.io/posts/oklab/
  // Matrix: LMS -> linear sRGB
  const rL =
    +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const gL =
    -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
  const bL =
    -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.707614701 * s_cube;

  const gamma = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

  return {
    r: Math.max(0, Math.min(255, Math.round(gamma(rL) * 255))),
    g: Math.max(0, Math.min(255, Math.round(gamma(gL) * 255))),
    b: Math.max(0, Math.min(255, Math.round(gamma(bL) * 255))),
  };
}

export function parseColor(
  color: string,
): { r: number; g: number; b: number; a: number } | null {
  const trimmed = color.trim().toLowerCase();
  if (parseCache.has(trimmed)) return parseCache.get(trimmed)!;

  let out: { r: number; g: number; b: number; a: number } | null = null;

  if (
    trimmed.startsWith("var(") ||
    trimmed === "currentcolor" ||
    trimmed === "inherit" ||
    trimmed === "transparent"
  ) {
    if (trimmed === "transparent") {
      out = { r: 0, g: 0, b: 0, a: 0 };
      setCache(trimmed, out);
      return out;
    }
    setCache(trimmed, null);
    return null;
  }

  // 1. Hex parsing - require # to avoid matching bare numbers like '12345678'
  const hexMatch = trimmed.match(
    /^#([a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/,
  );
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((x) => x + x)
        .join("");
    }
    if (hex.length === 6) {
      out = {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    } else if (hex.length === 8) {
      out = {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // 2. RGB/RGBA
  if (!out && trimmed.startsWith("rgb")) {
    const rgbMatch = trimmed.match(
      /rgba?\(\s*([\d.]+)(%?)\s*[\s,]\s*([\d.]+)(%?)\s*[\s,]\s*([\d.]+)(%?)(?:\s*[\s,\/]\s*([\d.]+)(%?))?\s*\)/,
    );
    if (rgbMatch) {
      const parseVal = (val: string, isPct: string, max: number) =>
        isPct ? (parseFloat(val) / 100) * max : parseFloat(val);
      const r = parseVal(rgbMatch[1], rgbMatch[2], 255);
      const g = parseVal(rgbMatch[3], rgbMatch[4], 255);
      const b = parseVal(rgbMatch[5], rgbMatch[6], 255);
      let a = 1;
      if (rgbMatch[7]) {
        a = rgbMatch[8]
          ? parseFloat(rgbMatch[7]) / 100
          : parseFloat(rgbMatch[7]);
      }
      out = { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
    }
  }

  // 3. HSL/HSLA
  if (!out && trimmed.startsWith("hsl")) {
    const hslMatch = trimmed.match(
      /hsla?\(\s*([\d.]+)(deg|rad|turn)?\s*[\s,]\s*([\d.]+)%\s*[\s,]\s*([\d.]+)%(?:\s*[\s,\/]\s*([\d.]+)(%?))?\s*\)/,
    );
    if (hslMatch) {
      let h = parseFloat(hslMatch[1]);
      const unit = hslMatch[2];
      if (unit === "rad") h = (h * 180) / Math.PI;
      else if (unit === "turn") h = h * 360;
      h = (((h % 360) + 360) % 360) / 360;
      const s = parseFloat(hslMatch[3]) / 100;
      const l = parseFloat(hslMatch[4]) / 100;
      let a = 1;
      if (hslMatch[5])
        a = hslMatch[6]
          ? parseFloat(hslMatch[5]) / 100
          : parseFloat(hslMatch[5]);
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      let r, g, b;
      if (s === 0) r = g = b = l;
      else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      out = {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
        a,
      };
    }
  }

  // 4. OKLCH
  if (!out && trimmed.startsWith("oklch")) {
    const oklchMatch = trimmed.match(
      /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(deg|rad|turn)?(?:\s*[\s\/]\s*([\d.]+)(%?))?\s*\)/,
    );
    if (oklchMatch) {
      let l = parseFloat(oklchMatch[1]);
      if (oklchMatch[2]) l /= 100;
      const c = parseFloat(oklchMatch[3]);
      let h = parseFloat(oklchMatch[4]);
      const unit = oklchMatch[5];
      if (unit === "rad") h = (h * 180) / Math.PI;
      else if (unit === "turn") h = h * 360;
      h = ((h % 360) + 360) % 360;
      let a = 1;
      if (oklchMatch[6])
        a = oklchMatch[7]
          ? parseFloat(oklchMatch[6]) / 100
          : parseFloat(oklchMatch[6]);
      out = { ...oklchToRgb(l, c, h), a };
    }
  }

  // 5. Named colors
  if (!out) {
    const named: Record<string, [number, number, number]> = {
      white: [255, 255, 255],
      black: [0, 0, 0],
      red: [255, 0, 0],
      green: [0, 128, 0],
      blue: [0, 0, 255],
      orange: [255, 165, 0],
      yellow: [255, 255, 0],
      purple: [128, 0, 128],
      pink: [255, 192, 203],
      brown: [165, 42, 42],
      navy: [0, 0, 128],
      teal: [0, 128, 128],
      cyan: [0, 255, 255],
      magenta: [255, 0, 255],
      lime: [0, 255, 0],
      maroon: [128, 0, 0],
      olive: [128, 128, 0],
      silver: [192, 192, 192],
      gold: [255, 215, 0],
      coral: [255, 127, 80],
      salmon: [250, 128, 114],
      gray: [128, 128, 128],
      grey: [128, 128, 128],
      slategray: [112, 128, 144],
      indigo: [75, 0, 130],
      turquoise: [64, 224, 208],
      violet: [238, 130, 238],
      tomato: [255, 99, 71],
      royalblue: [65, 105, 225],
      steelblue: [70, 130, 180],
      skyblue: [135, 206, 235],
      forestgreen: [34, 139, 34],
      darkorange: [255, 140, 0],
    };
    if (named[trimmed]) {
      const [r, g, b] = named[trimmed];
      out = { r, g, b, a: 1 };
    }
  }

  setCache(trimmed, out);
  return out;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground),
    bg = parseColor(background);
  if (!fg || !bg) return -1;
  const l1 = relativeLuminance(fg.r, fg.g, fg.b) + 0.05;
  const l2 = relativeLuminance(bg.r, bg.g, bg.b) + 0.05;
  return Math.max(l1, l2) / Math.min(l1, l2);
}

export function checkContrast(
  foreground: string,
  background: string,
): ContrastResult | null {
  const fg = parseColor(foreground),
    bg = parseColor(background);
  if (!fg || !bg) return null;
  const ratio = contrastRatio(foreground, background);
  const roundedRatio = Math.round(ratio * 100) / 100;
  return {
    foreground,
    background,
    ratio: roundedRatio,
    passes: {
      AA: ratio >= 4.5,
      AALarge: ratio >= 3,
      AAA: ratio >= 7,
      AAALarge: ratio >= 4.5,
    },
    suggestion:
      ratio < 4.5
        ? `Contrast ${roundedRatio.toFixed(2)} fails AA. Darken/lighten by ~${Math.round((4.5 - ratio) * 10)}%`
        : undefined,
  };
}

export function auditContrast(
  styles: Array<{ selector: string; color: string; backgroundColor: string }>,
): ContrastReport {
  const checks: ContrastResult[] = [];
  for (const s of styles) {
    if (s.color && s.backgroundColor) {
      const r = checkContrast(s.color, s.backgroundColor);
      if (r) checks.push(r);
    }
  }
  const failures = checks.filter((c) => !c.passes.AA);
  const warnings = checks.filter((c) => c.passes.AA && !c.passes.AAA);
  return {
    checks,
    failures,
    warnings,
    passCount: checks.length - failures.length,
    failCount: failures.length,
    summary:
      failures.length === 0
        ? `All ${checks.length} checks pass AA.`
        : `${failures.length} of ${checks.length} FAIL AA.`,
  };
}

export function createContextualToken(
  defaultValue: string,
  contexts: Record<string, string> = {},
): ContextualToken {
  const id = `ctx-${++ctxCounter}`;
  return { name: `--${id}`, id, default: defaultValue, contexts };
}

function segmentMatches(targetSeg: string, ctxSeg: string): boolean {
  if (targetSeg === ctxSeg) return true;
  //.btn.primary:hover should match context.btn and.btn:hover but NOT.btn-primary
  const tParts = targetSeg.split(/(?=[.:])/);
  const cParts = ctxSeg.split(/(?=[.:])/);
  return cParts.every((p) => tParts.includes(p));
}

export function resolveContextual(
  token: ContextualToken,
  selectorPath: string,
): string {
  let best = token.default;
  let highestSpecificity = -1;
  const targetSegments = selectorPath
    .split(/[\s>+~]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const [ctx, val] of Object.entries(token.contexts)) {
    const ctxSegments = ctx
      .trim()
      .split(/[\s>+~]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    let targetIdx = 0,
      matchCount = 0;
    for (const ctxSeg of ctxSegments) {
      while (targetIdx < targetSegments.length) {
        if (segmentMatches(targetSegments[targetIdx], ctxSeg)) {
          matchCount++;
          targetIdx++;
          break;
        }
        targetIdx++;
      }
    }
    if (matchCount === ctxSegments.length) {
      const score = ctxSegments.length;
      if (score > highestSpecificity) {
        highestSpecificity = score;
        best = val;
      }
    }
  }
  return best;
}

export function generateContextualCSS(
  propertyName: string,
  token: ContextualToken,
  baseSelector: string,
): string {
  let css = `${baseSelector} { ${propertyName}: ${token.default}; }\n`;
  for (const [ctx, val] of Object.entries(token.contexts)) {
    const selector = ctx.includes("&")
      ? ctx.replace(/&/g, baseSelector)
      : `${ctx} ${baseSelector}`;
    css += `${selector} { ${propertyName}: ${val}; }\n`;
  }
  return css;
}

// Renamed to avoid collision with token-resolver.ts - this one works on raw object
function resolveNestedTokenPath(
  tokens: Record<string, any>,
  path: string,
): string | null {
  const parts = path.split(".");
  let cur: any = tokens;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return typeof cur === "string" || typeof cur === "number"
    ? String(cur)
    : null;
}

export function validateTokenRelationships(
  tokens: Record<string, any>,
  pairs: Array<{ foreground: string; background: string; label: string }>,
): ContrastReport {
  const styles: Array<{
    selector: string;
    color: string;
    backgroundColor: string;
  }> = [];
  for (const pair of pairs) {
    const fg = resolveNestedTokenPath(tokens, pair.foreground);
    const bg = resolveNestedTokenPath(tokens, pair.background);
    if (fg && bg)
      styles.push({ selector: pair.label, color: fg, backgroundColor: bg });
  }
  return auditContrast(styles);
}

export function importFigmaTokens(figmaJson: any): Record<string, any> {
  const out: Record<string, any> = {};
  function walk(node: any, target: any) {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (
        v &&
        typeof v === "object" &&
        "value" in (v as any) &&
        typeof (v as any).value === "string"
      ) {
        target[k] = (v as any).value;
      } else if (v && typeof v === "object") {
        target[k] = {};
        walk(v, target[k]);
      }
    }
  }
  walk(figmaJson, out);
  return out;
}

export function clearParseCache() {
  parseCache.clear();
}

export const orchestrator = {
  contrastRatio,
  checkContrast,
  auditContrast,
  createContextualToken,
  resolveContextual,
  generateContextualCSS,
  validateTokenRelationships,
  parseColor,
  importFigmaTokens,
  clearParseCache,
};

export default orchestrator;
