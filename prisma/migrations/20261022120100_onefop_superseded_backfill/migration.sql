-- Backfill of SUPERSEDED (see 20261022120000_onefop_superseded_status).
--
-- A CORRECTION_REQUESTED submission is superseded when a later non-draft
-- submission exists for the same company and period (companyId,
-- quarterCode: the key of the live-submission index). It is replaced by the
-- first such later submission, so a chain A -> B -> C closes A by B and B
-- by C. Drafts never supersede anything. REJECTED files are final and are
-- not touched.
--
-- Each closure is written to the audit log as AUDIT_SUPERSEDED, attributed
-- to the respondent who filed the replacing submission (audit_logs.userId
-- is required; a replacing submission with no submitter is closed without
-- an audit row).

WITH pairs AS (
  SELECT
    old."id" AS old_id,
    (
      SELECT n."id"
      FROM "onefop_submissions" n
      WHERE n."companyId" = old."companyId"
        AND n."quarterCode" = old."quarterCode"
        AND n."id" <> old."id"
        AND n."status" <> 'DRAFT'
        AND n."createdAt" > old."createdAt"
      ORDER BY n."createdAt" ASC
      LIMIT 1
    ) AS new_id
  FROM "onefop_submissions" old
  WHERE old."status" = 'CORRECTION_REQUESTED'
    AND old."companyId" IS NOT NULL
    AND old."quarterCode" IS NOT NULL
),
closed AS (
  UPDATE "onefop_submissions" s
  SET "status" = 'SUPERSEDED',
      "supersededById" = p.new_id,
      "updatedAt" = NOW()
  FROM pairs p
  WHERE s."id" = p.old_id
    AND p.new_id IS NOT NULL
  RETURNING s."id" AS old_id, p.new_id
)
INSERT INTO "audit_logs" ("id", "userId", "action", "resourceType", "resourceId", "details", "timestamp", "createdAt")
SELECT
  gen_random_uuid()::text,
  n."submittedBy",
  'AUDIT_SUPERSEDED',
  'OnefopSubmission',
  c.old_id,
  jsonb_build_object(
    'previousStatus', 'CORRECTION_REQUESTED',
    'newStatus', 'SUPERSEDED',
    'supersededById', c.new_id,
    'source', 'backfill 2026-10-16'
  ),
  NOW(),
  NOW()
FROM closed c
JOIN "onefop_submissions" n ON n."id" = c.new_id
WHERE n."submittedBy" IS NOT NULL;
