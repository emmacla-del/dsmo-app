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
  parseAnomalyFamilyFilter,
  parseAnomalyStatusFilter,
  parseDossierFlag,
  parseDossierQuarter,
  parseDossierSort,
  parseDossierStatus,
  parseDossierVue,
  parseRegistrationVue,
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

test("dossier filter changes keep the rest of the URL state for reload", () => {
  const filters = "vue=completed&status=REJECTED&formType=CTD&period=2025&region=Centre&department=Mfoundi&campaignId=c1&quarterCode=2025-T4&late=1&overdue=1&search=atelier";
  assert.equal(
    hrefWith("/admin/dossiers", filters, { formType: null }),
    "/admin/dossiers?vue=completed&status=REJECTED&period=2025&region=Centre&department=Mfoundi&campaignId=c1&quarterCode=2025-T4&late=1&overdue=1&search=atelier",
  );
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
  assert.equal(parseAnomalyFamilyFilter("COHERENCE"), "COHERENCE");
  assert.equal(parseAnomalyFamilyFilter("VT_COHERENCE"), "VT_COHERENCE");
  assert.equal(parseAnomalyFamilyFilter("ARITHMETIC"), "ARITHMETIC");
  assert.equal(parseAnomalyFamilyFilter("UNKNOWN"), "ALL");
  assert.equal(parseAnomalyFamilyFilter(null), "ALL");
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

test("dossier view aliases map to canonical submissions/completed/coverage", () => {
  assert.equal(parseDossierVue("dossiers"), "submissions");
  assert.equal(parseDossierVue("submissions"), "submissions");
  assert.equal(parseDossierVue("completed"), "completed");
  assert.equal(parseDossierVue("couverture"), "coverage");
  assert.equal(parseDossierVue("coverage"), "coverage");
  for (const v of [null, "", "files"]) assert.equal(parseDossierVue(v), "submissions");
});

test("registration view aliases map to canonical queue/organisations/coverage", () => {
  assert.equal(parseRegistrationVue("file"), "queue");
  assert.equal(parseRegistrationVue("queue"), "queue");
  assert.equal(parseRegistrationVue("organisations"), "organisations");
  assert.equal(parseRegistrationVue("couverture"), "coverage");
  assert.equal(parseRegistrationVue("coverage"), "coverage");
  for (const v of [null, "", "files"]) assert.equal(parseRegistrationVue(v), "queue");
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
