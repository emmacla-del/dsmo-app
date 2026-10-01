-- Align CspCategory enum drift
ALTER TYPE "CspCategory" ADD VALUE IF NOT EXISTS 'FONCTIONNAIRE';
ALTER TYPE "CspCategory" ADD VALUE IF NOT EXISTS 'DECISIONNAIRE';
ALTER TYPE "CspCategory" ADD VALUE IF NOT EXISTS 'CONTRACTUELLE';

-- Drop legacy/truncated diploma indexes and recreate with Prisma's canonical name
DROP INDEX IF EXISTS "onefop_diploma_data_submissionId_diploma_gender_ageBand_key";
DROP INDEX IF EXISTS "onefop_diploma_data_submissionId_cspCategory_diploma_gender_age";
CREATE UNIQUE INDEX IF NOT EXISTS "onefop_diploma_data_submissionId_cspCategory_diploma_gender_key"
  ON "onefop_diploma_data"("submissionId", "cspCategory", "diploma", "gender", "ageBand");

-- Align submission_rounds foreign key, indexes, and column defaults
ALTER TABLE "submission_rounds" DROP CONSTRAINT IF EXISTS "submission_rounds_campaignId_fkey";
ALTER TABLE "submission_rounds" ADD CONSTRAINT "submission_rounds_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "submission_rounds_module_idx";
DROP INDEX IF EXISTS "submission_rounds_status_openedAt_idx";
CREATE INDEX IF NOT EXISTS "submission_rounds_module_status_idx"
  ON "submission_rounds"("module", "status");

ALTER TABLE "submission_rounds" ALTER COLUMN "targetRegions" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "submission_rounds" ALTER COLUMN "targetEntityTypes" SET DEFAULT ARRAY[]::"OnefopEntityType"[];
ALTER TABLE "submission_rounds" ALTER COLUMN "module" SET DEFAULT 'ONEFOP'::"SubmissionModule";

-- Align companies.attestationGeneratedAt timestamp precision
ALTER TABLE "companies" ALTER COLUMN "attestationGeneratedAt" TYPE TIMESTAMP(6);

-- Safely rename onefop_submissions indexes if old name exists and new name does not
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'OnefopSubmission_createdAt_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'onefop_submissions_createdAt_idx') THEN
    ALTER INDEX "OnefopSubmission_createdAt_idx" RENAME TO "onefop_submissions_createdAt_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'OnefopSubmission_department_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'onefop_submissions_department_idx') THEN
    ALTER INDEX "OnefopSubmission_department_idx" RENAME TO "onefop_submissions_department_idx";
  END IF;
END $$;

-- Drop obsolete manual backup table
DROP TABLE IF EXISTS "system_settings_backup";
