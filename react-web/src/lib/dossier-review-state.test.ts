import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, type DossierClaimState } from "./api-client";
import {
  canChangeDossierClaim,
  canManageDossierListClaim,
  canSaveDossierReviewProgress,
  isActiveDossierClaimOwner,
  isDossierRevisionConflict,
  selectDossierQueuePrimaryAction,
} from "./dossier-review-state";

const claim = (values: Partial<DossierClaimState> = {}): DossierClaimState => ({
  submissionId: "dossier-1",
  status: "PENDING_REVIEW",
  eligible: true,
  assigneeId: null,
  assigneeName: null,
  expired: false,
  activityTracked: true,
  lastActivityAt: null,
  expiresAt: null,
  ...values,
});

test("claim controls follow server eligibility, effective ownership, and survey-role access", () => {
  assert.equal(canChangeDossierClaim(claim(), "agent-1", "ADMIN_ONEFOP_SUBMISSIONS"), true);
  assert.equal(canChangeDossierClaim(claim({ assigneeId: "agent-2" }), "agent-1", "ADMIN_ONEFOP_SUBMISSIONS"), false);
  assert.equal(canChangeDossierClaim(claim({ eligible: false, status: "APPROVED" }), "agent-1", "ADMIN_ONEFOP"), false);
  assert.equal(canChangeDossierClaim(claim(), "agent-1", "CENTRAL_AGENT"), false);
});

test("list claim actions require a claimable, non-archived row and current effective ownership", () => {
  assert.equal(canManageDossierListClaim("PENDING_REVIEW", false, null, "agent-1", "ADMIN_ONEFOP"), true);
  assert.equal(canManageDossierListClaim("CORRECTION_REQUESTED", false, "agent-1", "agent-1", "ADMIN_ONEFOP"), true);
  assert.equal(canManageDossierListClaim("PENDING_REVIEW", false, "agent-2", "agent-1", "ADMIN_ONEFOP"), false);
  assert.equal(canManageDossierListClaim("APPROVED", false, null, "agent-1", "ADMIN_ONEFOP"), false);
  assert.equal(canManageDossierListClaim("PENDING_REVIEW", true, null, "agent-1", "ADMIN_ONEFOP"), false);
  assert.equal(canManageDossierListClaim("PENDING_REVIEW", false, null, "agent-1", "CENTRAL_AGENT"), false);
});

test("expired claims are unowned effectively and can be reclaimed, but cannot authorize review progress", () => {
  const expired = claim({ assigneeId: null, expired: true });
  assert.equal(isActiveDossierClaimOwner(expired, "agent-1"), false);
  assert.equal(canChangeDossierClaim(expired, "agent-1", "ADMIN_ONEFOP"), true);
  assert.equal(canSaveDossierReviewProgress(expired, "agent-1", "ADMIN_ONEFOP", 4), false);
});

test("review progress requires an active server-owned claim and a valid dossier revision", () => {
  const mine = claim({ assigneeId: "agent-1", assigneeName: "Agent One" });
  assert.equal(isActiveDossierClaimOwner(mine, "agent-1"), true);
  assert.equal(canSaveDossierReviewProgress(mine, "agent-1", "ADMIN_ONEFOP_SUBMISSIONS", 0), true);
  assert.equal(canSaveDossierReviewProgress(mine, "agent-2", "ADMIN_ONEFOP_SUBMISSIONS", 1), false);
  assert.equal(canSaveDossierReviewProgress(mine, "agent-1", "ADMIN_ONEFOP_SUBMISSIONS", -1), false);
  assert.equal(canSaveDossierReviewProgress(mine, "agent-1", "ADMIN_ONEFOP_SUBMISSIONS", 1.5), false);
  assert.equal(canSaveDossierReviewProgress(mine, "agent-1", "ADMIN_ONEFOP_SUBMISSIONS", 2147483648), false);
});

test("only an HTTP 409 is treated as a dossier revision or claim conflict", () => {
  assert.equal(isDossierRevisionConflict(new ApiError(409, "changed")), true);
  assert.equal(isDossierRevisionConflict(new ApiError(403, "forbidden")), false);
  assert.equal(isDossierRevisionConflict(new Error("changed")), false);
});

test("queue primary action matches ownership, checks, status, and role", () => {
  const base = { status: "PENDING_REVIEW", assigneeId: null, userId: "agent-1", readOnly: false, validationDataAvailable: true, blockingCount: 0, warningCount: 0, archived: false, claimExpired: false, canClaim: true };
  assert.equal(selectDossierQueuePrimaryAction(base), "claim");
  assert.equal(selectDossierQueuePrimaryAction({ ...base, assigneeId: "agent-1", blockingCount: 1 }), "review-issues");
  assert.equal(selectDossierQueuePrimaryAction({ ...base, assigneeId: "agent-1", validationDataAvailable: false }), "review-issues");
  assert.equal(selectDossierQueuePrimaryAction({ ...base, assigneeId: "agent-1" }), "validate");
  assert.equal(selectDossierQueuePrimaryAction({ ...base, assigneeId: "agent-2" }), "view");
  assert.equal(selectDossierQueuePrimaryAction({ ...base, status: "CORRECTION_REQUESTED", assigneeId: "agent-1" }), "history");
  assert.equal(selectDossierQueuePrimaryAction({ ...base, status: "APPROVED" }), "view");
  assert.equal(selectDossierQueuePrimaryAction({ ...base, readOnly: true }), "view");
  // A role that may not claim never sees Réclamer or Valider, even on its own row.
  assert.equal(selectDossierQueuePrimaryAction({ ...base, canClaim: false }), "view");
  assert.equal(selectDossierQueuePrimaryAction({ ...base, assigneeId: "agent-1", canClaim: false }), "view");
  // Someone else's expired claim is free to take.
  assert.equal(selectDossierQueuePrimaryAction({ ...base, assigneeId: "agent-2", claimExpired: true }), "claim");
});
