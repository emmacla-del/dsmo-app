import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DossierDiagnostic } from "./api-client";
import { EXCLUSION_REASONS, allowedDecisions, eligibilityAxis, endorsementAxis, qualityAxis } from "./dossier-axes";

function diagnostic(partial: Partial<DossierDiagnostic>): DossierDiagnostic {
  return {
    submissionId: "s1",
    axis1Status: "PENDING_REVIEW",
    axis2BlockingCount: 0,
    axis2WarningCount: 0,
    axis3Eligibility: "EXCLUDED",
    blockingAnomalies: [],
    warningAnomalies: [],
    ...partial,
  };
}

test("axis 1 follows the stored status, and says when there is none", () => {
  assert.deepEqual(endorsementAxis("APPROVED"), { key: "statusEndorsed", tone: "success" });
  assert.deepEqual(endorsementAxis("REJECTED"), { key: "statusRejected", tone: "error" });
  assert.equal(endorsementAxis(null).key, "statusNotRecorded");
  assert.equal(endorsementAxis("SOMETHING_NEW").key, "statusNotRecorded");
});

test("axis 2 reports blocking anomalies first, then warnings, then none", () => {
  const both = qualityAxis("ready", diagnostic({ axis2BlockingCount: 2, axis2WarningCount: 5 }));
  assert.deepEqual(both, { key: "axis2Blocking", values: { count: 2 }, tone: "error" });
  const warnings = qualityAxis("ready", diagnostic({ axis2WarningCount: 3 }));
  assert.deepEqual(warnings, { key: "axis2Warnings", values: { count: 3 }, tone: "warning" });
  assert.equal(qualityAxis("ready", diagnostic({})).key, "axis2None");
});

test("axes 2 and 3 never invent a figure when the diagnostic is missing", () => {
  assert.equal(qualityAxis("loading", null).key, "axisLoading");
  assert.equal(qualityAxis("unavailable", null).key, "axisUnavailable");
  assert.equal(eligibilityAxis("unavailable", null).key, "axisUnavailable");
  // "ready" without a payload is treated as unavailable too.
  assert.equal(eligibilityAxis("ready", null).key, "axisUnavailable");
});

test("axis 3 is eligible, the server's exclusion reason, or plain not-eligible", () => {
  assert.equal(eligibilityAxis("ready", diagnostic({ axis3Eligibility: "READY" })).key, "axis3Eligible");
  assert.deepEqual(
    eligibilityAxis("ready", diagnostic({ exclusionReason: "EXCL_WAITING_NAT_VISA" })),
    { key: "exclusion.EXCL_WAITING_NAT_VISA", tone: "warning" },
  );
  assert.equal(eligibilityAxis("ready", diagnostic({ exclusionReason: "EXCL_UNKNOWN" })).key, "axis3NotEligible");
  assert.equal(eligibilityAxis("ready", diagnostic({})).key, "axis3NotEligible");
});

test("every badge key has a label in both catalogues", () => {
  const keys = [
    "statusPending", "statusEndorsed", "statusCorrection", "statusRejected", "statusNotRecorded",
    "axisLoading", "axisUnavailable", "axis2Blocking", "axis2Warnings", "axis2None",
    "axis3Eligible", "axis3NotEligible", ...EXCLUSION_REASONS.map((reason) => `exclusion.${reason}`),
  ];
  for (const locale of ["fr", "en"]) {
    const catalogue = JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
    for (const key of keys) {
      const value = key.split(".").reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], catalogue.adminDossierPage);
      assert.equal(typeof value, "string", `${locale}: adminDossierPage.${key}`);
    }
  }
});

test("allowedDecisions mirrors the server's decision guards", () => {
  assert.deepEqual(allowedDecisions("PENDING_REVIEW"), { approve: true, reject: true, requestCorrection: true });
  assert.deepEqual(allowedDecisions("CORRECTION_REQUESTED"), { approve: false, reject: true, requestCorrection: false });
  for (const final of ["APPROVED", "REJECTED", null, undefined, "UNKNOWN"]) {
    assert.deepEqual(allowedDecisions(final), { approve: false, reject: false, requestCorrection: false });
  }
});

// Defect 13 (2026-10-16 VT run): an endorsed file can be reopened for
// correction by the central ONEFOP admins and submission specialists; the server says the same.
test("submission administrators may reopen an endorsed file", async () => {
  const { canReopenForCorrection } = await import("./dossier-axes");
  assert.equal(canReopenForCorrection("APPROVED", "SUPER_ADMIN"), true);
  assert.equal(canReopenForCorrection("APPROVED", "ADMIN_ONEFOP"), true);
  assert.equal(canReopenForCorrection("APPROVED", "ADMIN_ONEFOP_SUBMISSIONS"), true);
  for (const role of ["ADMIN_ONEFOP_REGISTRATIONS", "REGIONAL_ADMIN", "DIVISIONAL_ADMIN", "CENTRAL_AGENT", "COMPANY", null, undefined]) {
    assert.equal(canReopenForCorrection("APPROVED", role), false, String(role));
  }
  for (const status of ["PENDING_REVIEW", "CORRECTION_REQUESTED", "REJECTED", null]) {
    assert.equal(canReopenForCorrection(status, "SUPER_ADMIN"), false, String(status));
  }
});

// A file a newer submission replaced (SUPERSEDED, owner 2026-10-16): its
// own label, no decision, and excluded as replaced rather than as rejected.
test("a replaced file reads as replaced on every axis and offers no decision", () => {
  assert.deepEqual(endorsementAxis("SUPERSEDED"), { key: "statusSuperseded", tone: "neutral" });
  assert.deepEqual(
    eligibilityAxis("ready", diagnostic({ axis1Status: "SUPERSEDED", axis3Eligibility: "EXCLUDED", exclusionReason: "EXCL_SUPERSEDED" })),
    { key: "exclusion.EXCL_SUPERSEDED", tone: "neutral" },
  );
  assert.deepEqual(allowedDecisions("SUPERSEDED"), { approve: false, reject: false, requestCorrection: false });
  for (const locale of ["fr", "en"]) {
    const page = JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf-8")).adminDossierPage;
    assert.ok(page.statusSuperseded && page.supersededLine && page.openReplacingFile, locale);
    assert.ok(page.exclusion.EXCL_SUPERSEDED, locale);
  }
});
