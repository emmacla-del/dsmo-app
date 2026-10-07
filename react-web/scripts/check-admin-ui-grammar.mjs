#!/usr/bin/env node
/**
 * UI-grammar guard for the CAM-LEAP administrative console.
 *
 * Enforces the text-shaped and cross-file rules of
 * docs/standards/admin-ui-grammar.md. The AST-shaped rules (G7 dialogs, G12
 * toLocale*, G13 inline fontSize, Tailwind palette classes) are enforced by
 * the scoped `no-restricted-syntax` block in eslint.config.mjs; two of them
 * are counted here as well, so the ratchet stops them growing while ESLint is
 * still reporting the backlog.
 *
 * THE RATCHET
 * -----------
 * Blocking on day one is not possible: there are hundreds of existing
 * violations, so every rule would have to ship switched off, and a rule that
 * ships switched off never gets switched on. Instead
 * scripts/ui-grammar-baseline.json records the current per-file count for
 * each rule, and this script fails only when
 *
 *   - a file's count rises above its recorded baseline, or
 *   - a file with no baseline entry (a baseline of zero) gains one.
 *
 * Each step of the tidy plan lowers the baselines it touched. The baseline is
 * rewritten only under --update, so a lowering is a visible line in the diff
 * and never happens as a side effect of a passing run.
 *
 * Usage:
 *   node scripts/check-admin-ui-grammar.mjs            # check
 *   node scripts/check-admin-ui-grammar.mjs --update   # re-record baselines
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const BASELINE_PATH = join(root, "scripts", "ui-grammar-baseline.json");
const UPDATE = process.argv.includes("--update");

const rel = (p) => relative(root, p).replace(/\\/g, "/");

// ── Scan sets ───────────────────────────────────────────────────────────────

const ADMIN_DIRS = [
  join(root, "src", "app", "admin"),
  join(root, "src", "components", "admin"),
];

// The shared CSS layer. globals.css imports tokens.css and admin-console.css,
// so these reach every surface, admin and respondent alike.
const SHARED_CSS = [
  join(root, "src", "app", "admin-console.css"),
  join(root, "src", "app", "globals.css"),
];

// tokens.css is where colour values are allowed to exist, so it is a
// definition source for the phantom check but never scanned for hex.
const TOKEN_CSS = [...SHARED_CSS, join(root, "src", "app", "tokens.css")];

function isTestFile(p) {
  const n = p.replace(/\\/g, "/");
  return (
    /\.(test|spec)\.(ts|tsx)$/.test(n) ||
    n.includes("/__tests__/") ||
    n.includes("/test/")
  );
}

function collect(dir, exts) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    if (err.code === "ENOENT") return out;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full, exts));
    else if (exts.some((e) => entry.endsWith(e)) && !isTestFile(full)) out.push(full);
  }
  return out;
}

const collectAll = (dirs, exts) => dirs.flatMap((d) => collect(d, exts));

// ── Helpers ─────────────────────────────────────────────────────────────────

const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

// Drop a trailing line comment so prose naming an old hex is not a finding.
const stripJsComment = (line) => line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");

/**
 * Every `style={{ ... }}` object in a TSX file, brace-matched so a nested
 * object does not truncate the block. Returns the block text and the 1-based
 * line it starts on.
 */
function inlineStyleBlocks(src) {
  const blocks = [];
  const needle = "style={{";
  let i = src.indexOf(needle);
  while (i !== -1) {
    let depth = 0;
    let j = i + needle.length - 2; // at the first brace of the object itself
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j >= src.length) break; // unbalanced; stop rather than mis-report
    blocks.push({ text: src.slice(i, j + 1), line: src.slice(0, i).split("\n").length });
    i = src.indexOf(needle, j);
  }
  return blocks;
}

function findPerLine(files, predicate, { stripComments = false } = {}) {
  const out = [];
  for (const file of files) {
    let src;
    try {
      src = readFileSync(file, "utf-8");
    } catch (err) {
      if (err.code === "ENOENT") continue;
      throw err;
    }
    if (stripComments) src = stripCssComments(src);
    src.split("\n").forEach((line, i) => {
      if (predicate(line)) out.push({ file, line: i + 1, text: line.trim().slice(0, 110) });
    });
  }
  return out;
}

// G14 — the 4/8 scale --cam-space-* defines, plus 0.
const SPACING_SCALE = new Set([0, 4, 8, 12, 16, 24, 32, 48]);
const SPACING_PROPS =
  "padding|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingBlock|paddingInline|" +
  "margin|marginTop|marginBottom|marginLeft|marginRight|marginBlock|marginInline|" +
  "gap|rowGap|columnGap";

// ── Rules ───────────────────────────────────────────────────────────────────
// Each `run` returns [{ file, line, text }]. A `warn` rule is reported but
// never affects the exit code.

