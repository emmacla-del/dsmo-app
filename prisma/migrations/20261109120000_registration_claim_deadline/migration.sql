-- Claim deadlines (owner, CLAUDE.md §21, 2026-11-09): a claimed registration
-- must be decided within 2 hours of the claim and a claimed submission within
-- 12 hours, round the clock; past that the claim is released.
--
-- Additive: one nullable column and one index on "users". Nothing is dropped.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registrationClaimedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_registration_claim_idx"
  ON "users"("status", "assigneeId", "registrationClaimedAt");

-- A held pending registration takes the time of the latest claim record that
-- names its current holder. A holder with no such record (an assisted
-- registration, held by its author since creation, or a file held through a
-- decision) starts its clock at deploy. Files held for more than 2 hours are
-- therefore released by the first sweep after deploy, by design.
UPDATE "users" AS u
SET "registrationClaimedAt" = ev.claimed_at
FROM (
  SELECT DISTINCT ON (a."resourceId")
    a."resourceId" AS user_id,
    a."createdAt" AS claimed_at,
    a."details" ->> 'assigneeId' AS owner_id
  FROM "audit_logs" a
  WHERE a."resourceType" = 'User'
    AND a."action" = 'REGISTRATION_ASSIGNED'
  ORDER BY a."resourceId", a."createdAt" DESC
) AS ev
WHERE ev.user_id = u."id"
  AND ev.owner_id = u."assigneeId"
  AND u."assigneeId" IS NOT NULL
  AND u."registrationClaimedAt" IS NULL
  AND u."role" = 'COMPANY'
  AND u."status" = 'PENDING_APPROVAL';

UPDATE "users"
SET "registrationClaimedAt" = NOW()
WHERE "assigneeId" IS NOT NULL
  AND "registrationClaimedAt" IS NULL
  AND "role" = 'COMPANY'
  AND "status" = 'PENDING_APPROVAL';

-- Submissions: "claimActivityAt" now means the time of the claim, and saving
-- progress no longer moves it. A held submission with no time (legacy,
-- untracked) gets the deploy time, so it falls under the 12-hour deadline
-- instead of being held forever. Existing times are kept: they are the last
-- claim or progress, never earlier than the claim.
UPDATE "onefop_submissions"
SET "claimActivityAt" = NOW()
WHERE "assigneeId" IS NOT NULL
  AND "claimActivityAt" IS NULL
  AND "status"::text IN ('PENDING_REVIEW', 'CORRECTION_REQUESTED')
  AND "archivedAt" IS NULL;
