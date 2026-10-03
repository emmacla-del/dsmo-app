#!/usr/bin/env node
/**
 * Data Integrity Guard for CAM-LEAP/ONEFOP Administrative UI.
 *
 * Verifies that no production administrative code introduces or restores:
 *  - Fabricated mock/demo datasets or fixtures (FIGMA_*, DEFAULT_SAMPLE_*, etc.)
 *  - Hardcoded administrative defaults (e.g. fallback campaign strings, fake user IDs)
 *  - Invented administrative person names or company entities in UI code
 *
 * Excludes test files, build artifacts, test fixtures, and scripts.
 *
 * Usage:
 *   node scripts/check-admin-data-integrity.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
