import test from "node:test";
import assert from "node:assert/strict";
import { dossierNeighbourQuery } from "./dossier-neighbour-query";

test("dossier returnTo maps my queue filters to the admin list query", () => {
  assert.deepEqual(dossierNeighbourQuery("/admin/dossiers?vue=submissions&submissionsStatus=PENDING_REVIEW&submissionsAssignment=me&submissionsSearch=abc&submissionsSort=oldest"), {
    view: "mine",
    filters: { status: "PENDING_REVIEW", assignment: "me", search: "abc", sort: "oldest" },
  });
});

test("dossier returnTo retains filters and resolves an unassigned view", () => {
  assert.deepEqual(dossierNeighbourQuery("/admin/dossiers?vue=submissions&submissionsStatus=PENDING_REVIEW&submissionsAssignment=unassigned&campaignId=camp-1&submissionsRegion=North&submissionsQuarterCode=2026-T2&submissionsLate=1&submissionsOverdue=true&submissionsQuality=warnings&submissionsCompanyId=company-1"), {
    view: "unassigned",
    filters: {
      status: "PENDING_REVIEW", assignment: "unassigned", campaignId: "camp-1", region: "North",
      late: true, overdue: true, quality: "warnings", companyId: "company-1",
    },
  });
});

test("an explicit queue view supplies its list status even when the URL has no status filter", () => {
  assert.deepEqual(dossierNeighbourQuery("/admin/dossiers?vue=submissions&queueView=corrections"), {
    view: "corrections",
    filters: { status: "CORRECTION_REQUESTED" },
  });
  assert.deepEqual(dossierNeighbourQuery("/admin/dossiers?vue=submissions&queueView=pending&submissionsAssignment=other"), {
    view: "pending",
    filters: { status: "PENDING_REVIEW", assignment: "other" },
  });
});

test("saved completed view preserves archive filtering and read-only roles resolve safely", () => {
  assert.deepEqual(dossierNeighbourQuery("/admin/dossiers?vue=completed&completedStatus=APPROVED&completedIncludeArchived=false", true), {
    view: null,
    filters: { status: "APPROVED", includeArchived: false },
  });
  assert.equal(dossierNeighbourQuery("/admin/dossiers?vue=submissions&submissionsStatus=PENDING_REVIEW&submissionsAssignment=me", true).view, "pending");
});
