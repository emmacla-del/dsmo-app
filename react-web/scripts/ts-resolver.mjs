import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

// If imported directly via --import, register ourselves
if (import.meta.url) {
  try {
    register(import.meta.url);
  } catch {}
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "src");

export async function resolve(specifier, context, nextResolve) {
  let candidate = null;

  if (specifier.startsWith("@/")) {
    candidate = path.join(srcDir, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL &&
    context.parentURL.startsWith("file:")
  ) {
    const parentFile = fileURLToPath(context.parentURL);
    candidate = path.resolve(path.dirname(parentFile), specifier);
  }

  if (candidate) {
    const extensions = ["", ".ts", ".tsx", ".js", ".mjs", ".json", "/index.ts", "/index.js"];
    for (const ext of extensions) {
      const full = candidate + ext;
      if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
        return nextResolve(pathToFileURL(full).href, context);
      }
    }
  }

  return nextResolve(specifier, context);
}
