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
