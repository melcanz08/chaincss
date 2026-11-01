// ts-export-source.ts — serialize a .chain.ts default export as JSON.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: ts-export-source.ts <path/to/*.chain.ts>");
    process.exit(2);
  }
  const abs = resolve(file);
  const mod = await import(pathToFileURL(abs).href);
  const styles = mod.default || mod;
  process.stdout.write(JSON.stringify(styles, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
