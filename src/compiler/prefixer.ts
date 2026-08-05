// src/compiler/prefixer.ts

async function safeImport(name: string): Promise<any> {
  try {
    const fn = new Function("name", "return import(name)");
    return await fn(name);
  } catch {
    return null;
  }
}

let postcss: any = null;
let autoprefixer: any = null;
let postcssLoaded = false;
let autoprefixerLoaded = false;

async function loadPostcss() {
  if (postcssLoaded) return postcss;
  try {
    const m = await safeImport("postcss");
    postcss = m?.default || m;
  } catch {}
  postcssLoaded = true;
  return postcss;
}

async function loadAutoprefixer() {
  if (autoprefixerLoaded) return autoprefixer;
  try {
    const m = await safeImport("autoprefixer");
    autoprefixer = m?.default || m;
  } catch {}
  autoprefixerLoaded = true;
  return autoprefixer;
}

export interface PrefixerConfig {
  browsers?: string[];
  enabled?: boolean;
  mode?: "auto" | "full" | "lightweight";
  sourceMap?: boolean;
  sourceMapInline?: boolean;
  remove?: boolean;
  add?: boolean;
  verbose?: boolean;
  flexbox?: boolean | "no-2009";
  grid?: boolean | "autoplace" | "no-autoplace";
}

export interface PrefixerResult {
  css: string;
  map: string | null;
  warnings?: string[];
}

export interface ProcessOptionsWithPaths {
  from?: string;
  to?: string;
  map?: boolean | object;
}

const LIGHTWEIGHT_PREFIX_MAP: Record<string, Record<string, string[]>> = {
  "backdrop-filter": { webkit: ["-webkit-backdrop-filter"] },
  "user-select": { webkit: ["-webkit-user-select"] },
  appearance: { webkit: ["-webkit-appearance"] },
  "background-clip": { webkit: ["-webkit-background-clip"] },
  "mask-image": { webkit: ["-webkit-mask-image"] },
  "mask-size": { webkit: ["-webkit-mask-size"] },
  "mask-repeat": { webkit: ["-webkit-mask-repeat"] },
  "mask-position": { webkit: ["-webkit-mask-position"] },
  "text-fill-color": { webkit: ["-webkit-text-fill-color"] },
  "text-stroke": { webkit: ["-webkit-text-stroke"] },
};

const LIGHTWEIGHT_VALUE_PREFIXES: Record<string, Record<string, string[]>> = {
  position: { sticky: ["-webkit-sticky"] },
};

