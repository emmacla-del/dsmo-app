#!/usr/bin/env node
/**
 * Data Integrity Guard for CAM-LEAP/ONEFOP Administrative UI.
 *
 * Verifies that no production administrative code introduces or restores:
 *  - Fabricated mock/demo datasets or fixtures (FIGMA_*, DEFAULT_SAMPLE_*, etc.)
 *  - Hardcoded administrative defaults (e.g. fallback campaign strings, fake user IDs)
 *  - Invented administrative person names or company entities in UI code
 *  - Fixed years and placeholder counts in admin interface text (« Campagne
 *    2026 », « cible 2026 », « depuis N jours »): a figure shown to an admin
 *    comes from a record, not from the text. Read from string literals and
 *    JSX text (not comments or code) under src/app/admin,
 *    src/components/admin, src/lib and src/hooks, and from the admin* namespaces of
 *    messages/fr.json and messages/en.json. Legitimate cases are listed in
 *    TEXT_ALLOWLIST with a reason.
 *
 * Excludes test files, build artifacts, test fixtures, and scripts.
 *
 * Usage:
 *   node scripts/check-admin-data-integrity.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");

const PRODUCTION_SCAN_DIRS = [
  join(root, "src", "app", "admin"),
  join(root, "src", "components", "admin"),
  join(root, "src", "lib"),
  join(root, "src", "hooks"),
];

// Patterns that must never appear in production administrative code
const FORBIDDEN_PATTERNS = [
  {
    regex: /\bFIGMA_[A-Z0-9_]+/i,
    description: "Figma mockup constant or dataset",
  },
  {
    regex: /\bCANONICAL_FALLBACK\b/i,
    description: "Forbidden canonical fallback dataset",
  },
  {
    regex: /\bDEFAULT_SAMPLE_[A-Z0-9_]+/i,
    description: "Default sample dataset",
  },
  {
    regex: /\bDEFAULT_AGENTS\b/,
    description: "Default fabricated agents list",
  },
  {
    regex: /\bDEFAULT_ACTIVITIES\b/,
    description: "Default fabricated activity events",
  },
  {
    regex: /\bSABC_DEFAULT_COMPANY\b/,
    description: "Default SABC company spread base",
  },
  {
    regex: /\bDEFAULT_GIC\b/,
    description: "Default GIC entity spread base",
  },
  {
    regex: /\bINITIAL_RECENT_AUDIT\b/,
    description: "Fabricated initial recent audit events",
  },
  {
    regex: /\bCANONICAL_SECTIONS\b/,
    description: "Hardcoded canonical sections (use authoritative AST schema instead)",
  },
  {
    regex: /\bINITIAL_ROLES\b/,
    description: "Fabricated initial roles (use SYSTEM_ROLES / ASSIGNABLE_ROLES)",
  },
  {
    regex: /\|\|\s*["']Campagne 2026-T1["']/,
    description: "Fallback active campaign string",
  },
  {
    regex: /["']usr-gic-1["']/,
    description: "Fabricated user ID fallback target",
  },
  {
    regex: /["']Jean-Paul Mbarga["']|["']Samuel Eto'o["']|["']Agent Ndongo["']|["']M\. Ewane["']/,
    description: "Hardcoded administrative official or declarant name",
  },
];

// Rules read from interface text only (see header).
const TEXT_RULES = [
  {
    regex: /\b(?:19|20)\d{2}\b/,
    description: "Fixed year in interface text (derive it from the campaign, target or clock)",
  },
  {
    regex: /\bN\s+(?:jours?|days?|mois|months?|semaines?|weeks?|dossiers?|files?)\b/,
    description: "Placeholder count in interface text (state the real figure)",
  },
];

const TEXT_SCAN_DIRS = [
  join(root, "src", "app", "admin"),
  join(root, "src", "components", "admin"),
  join(root, "src", "lib"),
  join(root, "src", "hooks"),
];
const TEXT_SCAN_CATALOGUES = ["fr", "en"].map((locale) => join(root, "messages", `${locale}.json`));

// "<path>#<message key>" for catalogue entries, "<path>#<literal text>" for
// source text. Each entry says why the text may keep its figure.
const TEXT_ALLOWLIST = new Map([
  ["messages/fr.json#adminCampagnesPage.referenceYearPlaceholder", "input placeholder showing the expected format"],
  ["messages/en.json#adminCampagnesPage.referenceYearPlaceholder", "input placeholder showing the expected format"],
  ["src/lib/onefop-validation.ts#L'année doit être ≥ 1900", "validation bound, not a reporting year"],
  ["src/lib/onefop-validation.ts#Year must be ≥ 1900", "validation bound, not a reporting year"],
]);

function isTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return (
    normalized.endsWith(".test.ts") ||
    normalized.endsWith(".test.tsx") ||
    normalized.endsWith(".spec.ts") ||
    normalized.endsWith(".spec.tsx") ||
    normalized.includes("/__tests__/") ||
    normalized.includes("/test/")
  );
}

function collectFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...collectFiles(fullPath));
      } else if (
        (entry.endsWith(".ts") || entry.endsWith(".tsx") || entry.endsWith(".js") || entry.endsWith(".jsx")) &&
        !isTestFile(fullPath)
      ) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return results;
}

const allFiles = PRODUCTION_SCAN_DIRS.flatMap((dir) => collectFiles(dir));

let violationsCount = 0;

for (const file of allFiles) {
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    // Ignore pure comment lines documenting the removal of old mock symbols
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      return;
    }

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.regex.test(line)) {
        console.error(
          `\x1b[31m[INTEGRITY VIOLATION]\x1b[0m ${relative(root, file)}:${idx + 1}\n` +
            `  Pattern: ${rule.description} (${rule.regex})\n` +
            `  Line: ${trimmed}\n`
        );
        violationsCount++;
      }
    }
  });
}

function reportText(location, allowKey, text) {
  for (const rule of TEXT_RULES) {
    if (!rule.regex.test(text) || TEXT_ALLOWLIST.has(allowKey)) continue;
    console.error(
      `\x1b[31m[INTEGRITY VIOLATION]\x1b[0m ${location}\n` +
        `  Pattern: ${rule.description} (${rule.regex})\n` +
        `  Text: ${text.trim()}\n`
    );
    violationsCount++;
  }
}

const textFiles = TEXT_SCAN_DIRS.flatMap((dir) => collectFiles(dir));

for (const file of textFiles) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true, kind);
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      reportText(`${rel}:${line + 1}`, `${rel}#${node.text.trim()}`, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

for (const catalogue of TEXT_SCAN_CATALOGUES) {
  const rel = relative(root, catalogue).replace(/\\/g, "/");
  const walk = (node, key) => {
    if (typeof node === "string") reportText(`${rel} ${key}`, `${rel}#${key}`, node);
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, `${key}.${k}`);
  };
  const messages = JSON.parse(readFileSync(catalogue, "utf-8"));
  for (const [namespace, value] of Object.entries(messages)) {
    if (namespace.startsWith("admin")) walk(value, namespace);
  }
}

if (violationsCount > 0) {
  console.error(
    `\x1b[31mFAIL: Found ${violationsCount} data integrity violation(s) in ${allFiles.length} production files.\x1b[0m\n`
  );
  process.exit(1);
} else {
  console.log(
    `\x1b[32mPASS: All ${allFiles.length} production administrative files conform to data integrity standards.\x1b[0m`
  );
  process.exit(0);
}
