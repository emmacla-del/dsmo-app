-- Phase 1: Projects & Programs ONEFOP entity type (structural
-- implementation). Additive only — no existing enum values, tables, or
-- columns are altered or removed. Safe for the five currently-operational
-- entity types (Enterprise, Cooperative, CTD, ONG, Administration); their
-- data/behavior is unaffected by this migration.

-- AlterEnum
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside any
-- transaction that also references the new value, so this must be
-- applied as its own statement/step, consistent with how Prisma
-- generates enum additions (see 20260828140000_add_administration_entity).
ALTER TYPE "OnefopEntityType" ADD VALUE 'PROJECT_PROGRAM';

-- CreateTable
CREATE TABLE "onefop_project_program_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sigle" TEXT,
    "personInCharge" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "subdivision" TEXT NOT NULL,
    "locality" TEXT,
    "phone1" TEXT NOT NULL,
    "phone2" TEXT,
    "poBox" TEXT,
    "sector" TEXT NOT NULL,
    "branch" TEXT,
    "mainMission" TEXT NOT NULL,
    "headOffice" TEXT,
    "supervisingMinistry" TEXT,
    "status" TEXT NOT NULL,
    "stopReason" TEXT,
    "permanentWorkers" INTEGER NOT NULL,
    "vacancies" INTEGER,
    "employedCurrent" INTEGER,
    "employedOutlookDec" INTEGER,
    "employedOutlookJune" INTEGER,
    "selfEmployedCurrent" INTEGER,
    "selfEmployedOutlookDec" INTEGER,
    "selfEmployedOutlookJune" INTEGER,
    "jobsCreatedCurrent" INTEGER,
    "jobsCreatedOutlookDec" INTEGER,
    "jobsCreatedOutlookJune" INTEGER,
    "trainedCurrent" INTEGER,
    "trainedOutlookDec" INTEGER,
    "trainedOutlookJune" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sectorId" TEXT,

    CONSTRAINT "onefop_project_program_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onefop_project_program_details_submissionId_key" ON "onefop_project_program_details"("submissionId");

-- AddForeignKey
ALTER TABLE "onefop_project_program_details" ADD CONSTRAINT "onefop_project_program_details_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_project_program_details" ADD CONSTRAINT "onefop_project_program_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "project_program_activities" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "description" TEXT,
    "targetPopulation" TEXT,
    "supportType" TEXT,
    "scope" TEXT,
    "startDate" TEXT,
    "duration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_program_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_program_activities_submissionId_rowIndex_key" ON "project_program_activities"("submissionId", "rowIndex");

-- CreateIndex
CREATE INDEX "project_program_activities_submissionId_idx" ON "project_program_activities"("submissionId");

-- AddForeignKey
ALTER TABLE "project_program_activities" ADD CONSTRAINT "project_program_activities_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
