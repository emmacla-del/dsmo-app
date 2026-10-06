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
  parseDossierStatus,
  parseQualiteVue,
  parseSeverityFilter,
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

test("dossier status: the four statuses, else every status", () => {
  for (const s of ["PENDING_REVIEW", "CORRECTION_REQUESTED", "APPROVED", "REJECTED"]) {
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