const RULES = [
  {
    key: "hex-in-tsx",
    rule: "G1",
    title: "Hex colour literal in admin TSX",
    fix: "Use a cam-* class, or var(--cam-*) where the value must be inline.",
    run: () =>
      findPerLine(collectAll(ADMIN_DIRS, [".ts", ".tsx"]), (line) =>
        /#[0-9a-fA-F]{3,8}\b/.test(stripJsComment(line))
      ),
  },
  {
    key: "hex-in-shared-css",
    rule: "G1",
    title: "Hex colour literal in the shared CSS layer",
    fix: "Define the value in tokens.css and reference the token. tokens.css itself is exempt — that is where values live.",
    run: () =>
      findPerLine(
        SHARED_CSS,
        (line) => {
          // A mask reads only the opacity channel, so its opaque stop has to
          // be a fully opaque literal; a palette token there would be wrong.
          if (/(^|[\s-])mask\s*:/.test(line)) return false;
          return /#[0-9a-fA-F]{3,8}\b/.test(line);
        },
        { stripComments: true }
      ),
  },
  {
    key: "font-size-literal",
    rule: "G13",
    title: "Literal font size in an inline style",
    fix: "Use the class, or a --cam-font-size-* token (3xs 11, 2xs 12, xs 13, sm 14, base 15, lg 18, xl 24, 2xl 25, 3xl 32).",
    run: () =>
      findPerLine(collectAll(ADMIN_DIRS, [".ts", ".tsx"]), (line) =>
        /fontSize:\s*["']?[0-9]/.test(line)
      ),
  },
  {
    key: "locale-format",
    rule: "G12",
    title: "Local toLocale* formatting",
    fix: "Use count / percent / stamp / shortStamp / elapsedSince from lib/admin-data-state.ts.",
    run: () =>
      findPerLine(collectAll(ADMIN_DIRS, [".ts", ".tsx"]), (line) =>
        /\.toLocale(String|DateString|TimeString)\s*\(/.test(stripJsComment(line))
      ),
  },
  {
    key: "bare-table",
    rule: "G6",
    title: "<table> with no cam table class",
    fix: "Wrap in .cam-table-wrapper and use .cam-table, or .cam-dash-table / .cam-pilot-table for numeric grids.",
    run: () =>
      findPerLine(
        collectAll(ADMIN_DIRS, [".tsx"]),
        (line) => /<table\b/.test(line) && !/cam-(table|dash-table|pilot-table)/.test(line)
      ),
  },
  {
    key: "spacing-off-scale",
    rule: "G14",
    title: "Inline length off the 4/8 spacing scale",
    fix: "Use var(--cam-space-*): 1=4 2=8 3=12 4=16 5=24 6=32 7=48.",
    warn: true,
    run: () => {
      const out = [];
      const re = new RegExp(`\\b(${SPACING_PROPS}):\\s*"?(-?[0-9]+(?:\\.[0-9]+)?)(px)?"?`, "g");
      for (const file of collectAll(ADMIN_DIRS, [".tsx"])) {
        const src = readFileSync(file, "utf-8");
        for (const block of inlineStyleBlocks(src)) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(block.text)) !== null) {
            if (!SPACING_SCALE.has(Math.abs(Number(m[2])))) {
              out.push({ file, line: block.line, text: `${m[1]}: ${m[2]}${m[3] ?? ""}` });
            }
          }
        }
      }
      return out;
    },
  },
  {
    key: "card-proxy",
    rule: "G4",
    title: "Inline style painting a card (background and border together)",
    fix: "Use .cam-dash-card, .cam-admin-section or .cam-pilot-panel.",
    warn: true,
    run: () => {
      const out = [];
      for (const file of collectAll(ADMIN_DIRS, [".tsx"])) {
        const src = readFileSync(file, "utf-8");
        for (const block of inlineStyleBlocks(src)) {
          const hasBg = /\b(background|backgroundColor):/.test(block.text);
          const hasBorder = /\b(border|borderColor|borderWidth):/.test(block.text);
          if (hasBg && hasBorder) {
            out.push({ file, line: block.line, text: "inline background + border" });
          }
        }
      }
      return out;
    },
  },
  {
    key: "datastate-adoption",
    rule: "G10",
    title: "Queries data but does not report its non-ready states",
    fix: "Render DataState / DataStateRow from resolveDataState, so loading, empty, error, forbidden, unavailable and notFound stay distinct.",
    warn: true,
    run: () => {
      const out = [];
      for (const file of collectAll(ADMIN_DIRS, [".tsx"])) {
        const src = readFileSync(file, "utf-8");
        if (/\buseQuer(y|ies)\b/.test(src) && !/\bDataState\b/.test(src)) {
          out.push({ file, line: 1, text: "useQuery without DataState" });
        }
      }
      return out;
    },
  },
];

// ── Phantom tokens — blocks immediately, never baselined ────────────────────
// Every var(--cam-*) must resolve to a definition. A reference with no
// definition and no fallback is not a style preference: the declaration is
// dropped, so the element renders transparent or unstyled.

