// ts-unit-normalize.ts — TS oracle for the unit-normalizer stage.
//
// Reads a StyleIR JSON (produced by ts-parseir.ts), applies
// unitNormalizer.normalize(), and writes the resulting IR as JSON.
//
// Usage: npx tsx ts-unit-normalize.ts <input.ir.json>
//        → stdout: { "ir": <normalized StyleIR>, "corrections": [...] }

import * as fs from "node:fs";
import { unitNormalizer } from "../src/compiler/pipeline/normalizers/unit-normalizer.js";

const inputPath = process.argv[2];
if (!inputPath) {
    process.stderr.write("usage: ts-unit-normalize.ts <input.ir.json>\n");
    process.exit(2);
}

const src = fs.readFileSync(inputPath, "utf-8");
const ir = JSON.parse(src);

// NormalizationContext is `{ sourceFile?: string; config?: Record<string, any> }`.
// The unit-normalizer does not read context, so `{}` is correct.
const result = unitNormalizer.normalize(ir, {});

process.stdout.write(JSON.stringify({
    ir: result.ir,
    corrections: result.corrections,
}, null, 2));
