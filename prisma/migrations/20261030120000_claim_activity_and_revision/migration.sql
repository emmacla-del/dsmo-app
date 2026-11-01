-- Persist the claim clock beside its owner and add a monotonic admin revision.
-- Existing claims are backfilled only when every latest-timestamp activity
-- event unambiguously identifies the currently persisted assignee. Ambiguous
-- or absent history remains NULL and is treated as active, untracked legacy
-- ownership; this migration never guesses an expiry from updatedAt.

ALTER TABLE "onefop_submissions"
  ADD COLUMN "claimActivityAt" TIMESTAMP(3),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

WITH current_claims AS (
  SELECT
    s."id" AS submission_id,
    s."assigneeId" AS current_owner_id,
    MAX(a."timestamp") AS latest_activity_at
  FROM "onefop_submissions" s
  JOIN "audit_logs" a
    ON a."resourceType" = 'OnefopSubmission'
   AND a."resourceId" = s."id"
   AND a."action" IN ('DOSSIER_ASSIGNED', 'DOSSIER_REVIEW_PROGRESS_SAVED')
  WHERE s."assigneeId" IS NOT NULL
    AND s."status"::text IN ('PENDING_REVIEW', 'CORRECTION_REQUESTED')
    AND s."archivedAt" IS NULL
  GROUP BY s."id", s."assigneeId"
), latest_events AS (
  SELECT
    c.submission_id,
    c.current_owner_id,
    c.latest_activity_at,
    CASE
      WHEN a."action" = 'DOSSIER_ASSIGNED' THEN a."details" ->> 'assigneeId'
      WHEN a."action" = 'DOSSIER_REVIEW_PROGRESS_SAVED'
        THEN COALESCE(a."details" ->> 'ownerId', a."userId")
      ELSE NULL
    END AS event_owner_id
  FROM current_claims c
  JOIN "audit_logs" a
    ON a."resourceType" = 'OnefopSubmission'
   AND a."resourceId" = c.submission_id
   AND a."action" IN ('DOSSIER_ASSIGNED', 'DOSSIER_REVIEW_PROGRESS_SAVED')
   AND a."timestamp" = c.latest_activity_at
), trustworthy_activity AS (
  SELECT submission_id, current_owner_id, latest_activity_at
  FROM latest_events
  GROUP BY submission_id, current_owner_id, latest_activity_at
  HAVING COUNT(*) = COUNT(event_owner_id)
     AND COUNT(DISTINCT event_owner_id) = 1
     AND MIN(event_owner_id) = current_owner_id
)
UPDATE "onefop_submissions" s
SET "claimActivityAt" = t.latest_activity_at
FROM trustworthy_activity t
WHERE s."id" = t.submission_id
  AND s."assigneeId" = t.current_owner_id
  AND s."claimActivityAt" IS NULL;

CREATE INDEX "onefop_submissions_claim_activity_idx"
  ON "onefop_submissions" ("status", "assigneeId", "claimActivityAt");
