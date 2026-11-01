// ts-parseir.ts — ChainCSS TS oracle for differential parity (Phase 2D).
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { parseIR } from "../src/compiler/pipeline/ir/parser.ts";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: ts-parseir.ts <path/to/*.chain.ts>");
    process.exit(2);
  }
  const abs = resolve(file);
  const mod = await import(pathToFileURL(abs).href);
  const styles = mod.default || mod;
  const basename = file.split("/").pop() || file;
  const ir = parseIR(styles, `src/${basename}`);
  process.stdout.write(JSON.stringify(ir, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