const DECL_REGEX = /\b([a-zA-Z-][a-zA-Z0-9-]*)\s*:\s*([^;{}]+)(;?)/g;
const COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class ChainCSSPrefixer {
  config: Required<PrefixerConfig>;
  private warnings: string[] = [];

  constructor(config: PrefixerConfig = {}) {
    this.config = {
      browsers: config.browsers || ["> 0.5%", "last 2 versions", "not dead"],
      enabled: config.enabled !== false,
      mode: config.mode || "lightweight",
      sourceMap: config.sourceMap !== false,
      sourceMapInline: config.sourceMapInline || false,
      remove: config.remove !== false,
      add: config.add !== false,
      verbose: config.verbose || false,
      flexbox: config.flexbox !== false,
      grid: config.grid || "autoplace",
    };
  }

  async determineMode(): Promise<"full" | "lightweight"> {
    if (this.config.mode === "full") {
      const has = !!(await loadAutoprefixer()) && !!(await loadPostcss());
      if (!has && this.config.verbose) {
        console.warn(
          "[ChainCSS] Full mode needs postcss + autoprefixer. Run: npm i -D postcss autoprefixer — falling back to lightweight",
        );
      }
      return has ? "full" : "lightweight";
    }
    if (this.config.mode === "auto" && this.config.verbose) {
      console.log(
        "[ChainCSS] mode:auto is deprecated, using lightweight. Set mode:lightweight or mode:full",
      );
    }
    return "lightweight";
  }

  async process(
    cssString: string,
    options: ProcessOptionsWithPaths = {},
  ): Promise<PrefixerResult> {
    this.warnings = [];
    if (!this.config.enabled) {
      return { css: cssString, map: null, warnings: [] };
    }
    try {
      const mode = await this.determineMode();
      if (mode === "full") {
        return await this.processWithAutoprefixer(cssString, options);
      }
      return this.processWithBuiltIn(cssString);
    } catch (e) {
      this.warnings.push(`Prefixer error: ${(e as Error).message}`);
      return { css: cssString, map: null, warnings: this.warnings };
    }
  }

  private async processWithAutoprefixer(
    cssString: string,
    options: ProcessOptionsWithPaths,
  ): Promise<PrefixerResult> {
    const ap = await loadAutoprefixer();
    const pc = await loadPostcss();
    if (!ap || !pc) return this.processWithBuiltIn(cssString);

    const result = await pc([
      ap({
        overrideBrowserslist: this.config.browsers,
        remove: this.config.remove,
        add: this.config.add,
        flexbox: this.config.flexbox,
        grid: this.config.grid,
      }),
    ]).process(cssString, {
      from: options.from || "input.css",
      to: options.to || "output.css",
      map: this.config.sourceMap
        ? { inline: this.config.sourceMapInline, annotation: false }
        : false,
    });

    return {
      css: result.css,
      map: result.map ? result.map.toString() : null,
      warnings: this.warnings,
    };
  }

  private processWithBuiltIn(cssString: string): PrefixerResult {
    return {
      css: this.lightweightPrefix(cssString),
      map: null,
      warnings: this.warnings,
    };
  }

  private lightweightPrefix(cssString: string): string {
    const comments: string[] = [];
    let cleanCss = cssString.replace(COMMENT_REGEX, (match) => {
      comments.push(match);
      return `/*__COMMENT_PLACEHOLDER_${comments.length - 1}__*/`;
    });

    cleanCss = this.duplicateKeyframes(cleanCss);

    const stack: string[] = [""];
    let inString: string | null = null;

    for (let i = 0; i < cleanCss.length; i++) {
      const char = cleanCss[i];

      if ((char === '"' || char === "'") && cleanCss[i - 1] !== "\\") {
        if (inString === char) inString = null;
        else if (!inString) inString = char;
      }

      if (inString) {
        stack[stack.length - 1] += char;
        continue;
      }

      if (char === "{") {
        stack[stack.length - 1] += "{";
        stack.push("");
      } else if (char === "}") {
        if (stack.length > 1) {
          const blockContent = stack.pop()!;
          const processedBlock = this.prefixDeclarationBlock(blockContent);
          stack[stack.length - 1] += processedBlock + "}";
        } else {
          stack[0] += "}";
        }
      } else {
        stack[stack.length - 1] += char;
      }
    }

    const result = stack.join("");

    return result.replace(
      /\/\*__COMMENT_PLACEHOLDER_(\d+)__\*\//g,
      (_, id) => comments[parseInt(id, 10)] || "",
    );
  }

  private duplicateKeyframes(css: string): string {
    let index = 0;
    const keyword = "@keyframes";

    while (true) {
      const startIdx = css.indexOf(keyword, index);
      if (startIdx === -1) break;

      const openBraceIdx = css.indexOf("{", startIdx);
      if (openBraceIdx === -1) {
        index = startIdx + keyword.length;
        continue;
      }

      let braceCount = 1;
      let scanIdx = openBraceIdx + 1;
      while (scanIdx < css.length && braceCount > 0) {
        const ch = css[scanIdx];
        if (ch === "{") braceCount++;
        else if (ch === "}") braceCount--;
        scanIdx++;
      }

      if (braceCount === 0) {
        const fullBlock = css.slice(startIdx, scanIdx);
        const blockBodyAndName = css.slice(startIdx + keyword.length, scanIdx);
        const webkitBlock = `@-webkit-keyframes${blockBodyAndName}`;
        const namePart = blockBodyAndName.split("{")[0].trim();

        const webkitKeyframeRegex = new RegExp(
          `@-webkit-keyframes\\s+${escapeRegExp(namePart)}\\b`,
        );

        if (webkitKeyframeRegex.test(css)) {
          index = startIdx + keyword.length;
          continue;
        }

        const replacement = `${webkitBlock}\n${fullBlock}`;
        css = css.slice(0, startIdx) + replacement + css.slice(scanIdx);
        index = startIdx + replacement.length;
      } else {
        index = startIdx + keyword.length;
      }
    }

    return css;
  }

  private prefixDeclarationBlock(block: string): string {
    return block.replace(DECL_REGEX, (full, prop, value, semi) => {
      const trimmedProp = prop.trim();
      const trimmedVal = value.trim();
      const map = LIGHTWEIGHT_PREFIX_MAP[trimmedProp];
      const vMap = LIGHTWEIGHT_VALUE_PREFIXES[trimmedProp];

      if (!map && (!vMap || !vMap[trimmedVal])) return full;

      let prefix = "";

      if (map && this.config.add) {
        for (const arr of Object.values(map)) {
          for (const pr of arr) {
            if (block.includes(`${pr}:`)) continue;
            prefix += `${pr}: ${trimmedVal};\n`;
          }
        }
      }

      if (vMap && vMap[trimmedVal] && this.config.add) {
        for (const pr of vMap[trimmedVal]) {
          if (block.includes(`${trimmedProp}: ${pr}`)) continue;
          prefix += `${trimmedProp}: ${pr};\n`;
        }
      }

      const ending = semi ? ";" : "";
      return `${prefix}${trimmedProp}: ${trimmedVal}${ending}`;
    });
  }

  reset() {
    this.warnings = [];
  }
}

export default ChainCSSPrefixer;