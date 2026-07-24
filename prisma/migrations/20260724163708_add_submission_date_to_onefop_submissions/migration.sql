-- AlterTable
-- Add submissionDate to onefop_submissions. Backfill existing rows from
-- createdAt (best available approximation of when they were submitted),
-- then lock the column to NOT NULL with a CURRENT_TIMESTAMP default for
-- all future inserts.
ALTER TABLE "onefop_submissions" ADD COLUMN "submissionDate" TIMESTAMP(3);

UPDATE "onefop_submissions" SET "submissionDate" = "createdAt" WHERE "submissionDate" IS NULL;

ALTER TABLE "onefop_submissions" ALTER COLUMN "submissionDate" SET NOT NULL;
ALTER TABLE "onefop_submissions" ALTER COLUMN "submissionDate" SET DEFAULT CURRENT_TIMESTAMP;
