// Module resolution for unit tests run directly by Node (which strips
// TypeScript types natively): maps the "@/..." alias from tsconfig.json to
// src/ and resolves extensionless relative imports to their .ts file, the
// way Next's bundler does. Loaded with `node --import`.
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcDir = resolve(fileURLToPath(import.meta.url), "..", "..", "src");

function existingFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null;
    if (specifier.startsWith("@/")) {
      target = resolve(srcDir, specifier.slice(2));
    } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      target = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target) {
      const file = existingFile(target);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
});
