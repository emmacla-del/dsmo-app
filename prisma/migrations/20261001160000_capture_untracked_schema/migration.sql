-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "DiplomaType" ADD VALUE IF NOT EXISTS 'BEPC';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'EMPLOYMENT_TRENDS';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'GENDER_PARITY';

-- AlterTable: audit_logs
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
ADD COLUMN IF NOT EXISTS "reportId" TEXT,
ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'details' AND data_type = 'text'
  ) THEN
    ALTER TABLE "audit_logs" ALTER COLUMN "details" TYPE JSONB USING (
      CASE 
        WHEN "details" IS NULL OR "details" = '' THEN NULL 
        ELSE "details"::jsonb 
      END
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_reportId_idx" ON "audit_logs"("reportId");

-- AlterTable: reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
ADD COLUMN IF NOT EXISTS "fileHash" TEXT,
ADD COLUMN IF NOT EXISTS "filePath" TEXT,
ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'READY';

CREATE INDEX IF NOT EXISTS "idx_reports_fileHash" ON "reports"("fileHash");
CREATE INDEX IF NOT EXISTS "reports_approvalStatus_idx" ON "reports"("approvalStatus");
CREATE INDEX IF NOT EXISTS "reports_approvedBy_idx" ON "reports"("approvedBy");

ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_approvedBy_fkey";
ALTER TABLE "reports" ADD CONSTRAINT "reports_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- CreateTable: report_snapshots
CREATE TABLE IF NOT EXISTS "report_snapshots" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "computedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotData" JSONB NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "submissionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalHash" TEXT,

    CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "report_snapshots_reportId_key" ON "report_snapshots"("reportId");

ALTER TABLE "report_snapshots" DROP CONSTRAINT IF EXISTS "report_snapshots_reportid_fkey";
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_reportid_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTable: onefop_job_application_data
CREATE TABLE IF NOT EXISTS "onefop_job_application_data" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "submissionId" TEXT NOT NULL,
    "cspCategory" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "ageBand" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_job_application_data_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_job_application" ON "onefop_job_application_data"("submissionId", "cspCategory", "gender", "ageBand");
CREATE INDEX IF NOT EXISTS "idx_job_application_csp" ON "onefop_job_application_data"("cspCategory");
CREATE INDEX IF NOT EXISTS "idx_job_application_submission" ON "onefop_job_application_data"("submissionId");

ALTER TABLE "onefop_job_application_data" DROP CONSTRAINT IF EXISTS "fk_job_application_submission";
ALTER TABLE "onefop_job_application_data" ADD CONSTRAINT "fk_job_application_submission" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTable: onefop_registered_seekers
CREATE TABLE IF NOT EXISTS "onefop_registered_seekers" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "submissionId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "cspCategory" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "ageBand" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_registered_seekers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_registered_seeker" ON "onefop_registered_seekers"("submissionId", "contractType", "cspCategory", "gender", "ageBand");
CREATE INDEX IF NOT EXISTS "idx_registered_seeker_contract" ON "onefop_registered_seekers"("contractType");
CREATE INDEX IF NOT EXISTS "idx_registered_seeker_csp" ON "onefop_registered_seekers"("cspCategory");
CREATE INDEX IF NOT EXISTS "idx_registered_seeker_submission" ON "onefop_registered_seekers"("submissionId");

ALTER TABLE "onefop_registered_seekers" DROP CONSTRAINT IF EXISTS "fk_registered_seeker_submission";
ALTER TABLE "onefop_registered_seekers" ADD CONSTRAINT "fk_registered_seeker_submission" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTable: batch_jobs
CREATE TABLE IF NOT EXISTS "batch_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dateRange" JSONB NOT NULL,
    "sections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalReports" INTEGER NOT NULL,
    "completedReports" INTEGER NOT NULL DEFAULT 0,
    "failedReports" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "batch_jobs_status_idx" ON "batch_jobs"("status");
CREATE INDEX IF NOT EXISTS "batch_jobs_createdAt_idx" ON "batch_jobs"("createdAt");

ALTER TABLE "batch_jobs" DROP CONSTRAINT IF EXISTS "batch_jobs_createdBy_fkey";
ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- CreateTable: distribution_lists
CREATE TABLE IF NOT EXISTS "distribution_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distribution_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "distribution_lists_isActive_idx" ON "distribution_lists"("isActive");

ALTER TABLE "distribution_lists" DROP CONSTRAINT IF EXISTS "distribution_lists_createdBy_fkey";
ALTER TABLE "distribution_lists" ADD CONSTRAINT "distribution_lists_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- CreateTable: distribution_logs
CREATE TABLE IF NOT EXISTS "distribution_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reportId" TEXT NOT NULL,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentBy" TEXT NOT NULL,

    CONSTRAINT "distribution_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "distribution_logs_reportId_idx" ON "distribution_logs"("reportId");
CREATE INDEX IF NOT EXISTS "distribution_logs_sentAt_idx" ON "distribution_logs"("sentAt");

ALTER TABLE "distribution_logs" DROP CONSTRAINT IF EXISTS "distribution_logs_reportId_fkey";
ALTER TABLE "distribution_logs" ADD CONSTRAINT "distribution_logs_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "distribution_logs" DROP CONSTRAINT IF EXISTS "distribution_logs_sentBy_fkey";
ALTER TABLE "distribution_logs" ADD CONSTRAINT "distribution_logs_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
