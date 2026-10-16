import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_EXPORT_STATUSES, buildExportFilters } from "./diffusion-export-filters";

test("'Tous les statuts' lists every submitted status instead of sending none (none = approved only)", () => {
  const filters = buildExportFilters({ questionnaire: "DEMAND", status: "ALL" });
  assert.deepEqual(filters.statuses, ALL_EXPORT_STATUSES);
  assert.deepEqual(ALL_EXPORT_STATUSES, ["PENDING_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUESTED"]);
});

test("a single status is sent as itself", () => {
  assert.deepEqual(buildExportFilters({ questionnaire: "DEMAND", status: "APPROVED" }).statuses, ["APPROVED"]);
  assert.deepEqual(buildExportFilters({ questionnaire: "DEMAND", status: "REJECTED" }).statuses, ["REJECTED"]);
});

test("the training-centre questionnaire exports the VOCATIONAL_TRAINING type, whatever type was left selected", () => {
  const filters = buildExportFilters({ questionnaire: "TVET", status: "ALL", entityType: "ENTREPRISE" });
  assert.equal(filters.entityType, "VOCATIONAL_TRAINING");
  assert.equal(filters.partition, undefined);
});

test("the employer questionnaire keeps the DEMAND file and only accepts its own types", () => {
  const all = buildExportFilters({ questionnaire: "DEMAND", status: "APPROVED" });
  assert.equal(all.partition, "DEMAND");
  assert.equal(all.entityType, undefined);
  assert.equal(buildExportFilters({ questionnaire: "DEMAND", status: "APPROVED", entityType: "ONG" }).entityType, "ONG");
  // A training-centre type cannot ride along with the employer file (the server would refuse it).
  assert.equal(buildExportFilters({ questionnaire: "DEMAND", status: "APPROVED", entityType: "VOCATIONAL_TRAINING" }).entityType, undefined);
});

test("territory and campaign filters pass through; 'Toutes' means no region filter", () => {
  const filters = buildExportFilters({
    questionnaire: "TVET", status: "APPROVED", region: "Extrême-Nord", department: "Logone-et-Chari",
    campaign: "QUARTERLY_2026_T4_001", campaignId: "c-1",
  });
  assert.equal(filters.region, "Extrême-Nord");
  assert.equal(filters.department, "Logone-et-Chari");
  assert.equal(filters.campaign, "QUARTERLY_2026_T4_001");
  assert.equal(filters.campaignId, "c-1");
  assert.equal(buildExportFilters({ questionnaire: "DEMAND", status: "ALL", region: "Toutes" }).region, undefined);
});

// Defect 5 of the 2026-10-15 VT run.

test("the page opens on the questionnaire with more files; employers on a tie or while loading", async () => {
  const { defaultQuestionnaire } = await import("./diffusion-export-filters");
  assert.equal(defaultQuestionnaire({ VOCATIONAL_TRAINING: 4 }), "TVET");
  assert.equal(defaultQuestionnaire({ VOCATIONAL_TRAINING: 2, ENTREPRISE: 1, ONG: 2 }), "DEMAND");
  assert.equal(defaultQuestionnaire({ VOCATIONAL_TRAINING: 1, CTD: 1 }), "DEMAND");
  assert.equal(defaultQuestionnaire(null), "DEMAND");
});

test("the key figures add up: four statuses, drafts left out", async () => {
  const { repositoryCounts } = await import("./diffusion-export-filters");
  const c = repositoryCounts({ APPROVED: 1, PENDING_REVIEW: 1, CORRECTION_REQUESTED: 1, REJECTED: 1, DRAFT: 5 });
  assert.deepEqual(c, { total: 4, approved: 1, pending: 1, correction: 1, rejected: 1 });
  assert.equal(repositoryCounts({ APPROVED: 2 }).total, 2, "a status with no file is 0");
  assert.equal(repositoryCounts(undefined).total, null, "no breakdown, no figure");
  assert.equal(repositoryCounts([{ status: "APPROVED", _count: 3 }, { status: "CORRECTION_REQUESTED", _count: 1 }]).total, 4, "the groupBy rows shape too");
});

test("a CSV and its .sps share one name", async () => {
  const { csvExportNames } = await import("./diffusion-export-filters");
  assert.deepEqual(csvExportNames("onefop_export_X_2026-10-16"), {
    csv: "onefop_export_X_2026-10-16.csv",
    sps: "onefop_export_X_2026-10-16.sps",
  });
});
