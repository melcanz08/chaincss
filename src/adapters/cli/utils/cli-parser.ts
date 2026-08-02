// ============================================================================
// FILE: src/adapters/cli/utils/cli-parser.ts
// ============================================================================

/**
 * Unsafe keys that must be omitted from parsing to prevent Prototype Pollution.
 */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Attempts to parse explicit stringified booleans.
 * If the string does not match a boolean literal, it returns the original value
 * to preserve custom inputs (e.g. `--fix="src/styles"` remains a path string).
 */
export function tryParseBoolean<T>(value: T): boolean | T {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    // Use strict equality matching for clear boolean representations
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true as unknown as T;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false as unknown as T;
    }
  }

  return value;
}

/**
 * Iterates through a raw CLI option bundle and normalizes all values recursively.
 * Safe to run globally on command input payloads.
 */
export function normalizeCLIOptions<T extends Record<string, any>>(
  options: T,
): T {
  if (!options || typeof options !== "object") {
    return options;
  }

  // Handle arrays explicitly
  if (Array.isArray(options)) {
    return options.map((item) => {
      if (typeof item === "object" && item !== null) {
        return normalizeCLIOptions(item);
      }
      return tryParseBoolean(item);
    }) as unknown as T;
  }

  // Use Object.create(null) to completely mitigate prototype inheritance bugs
  const normalized = Object.create(null) as Record<string, any>;

  for (const key of Object.keys(options)) {
    // 1. Guard against Prototype Pollution
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }

    const val = options[key];

    // 2. Recursively traverse child configurations (like --output.cssFile)
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      normalized[key] = normalizeCLIOptions(val);
    }
    // 3. Handle arrays inside configuration trees
    else if (Array.isArray(val)) {
      normalized[key] = val.map((item) => {
        if (val !== null && typeof item === "object") {
          return normalizeCLIOptions(item);
        }
        return tryParseBoolean(item);
      });
    }
    // 4. Default dynamic boolean parsing
    else {
      normalized[key] = tryParseBoolean(val);
    }
  }

  return normalized as T;
}

export default {
  tryParseBoolean,
  normalizeCLIOptions,
};
