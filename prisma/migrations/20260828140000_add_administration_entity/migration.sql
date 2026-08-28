-- Phase 1: Administration ONEFOP entity type.
-- Additive only — no existing enum values, tables, or columns are
-- altered or removed. Safe for the four currently-operational entity
-- types (Enterprise, Cooperative, CTD, ONG); their data/behavior is
-- unaffected by this migration.

-- AlterEnum
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside any
-- transaction that also references the new value, so this must be
-- applied as its own statement/step, consistent with how Prisma
-- generates enum additions.
ALTER TYPE "OnefopEntityType" ADD VALUE 'ADMINISTRATION';

-- AlterEnum
-- Administration's S21Q01/S22Q01/S3Q01 use SFP (civil-service) status
-- categories instead of the CSP categories the other four entity types
-- use. CspCategory backs OnefopCspGenderAge.cspCategory and
-- OnefopDepartureData.cspCategory, both hard-typed to this enum, so
-- these three values must exist before any Administration submission
-- carrying S21Q01/S22Q01/S3Q01 data can be persisted.
ALTER TYPE "CspCategory" ADD VALUE 'FONCTIONNAIRE';
ALTER TYPE "CspCategory" ADD VALUE 'DECISIONNAIRE';
ALTER TYPE "CspCategory" ADD VALUE 'CONTRACTUELLE';

-- CreateTable
CREATE TABLE "onefop_administration_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sigle" TEXT,
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
    "hasProject" BOOLEAN NOT NULL,
    "projectCount" INTEGER,
    "hasSupervisedStructures" BOOLEAN NOT NULL,
    "supervisedStructureCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sectorId" TEXT,

    CONSTRAINT "onefop_administration_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onefop_administration_details_submissionId_key" ON "onefop_administration_details"("submissionId");

-- AddForeignKey
ALTER TABLE "onefop_administration_details" ADD CONSTRAINT "onefop_administration_details_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_administration_details" ADD CONSTRAINT "onefop_administration_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
