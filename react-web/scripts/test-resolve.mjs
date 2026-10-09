// Module resolution for unit tests run directly by Node (which strips
// TypeScript types natively): maps the "@/..." alias from tsconfig.json to
// src/ and resolves extensionless relative imports to their .ts/.tsx file,
// the way Next's bundler does. Loaded with `node --import`.
//
// Component tests (*.test.tsx) also need:
//  - .tsx compiled: Node's type stripping does not handle JSX, so .tsx files
//    are transformed with esbuild (React automatic runtime). .ts files are
//    left to Node's native type stripping, exactly as before.
//  - next/navigation replaced by src/test/mocks/next-navigation.ts (the real
//    module needs the Next app router at runtime).
//  - stylesheet imports turned into empty modules.
import { registerHooks } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcDir = resolve(fileURLToPath(import.meta.url), "..", "..", "src");

/** Bare specifiers swapped for a test double under src/test/mocks. */
const MODULE_MOCKS = {
  "next/navigation": resolve(srcDir, "test", "mocks", "next-navigation.ts"),
};

function existingFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

// registerHooks hooks are synchronous, so esbuild is imported up front. A
// missing esbuild only fails the .tsx tests, not the pure-logic ones.
const esbuild = await import("esbuild").catch((error) => ({ error }));

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mock = MODULE_MOCKS[specifier];
    if (mock) return nextResolve(pathToFileURL(mock).href, context);
    let target = null;
    if (specifier.startsWith("@/")) {
      target = resolve(srcDir, specifier.slice(2));
    } else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:") &&
      // Packages resolve their own relative requires (and expect a path, not
      // a file: URL, from a CommonJS require).
      !context.parentURL.includes("/node_modules/")
    ) {
      target = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target) {
      const file = existingFile(target);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && /\.css(\?.*)?$/.test(url)) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    if (url.startsWith("file:") && url.endsWith(".tsx")) {
      if (esbuild.error) throw esbuild.error;
      const file = fileURLToPath(url);
      const { code } = esbuild.transformSync(readFileSync(file, "utf8"), {
        loader: "tsx",
        format: "esm",
        jsx: "automatic",
        target: "node22",
        sourcefile: file,
        sourcemap: "inline",
      });
      return { format: "module", source: code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
