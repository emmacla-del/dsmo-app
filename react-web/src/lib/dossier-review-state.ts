import { ApiError, type DossierClaimState } from "./api-client";
import { hasRole, SURVEY_ROLES } from "./roles";

/** Use only the effective state returned by GET /:id/claim-state. */
export function isActiveDossierClaimOwner(
  claim: DossierClaimState | null | undefined,
  userId: string | null | undefined,
): boolean {
  return Boolean(
    claim?.eligible &&
    !claim.expired &&
    userId &&
    claim.assigneeId === userId,
  );
}

/** Claim/release is offered only for backend-eligible states and survey roles. */
export function canChangeDossierClaim(
  claim: DossierClaimState | null | undefined,
  userId: string | null | undefined,
  role: string | null | undefined,
): boolean {
  return Boolean(
    claim?.eligible &&
    userId &&
    hasRole(role, SURVEY_ROLES) &&
    (!claim.assigneeId || claim.assigneeId === userId),
  );
}

/** List rows expose effective ownership but not the full claim-state DTO. */
export function canManageDossierListClaim(
  status: string | null | undefined,
  archived: boolean,
  effectiveAssigneeId: string | null | undefined,
  userId: string | null | undefined,
  role: string | null | undefined,
): boolean {
  return Boolean(
    (status === "PENDING_REVIEW" || status === "CORRECTION_REQUESTED") &&
    !archived &&
    userId &&
    hasRole(role, SURVEY_ROLES) &&
    (!effectiveAssigneeId || effectiveAssigneeId === userId),
  );
}

export function canSaveDossierReviewProgress(
  claim: DossierClaimState | null | undefined,
  userId: string | null | undefined,
  role: string | null | undefined,
  revision: unknown,
): revision is number {
  return Boolean(
    isActiveDossierClaimOwner(claim, userId) &&
    hasRole(role, SURVEY_ROLES) &&
    typeof revision === "number" &&
    Number.isSafeInteger(revision) &&
    revision >= 0 &&
    revision <= 2147483647,
  );
}

export function isDossierRevisionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export type DossierQueuePrimaryAction = "claim" | "review-issues" | "validate" | "view" | "history";

export function selectDossierQueuePrimaryAction(input: {
  status: string | null | undefined;
  assigneeId: string | null | undefined;
  userId: string | null | undefined;
  readOnly: boolean;
  validationDataAvailable: boolean;
  blockingCount: number;
  warningCount: number;
  archived: boolean;
  claimExpired: boolean;
  /** canManageDossierListClaim for a free file: role, status and archive allow a claim. */
  canClaim: boolean;
}): DossierQueuePrimaryAction {
  if (input.status === "CORRECTION_REQUESTED") return "history";
  if (input.status !== "PENDING_REVIEW") return "view";
  if (input.readOnly || !input.canClaim) return "view";
  if (input.assigneeId && input.assigneeId !== input.userId && !input.claimExpired) return "view";
  if (!input.assigneeId || input.claimExpired) return input.archived ? "view" : "claim";
  if (input.archived) return "view";
  if (!input.validationDataAvailable || input.blockingCount > 0 || input.warningCount > 0) return "review-issues";
  return "validate";
}
