#!/usr/bin/env node
/**
 * Table typography check — fails (exit 1) if the same kind of table cell
 * ("Homme"/"Femme" column headers, group headers, row labels, typed values)
 * renders with a different font size, weight, family or text alignment in
 * any table renderer, or if values/column headers are not centred.
 *
 *   npm run check:tables
 *
 * How: esbuild bundles fixtures.tsx (one table per renderer), React renders
 * it to HTML, Chromium (Playwright) loads it with the app's tokens.css +
 * globals.css, and the computed styles of every cell role are compared.
 */
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
// Inside the project so the bundle resolves react / next-intl from node_modules.
const out = join(root, "node_modules/.cache/cam-table-typography");
mkdirSync(out, { recursive: true });

// 1. Bundle + render the fixtures to HTML.
await build({
  entryPoints: [join(here, "fixtures.tsx")],
  bundle: true, platform: "node", format: "esm", jsx: "automatic",
  outfile: join(out, "fixtures.mjs"),
  alias: { "@": join(root, "src") },
  loader: { ".json": "json" },
  external: ["react", "react-dom", "next-intl", "next", "use-intl"],
  logLevel: "error",
});
const { renderAll } = await import(pathToFileURL(join(out, "fixtures.mjs")).href);
const tablesHtml = renderAll();

// 2. The app's own CSS (Tailwind directives are irrelevant to fonts: table
//    renderers may not use font utilities — see eslint.config.mjs).
const tokens = readFileSync(join(root, "src/app/tokens.css"), "utf8");
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8")
  .replace(/@import\s+"tailwindcss";/, "")
  .replace(/@import\s+"\.\/tokens\.css";/, "");
writeFileSync(join(out, "page.html"),
  `<!doctype html><meta charset="utf-8"><style>${tokens}\n${globals}</style><body>${tablesHtml}</body>`);

// 3. Compare computed styles per role across renderers.
const ROLES = {
  "leaf header (Homme, Femme…)": ".cam-dt-leaf",
  "group header (Permanent…)": ".cam-dt-group",
  "corner header": ".cam-dt-corner",
  "row label": ".cam-dt-rowhead:not(.cam-dt-rowhead--total):not(.cam-dt-rowhead--block)",
  "total row label": ".cam-dt-rowhead--total",
  "typed value": ".cam-dt-input:not(.cam-dt-input--computed):not(.cam-dt-input--text)",
  "free-text entry (left-aligned)": ".cam-dt-input--text",
  "computed value": ".cam-dt-input--computed, .cam-dt-value--computed",
  "empty dash": ".cam-dt-empty",
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(join(out, "page.html")).href);
const result = await page.evaluate((roles) => {
  const sig = (el) => {
    const s = getComputedStyle(el);
    return `${s.fontSize} / ${s.fontWeight} / align ${s.textAlign} / ${s.fontFamily}`;
  };
  const report = {};
  for (const [role, sel] of Object.entries(roles)) {
    report[role] = {};
    for (const sec of document.querySelectorAll("section[data-renderer]")) {
      const sigs = [...new Set([...sec.querySelectorAll(sel)].map(sig))];
      if (sigs.length) report[role][sec.dataset.renderer] = sigs;
    }
  }
  // By TEXT, whatever piece drew it: every "Homme", "Femme" and age-band
  // header must look the same in every table. ("Total" is legitimately both
  // a group header and a column header, so it is covered by the per-role
  // comparison above instead.)
  const WORDS = ["Homme", "Femme", "15 à 24", "25 à 34", "35 et +"];
  const byWord = {};
  for (const th of document.querySelectorAll("section[data-renderer] thead th")) {
    const word = th.textContent.trim();
    if (!WORDS.includes(word)) continue;
    const r = th.closest("section").dataset.renderer;
    ((byWord[word] ??= {})[r] ??= new Set()).add(sig(th));
  }
  for (const w of Object.keys(byWord)) for (const r of Object.keys(byWord[w])) byWord[w][r] = [...byWord[w][r]];
  const leafText = [...document.querySelectorAll("thead th")].map((e) => e.textContent.trim());
  return { report, byWord, leafText };
}, ROLES);
await browser.close();

let failed = false;
for (const [role, byRenderer] of Object.entries(result.report)) {
  const all = new Set(Object.values(byRenderer).flat());
  const ok = all.size <= 1;
  if (!ok) failed = true;
  console.log(`${ok ? "✓" : "✗"} ${role}: ${ok ? [...all][0] ?? "(not present)" : ""}`);
  if (!ok) for (const [r, s] of Object.entries(byRenderer)) console.log(`    ${r}: ${s.join(" | ")}`);
}
for (const [word, byRenderer] of Object.entries(result.byWord)) {
  const all = new Set(Object.values(byRenderer).flat());
  const ok = all.size <= 1;
  if (!ok) failed = true;
  console.log(`${ok ? "✓" : "✗"} header "${word}" in ${Object.keys(byRenderer).join(", ")}${ok ? "" : ":"}`);
  if (!ok) for (const [r, s] of Object.entries(byRenderer)) console.log(`    ${r}: ${s.join(" | ")}`);
}
// Entries, values and column headers must be centred.
for (const role of ["leaf header (Homme, Femme…)", "group header (Permanent…)", "typed value", "computed value", "empty dash"]) {
  const sigs = Object.values(result.report[role] ?? {}).flat();
  if (sigs.some((x) => !x.includes("align center"))) { failed = true; console.log(`✗ ${role} is not centred`); }
}
for (const word of ["Homme", "Femme"]) {
  if (!result.leafText.includes(word)) { failed = true; console.log(`✗ no "${word}" column header was rendered`); }
}
console.log(failed ? "\nTable typography check FAILED" : "\nTable typography check passed");
process.exit(failed ? 1 : 0);
