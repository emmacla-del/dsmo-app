// Admin console bilingualism (Phase 1: the shell).
//
// The shared helpers take a locale and default to French, so untranslated
// callers keep rendering what they did; these tests pin both halves. The
// catalogue checks catch a key added to one language and not the other, and
// a navigation entry whose labelKey has no message.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NOT_PROVIDED,
  computeUserScopeLabel,
  count,
  dataStateMessage,
  elapsedSince,
  metricUnavailable,
  notRecorded,
  percent,
  stamp,
} from "./admin-data-state";
import { directoryRoleLabel } from "./user-directory";
import { ADMIN_HUBS } from "../app/admin/_routes";

type Catalogue = Record<string, unknown>;

function loadCatalogue(locale: "fr" | "en"): Catalogue {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
}

function flatKeys(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [prefix];
  return Object.entries(node as Catalogue).flatMap(([k, v]) => flatKeys(v, prefix ? `${prefix}.${k}` : k));
}

function lookup(catalogue: Catalogue, path: string): unknown {
  return path.split(".").reduce<unknown>((node, k) => (node as Catalogue | undefined)?.[k], catalogue);
}

test("computeUserScopeLabel: French by default, English on request", () => {
  const divisional = { role: "DIVISIONAL_ADMIN", region: "Centre", department: "Mfoundi" };
  assert.equal(computeUserScopeLabel(divisional), "Département Mfoundi");
  assert.equal(computeUserScopeLabel(divisional, "en"), "Department Mfoundi");
  assert.equal(computeUserScopeLabel({ role: "REGIONAL_ADMIN", region: "Littoral" }, "en"), "Region Littoral");
  assert.equal(computeUserScopeLabel({ role: "DIVISIONAL_ADMIN" }, "en"), "Departmental (unassigned)");
  assert.equal(computeUserScopeLabel({ role: "REGIONAL_ADMIN" }, "en"), "Regional (unassigned)");
  assert.equal(computeUserScopeLabel({ role: "SUPER_ADMIN" }, "en"), "National");
  assert.equal(computeUserScopeLabel({ role: "COMPANY" }, "en"), "Not recorded");
  // Absence is still the neutral marker, never a translated stand-in.
  assert.equal(computeUserScopeLabel(null, "en"), NOT_PROVIDED);
});

test("absence markers: French constants unchanged, English variants", () => {
  assert.equal(notRecorded(), "Non renseigné");
  assert.equal(notRecorded("en"), "Not recorded");
  assert.equal(metricUnavailable(), "Données non disponibles");
  assert.equal(metricUnavailable("en"), "Data not available");
});

test("elapsedSince: English wording", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  assert.equal(elapsedSince(ago(0), "en"), "Just now");
  assert.equal(elapsedSince(ago(5 * 60000), "en"), "5 min ago");
  assert.equal(elapsedSince(ago(3 * 3600000), "en"), "3 h ago");
  assert.equal(elapsedSince(ago(2 * 86400000), "en"), "2 d ago");
  assert.equal(elapsedSince(ago(5 * 60000)), "Il y a 5 min");
  assert.equal(elapsedSince(null, "en"), NOT_PROVIDED);
});

test("stamp / count / percent: en-GB keeps day-first dates and drops the French percent space", () => {
  const iso = "2026-03-07T10:00:00Z";
  assert.equal(stamp(iso, false), "07/03/2026");
  assert.equal(stamp(iso, false, "en"), "07/03/2026");
  assert.equal(count(1234, "en"), "1,234");
  assert.equal(percent(42, 0, "en"), "42%");
  assert.equal(percent(42), "42 %");
  // Zero is data in both languages.
  assert.equal(count(0, "en"), "0");
});

test("dataStateMessage: English messages, French default untouched", () => {
  assert.equal(dataStateMessage("error", "the files", "en"), "Unable to load the files.");
  assert.equal(dataStateMessage("empty", "the files", "en"), "No records for the files.");
  assert.equal(dataStateMessage("unavailable", "x", "en"), "Data not available");
  assert.equal(dataStateMessage("error", "les dossiers"), "Impossible de charger les dossiers.");
  assert.equal(dataStateMessage("ready", "x", "en"), null);
});

test("directoryRoleLabel: English role names", () => {
  assert.equal(directoryRoleLabel("REGIONAL_ADMIN", "en"), "Regional");
  assert.equal(directoryRoleLabel("DIVISIONAL_ADMIN", "en"), "Departmental");
  assert.equal(directoryRoleLabel("DIVISIONAL_ADMIN"), "Divisionnaire");
  assert.equal(directoryRoleLabel("SOME_NEW_ROLE", "en"), "SOME NEW ROLE");
});

test("messages: fr.json and en.json declare the same keys", () => {
  const fr = new Set(flatKeys(loadCatalogue("fr")));
  const en = new Set(flatKeys(loadCatalogue("en")));
  assert.deepEqual([...fr].filter((k) => !en.has(k)), [], "keys missing from en.json");
  assert.deepEqual([...en].filter((k) => !fr.has(k)), [], "keys missing from fr.json");
});

test("admin navigation: every hub and labelled sub-route has a message in both languages", () => {
  for (const locale of ["fr", "en"] as const) {
    const catalogue = loadCatalogue(locale);
    for (const hub of ADMIN_HUBS) {
      assert.equal(typeof lookup(catalogue, `adminNav.hubs.${hub.key}`), "string", `${locale}: hub ${hub.key}`);
      for (const sub of hub.subRoutes) {
        assert.ok(sub.labelKey, `${sub.href} has no labelKey`);
        assert.equal(typeof lookup(catalogue, `adminNav.routes.${sub.labelKey}`), "string", `${locale}: route ${sub.labelKey}`);
      }
    }
  }
  // The French message is the French label the route already carries.
  const fr = loadCatalogue("fr");
  for (const hub of ADMIN_HUBS) {
    assert.equal(lookup(fr, `adminNav.hubs.${hub.key}`), hub.label);
    for (const sub of hub.subRoutes) {
      assert.equal(lookup(fr, `adminNav.routes.${sub.labelKey}`), sub.label);
    }
  }
});
