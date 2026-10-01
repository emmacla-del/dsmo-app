-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('EMPLOYMENT_SUMMARY', 'RECRUITMENT_ANALYSIS', 'DEPARTURE_ANALYSIS', 'SKILLS_NEEDS', 'TRAINING_NEEDS', 'SECTOR_BREAKDOWN', 'REGIONAL_SUMMARY', 'COMPLETION_RATE');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'EXCEL', 'CSV', 'JSON');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'IN_PROGRESS', 'VALIDATED', 'LATE', 'EXEMPT', 'NOT_STARTED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN_DSMO';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN_ONEFOP';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DATA_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CAMPAIGN_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ANALYST';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AUDITOR';

-- DropForeignKey
ALTER TABLE "onefop_fact_recruitments" DROP CONSTRAINT IF EXISTS "onefop_fact_recruitments_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "onefop_fact_skill_needs" DROP CONSTRAINT IF EXISTS "onefop_fact_skill_needs_submissionId_fkey";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "establishmentId" TEXT,
ADD COLUMN IF NOT EXISTS "establishmentIdGeneratedAt" TIMESTAMP(6);

-- AlterTable
ALTER TABLE "onefop_submissions" ADD COLUMN IF NOT EXISTS "cnpsNumber" TEXT,
ADD COLUMN IF NOT EXISTS "establishmentId" TEXT,
ADD COLUMN IF NOT EXISTS "metaJson" JSONB,
ADD COLUMN IF NOT EXISTS "quarterCode" TEXT DEFAULT '2025-T1',
ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT,
ADD COLUMN IF NOT EXISTS "taxNumber" TEXT;

-- CreateTable
CREATE TABLE "data_campaigns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "extendedDeadline" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "autoReminders" BOOLEAN NOT NULL DEFAULT false,
    "reminderDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "targetRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetDepartments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetEntityTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_submissions" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "companyId" TEXT,
    "establishmentId" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_reminders" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL DEFAULT 'INITIAL',
    "subject" TEXT,
    "message" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReportType",
    "reportType" "ReportType",
    "format" "ReportFormat" NOT NULL,
    "parameters" JSONB,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT,
    "expiresAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "reportType" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "parameters" JSONB,
    "schedule" TEXT NOT NULL,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frequency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_drafts" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "quarterCode" TEXT NOT NULL,
    "entityType" "OnefopEntityType" NOT NULL,
    "draftData" JSONB NOT NULL,
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedByUserId" TEXT,
    "completionScore" DOUBLE PRECISION,
    "missingFields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_campaigns_code_key" ON "data_campaigns"("code");

-- CreateIndex
CREATE INDEX "data_campaigns_status_idx" ON "data_campaigns"("status");

-- CreateIndex
CREATE INDEX "campaign_submissions_campaignId_idx" ON "campaign_submissions"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_submissions_companyId_idx" ON "campaign_submissions"("companyId");

-- CreateIndex
CREATE INDEX "campaign_submissions_establishmentId_idx" ON "campaign_submissions"("establishmentId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_submissions_campaignId_companyId_key" ON "campaign_submissions"("campaignId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_submissions_campaignId_establishmentId_key" ON "campaign_submissions"("campaignId", "establishmentId");

-- CreateIndex
CREATE INDEX "campaign_reminders_campaignId_idx" ON "campaign_reminders"("campaignId");

-- CreateIndex
CREATE INDEX "reports_reportType_idx" ON "reports"("reportType");

-- CreateIndex
CREATE INDEX "scheduled_reports_reportType_idx" ON "scheduled_reports"("reportType");

-- CreateIndex
CREATE INDEX "submission_drafts_establishmentId_idx" ON "submission_drafts"("establishmentId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_drafts_establishmentId_quarterCode_key" ON "submission_drafts"("establishmentId", "quarterCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_snapshots_year_region_department_key" ON "analytics_snapshots"("year", "region", "department");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_companies_establishmentId" ON "companies"("establishmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_onefop_submissions_establishmentId" ON "onefop_submissions"("establishmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_onefop_submissions_quarterCode" ON "onefop_submissions"("quarterCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "onefop_submissions_taxNumber_idx" ON "onefop_submissions"("taxNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "onefop_submissions_cnpsNumber_idx" ON "onefop_submissions"("cnpsNumber");

-- AddForeignKey
ALTER TABLE "data_campaigns" ADD CONSTRAINT "data_campaigns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_submissions" ADD CONSTRAINT "campaign_submissions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_submissions" ADD CONSTRAINT "campaign_submissions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_reminders" ADD CONSTRAINT "campaign_reminders_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_drafts" ADD CONSTRAINT "submission_drafts_savedByUserId_fkey" FOREIGN KEY ("savedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_fact_recruitments" ADD CONSTRAINT "onefop_fact_recruitments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_fact_skill_needs" ADD CONSTRAINT "onefop_fact_skill_needs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
