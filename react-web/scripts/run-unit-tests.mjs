// Unit-test runner for react-web with no test-framework dependency: Node
// (>= 23.6) runs the *.test.ts files directly with native TypeScript type
// stripping and its built-in test runner; scripts/test-resolve.mjs supplies
// the "@/..." alias and extensionless imports. Pure-logic tests only (no DOM).
//
//   npm test                 all src/**/*.test.ts
//   npm test -- QuizSemantics only files whose path contains the filter
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const srcDir = join(root, "src");
const filter = process.argv[2];

function findTests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...findTests(full));
    else if (name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const tests = findTests(srcDir)
  .filter((f) => !filter || f.includes(filter))
  .map((f) => relative(root, f));
if (tests.length === 0) {
  console.error("No *.test.ts files found.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./scripts/test-resolve.mjs", "--test", ...tests],
  { stdio: "inherit", cwd: root, env: { ...process.env, REACT_WEB_ROOT: root } },
);
process.exitCode = result.status ?? 1;
