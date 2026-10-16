-- A correction request answered by a newer submission is closed as
-- SUPERSEDED (owner, CLAUDE.md §21, 2026-10-16). Before this, the old file
-- stayed CORRECTION_REQUESTED forever after the respondent resubmitted: in
-- the reviewers' queue ("awaiting the respondent"), in the pilotage counts
-- and on the respondent's home, next to the file that replaced it.
--
-- Schema only. The enum value must be committed before any statement uses
-- it (PostgreSQL), so the backfill is the next migration.
--
-- SUPERSEDED stays outside the partial unique index
-- onefop_submissions_company_quarter_live_uidx (PENDING_REVIEW, APPROVED):
-- a closed file never occupies the period's slot.

ALTER TYPE "OnefopStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

ALTER TABLE "onefop_submissions" ADD COLUMN "supersededById" TEXT;

ALTER TABLE "onefop_submissions"
  ADD CONSTRAINT "onefop_submissions_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "onefop_submissions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