function phantomTokens() {
  const defined = new Set();
  for (const file of TOKEN_CSS) {
    let src;
    try {
      src = stripCssComments(readFileSync(file, "utf-8"));
    } catch (err) {
      if (err.code === "ENOENT") continue;
      throw err;
    }
    // Any `--cam-name:` assignment, including a local contract variable set
    // inside a rule, such as `.cam-kpi-tile--warning { --cam-kpi-tone: … }`.
    for (const m of src.matchAll(/(--cam-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  }

  const out = [];
  for (const file of collect(join(root, "src"), [".tsx", ".ts", ".css"])) {
    const src = readFileSync(file, "utf-8");
    src.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/var\(\s*(--cam-[a-z0-9-]+)\s*([,)])/g)) {
        const [, name, next] = m;
        if (defined.has(name)) continue;
        // A fallback keeps the declaration valid, so it is not a phantom.
        if (next === ",") continue;
        out.push({ file, line: i + 1, token: name });
      }
    });
  }
  return out;
}

// ── Run ─────────────────────────────────────────────────────────────────────

const C = { red: "\x1b[31m", yellow: "\x1b[33m", green: "\x1b[32m", dim: "\x1b[2m", off: "\x1b[0m" };

let baseline = { rules: {} };
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
  if (!UPDATE) {
    console.error(`${C.red}No baseline at ${rel(BASELINE_PATH)}. Create it with --update.${C.off}`);
    process.exit(1);
  }
}

const nextRules = {};
let failed = 0;
let warned = 0;
let improved = 0;

// Phantom tokens first: they are rendering bugs, and they have no baseline.
const phantoms = phantomTokens();
if (phantoms.length > 0) {
  console.error(`\n${C.red}✗ phantom-token${C.off} — var(--cam-*) with no definition and no fallback`);
  console.error(`${C.dim}  The declaration is dropped, so the element renders transparent or unstyled.${C.off}`);
  console.error(`${C.dim}  Define it in src/app/tokens.css, or point it at the token it was reaching for.${C.off}`);
  for (const p of phantoms) console.error(`    ${rel(p.file)}:${p.line}  ${p.token}`);
  failed += phantoms.length;
}

for (const rule of RULES) {
  const found = rule.run();
  const base = baseline.rules?.[rule.key] ?? {};

  const counts = {};
  const byFile = new Map();
  for (const f of found) {
    const key = rel(f.file);
    counts[key] = (counts[key] ?? 0) + 1;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(f);
  }
  nextRules[rule.key] = Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  );

  const risen = [];
  for (const [file, n] of Object.entries(counts)) {
    const was = base[file] ?? 0;
    if (n > was) risen.push({ file, n, was });
  }
  for (const [file, was] of Object.entries(base)) {
    if ((counts[file] ?? 0) < was) improved++;
  }

  if (risen.length === 0) continue;

  const label = rule.warn ? `${C.yellow}⚠ ${rule.key}${C.off}` : `${C.red}✗ ${rule.key}${C.off}`;
  console.error(`\n${label} ${C.dim}(${rule.rule})${C.off} — ${rule.title}`);
  console.error(`${C.dim}  ${rule.fix}${C.off}`);
  for (const r of risen.sort((a, b) => b.n - a.n)) {
    console.error(`    ${r.file}  ${C.dim}baseline ${r.was} → ${r.n}${C.off}`);
    const hits = byFile.get(r.file);
    for (const f of hits.slice(0, 6)) console.error(`      :${f.line}  ${f.text}`);
    if (hits.length > 6) console.error(`      ${C.dim}… and ${hits.length - 6} more${C.off}`);
  }
  if (rule.warn) warned += risen.length;
  else failed += risen.length;
}

if (UPDATE) {
  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    note:
      "Per-file violation counts for scripts/check-admin-ui-grammar.mjs. The check " +
      "fails when a count rises above its entry here, or when a file absent from a " +
      "rule (baseline 0) gains one. Lower these as each step of " +
      "docs/audit/app-tidy-plan-2026-10-06.md lands; never raise one to make a commit " +
      "pass. Rewritten only by --update, so a change is always visible in the diff.",
    rules: nextRules,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  const total = Object.values(nextRules).reduce(
    (sum, files) => sum + Object.values(files).reduce((a, b) => a + b, 0),
    0
  );
  console.log(
    `\n${C.green}Baseline rewritten${C.off} → ${rel(BASELINE_PATH)} ` +
      `(${total} violations across ${Object.keys(nextRules).length} rules)`
  );
  process.exit(phantoms.length > 0 ? 1 : 0);
}

if (improved > 0) {
  console.log(
    `\n${C.green}${improved} file/rule pair(s) are now below baseline.${C.off} ` +
      `Lower it in the same commit: npm run check:ui-grammar -- --update`
  );
}

if (failed > 0) {
  console.error(
    `\n${C.red}FAIL: ${failed} blocking UI-grammar regression(s).${C.off} ` +
      `See docs/standards/admin-ui-grammar.md.\n`
  );
  process.exit(1);
}

if (warned > 0) {
  console.log(`\n${C.yellow}${warned} advisory regression(s) — not blocking.${C.off}`);
}

console.log(`${C.green}PASS: no UI-grammar regression above baseline.${C.off}`);
process.exit(0);
