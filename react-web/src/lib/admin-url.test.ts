// Pins the URL state of /admin/dossiers and /admin/centre-qualite: a reload
// or a shared link must reopen the same view with the same filters, and an
// unknown value must fall back to the default rather than to an empty view.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import {
  anomalyRegisterHref,
  hrefWith,
  parseAnomalyStatusFilter,
  parseDossierFlag,
  parseDossierQuarter,
  parseDossierSort,
  parseDossierStatus,
  parseDossierVue,
  parseQualiteVue,
  parseSeverityFilter,
  recentDossierQuarters,
} from "./admin-url";

test("hrefWith sets and removes parameters and keeps the rest", () => {
  assert.equal(
    hrefWith("/admin/dossiers", "companyId=c1&q=abc", { status: "APPROVED" }),
    "/admin/dossiers?companyId=c1&q=abc&status=APPROVED",
  );
  assert.equal(hrefWith("/admin/dossiers", "status=APPROVED&q=abc", { status: "" }), "/admin/dossiers?q=abc");
  assert.equal(hrefWith("/admin/dossiers", "status=APPROVED", { status: null }), "/admin/dossiers");
  assert.equal(
    hrefWith("/admin/dossiers", "formType=CTD&status=REJECTED", { status: "PENDING_REVIEW" }),
    "/admin/dossiers?formType=CTD&status=PENDING_REVIEW",
  );
});

test("hrefWith encodes values instead of concatenating them", () => {
  assert.equal(hrefWith("/admin/annuaire", "", { tab: "users&x=1" }), "/admin/annuaire?tab=users%26x%3D1");
});

test("dossier status: the five statuses (replaced files included), else every status", () => {
  for (const s of ["PENDING_REVIEW", "CORRECTION_REQUESTED", "APPROVED", "REJECTED", "SUPERSEDED"]) {
    assert.equal(parseDossierStatus(s), s);
  }
  for (const s of [null, "", "pending_review", "ALL", "DRAFT"]) {
    assert.equal(parseDossierStatus(s), "");
  }
});

test("qualité view: known values, else the indicators", () => {
  assert.equal(parseQualiteVue("registre"), "registre");
  assert.equal(parseQualiteVue("regles"), "regles");
  assert.equal(parseQualiteVue("indicateurs"), "indicateurs");
  for (const v of [null, "", "regional", "anomalies"]) {
    assert.equal(parseQualiteVue(v), "indicateurs");
  }
});

test("register filters: known values, else ALL", () => {
  assert.equal(parseAnomalyStatusFilter("OPEN"), "OPEN");
  assert.equal(parseAnomalyStatusFilter("WAIVED"), "WAIVED");
  assert.equal(parseAnomalyStatusFilter("open"), "ALL");
  assert.equal(parseAnomalyStatusFilter(null), "ALL");
  assert.equal(parseSeverityFilter("BLOCKING"), "BLOCKING");
  assert.equal(parseSeverityFilter("WARNING"), "WARNING");
  assert.equal(parseSeverityFilter("CRITICAL"), "ALL");
  assert.equal(parseSeverityFilter(null), "ALL");
});

test("register links open the register, pre-filtered when asked", () => {
  assert.equal(anomalyRegisterHref(), "/admin/centre-qualite?vue=registre");
  assert.equal(
    anomalyRegisterHref({ status: "OPEN", severity: "BLOCKING" }),
    "/admin/centre-qualite?vue=registre&status=OPEN&severity=BLOCKING",
  );
});

test("parseDossierSort keeps oldest-first and falls back to newest first", () => {
  assert.equal(parseDossierSort("oldest"), "oldest");
  assert.equal(parseDossierSort(null), "");
  assert.equal(parseDossierSort("newest"), "");
  assert.equal(parseDossierSort("OLDEST"), "");
});

test("dossier view: coverage only when named", () => {
  assert.equal(parseDossierVue("couverture"), "couverture");
  assert.equal(parseDossierVue("dossiers"), "dossiers");
  for (const v of [null, "", "coverage", "files"]) {
    assert.equal(parseDossierVue(v), "dossiers");
  }
});

test("dossier flags are active only on an explicit true", () => {
  for (const raw of ["1", "true", "TRUE"]) assert.equal(parseDossierFlag(raw), true);
  for (const raw of [null, "", "0", "false", "yes"]) assert.equal(parseDossierFlag(raw), false);
});

test("dossier quarter: YYYY-Tn only", () => {
  assert.equal(parseDossierQuarter("2026-T4"), "2026-T4");
  assert.equal(parseDossierQuarter("2025-T1"), "2025-T1");
  for (const raw of [null, "", "2026-T5", "2026-Q4", "2026-T0", "26-T4"]) {
    assert.equal(parseDossierQuarter(raw), null);
  }
});

test("recent dossier quarters cross the year boundary", () => {
  assert.deepEqual(
    recentDossierQuarters(new Date("2026-01-15T00:00:00Z"), 5),
    ["2026-T1", "2025-T4", "2025-T3", "2025-T2", "2025-T1"],
  );
});
