import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, type DossierClaimState } from "./api-client";
import {
  canChangeDossierClaim,
  canManageDossierListClaim,
  canSaveDossierReviewProgress,
  isActiveDossierClaimOwner,
  isDossierRevisionConflict,
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
