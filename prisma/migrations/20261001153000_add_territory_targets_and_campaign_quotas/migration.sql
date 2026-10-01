-- Territorial inscription targets, campaign quotas, and the separate
-- "Niveau central" rows for administrations.
--
-- prisma migrate dev --create-only did not produce this file. Replaying
-- history onto a shadow database fails at
-- 20260620120000_add_campaign_reminder_failed_count (P3006 / P1014:
-- campaign_reminders does not exist). Nothing was applied.
--
-- A read-only diff of the live database against schema.prisma also
-- proposed unrelated drift (CspCategory values, index renames,
-- system_settings_backup). That drift is not in this migration.
-- The CREATE TABLE / INDEX / FOREIGN KEY statements below are the
-- Prisma diff for these four models only.
--
-- Partial unique indexes: a plain UNIQUE (year, regionId, departmentId)
-- treats NULL departmentId as distinct, so two region-level rows would
-- be allowed. Prisma cannot express WHERE on @@unique; these indexes
-- are the constraint. Non-negative CHECKs are here for the same reason.
--
-- NOT applied by this commit.

-- CreateTable
CREATE TABLE "territory_targets" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "regionId" TEXT NOT NULL,
    "departmentId" TEXT,
    "inscriptionTarget" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "territory_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_quotas" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "departmentId" TEXT,
    "submissionTarget" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "central_inscription_targets" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "inscriptionTarget" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "central_inscription_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "central_campaign_quotas" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "submissionTarget" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "central_campaign_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "territory_targets_year_idx" ON "territory_targets"("year");

-- CreateIndex
CREATE INDEX "territory_targets_regionId_idx" ON "territory_targets"("regionId");

-- CreateIndex
CREATE INDEX "territory_targets_departmentId_idx" ON "territory_targets"("departmentId");

-- CreateIndex
CREATE INDEX "territory_targets_createdBy_idx" ON "territory_targets"("createdBy");

-- CreateIndex
CREATE INDEX "territory_targets_updatedBy_idx" ON "territory_targets"("updatedBy");

-- CreateIndex
CREATE INDEX "campaign_quotas_campaignId_idx" ON "campaign_quotas"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_quotas_regionId_idx" ON "campaign_quotas"("regionId");

-- CreateIndex
CREATE INDEX "campaign_quotas_departmentId_idx" ON "campaign_quotas"("departmentId");

-- CreateIndex
CREATE INDEX "campaign_quotas_createdBy_idx" ON "campaign_quotas"("createdBy");

-- CreateIndex
CREATE INDEX "campaign_quotas_updatedBy_idx" ON "campaign_quotas"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "central_inscription_targets_year_key" ON "central_inscription_targets"("year");

-- CreateIndex
CREATE INDEX "central_inscription_targets_createdBy_idx" ON "central_inscription_targets"("createdBy");

-- CreateIndex
CREATE INDEX "central_inscription_targets_updatedBy_idx" ON "central_inscription_targets"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "central_campaign_quotas_campaignId_key" ON "central_campaign_quotas"("campaignId");

-- CreateIndex
CREATE INDEX "central_campaign_quotas_createdBy_idx" ON "central_campaign_quotas"("createdBy");

-- CreateIndex
CREATE INDEX "central_campaign_quotas_updatedBy_idx" ON "central_campaign_quotas"("updatedBy");

-- One department row per (year, region, department). NULL departmentId is excluded.
CREATE UNIQUE INDEX "territory_targets_year_region_department_uidx"
  ON "territory_targets" ("year", "regionId", "departmentId")
  WHERE "departmentId" IS NOT NULL;

-- One region-level row per (year, region).
CREATE UNIQUE INDEX "territory_targets_year_region_level_uidx"
  ON "territory_targets" ("year", "regionId")
  WHERE "departmentId" IS NULL;

-- One department quota per (campaign, region, department).
CREATE UNIQUE INDEX "campaign_quotas_campaign_region_department_uidx"
  ON "campaign_quotas" ("campaignId", "regionId", "departmentId")
  WHERE "departmentId" IS NOT NULL;

-- One region-level quota per (campaign, region).
CREATE UNIQUE INDEX "campaign_quotas_campaign_region_level_uidx"
  ON "campaign_quotas" ("campaignId", "regionId")
  WHERE "departmentId" IS NULL;

ALTER TABLE "territory_targets"
  ADD CONSTRAINT "territory_targets_inscription_target_nonneg"
  CHECK ("inscriptionTarget" >= 0);

ALTER TABLE "campaign_quotas"
  ADD CONSTRAINT "campaign_quotas_submission_target_nonneg"
  CHECK ("submissionTarget" >= 0);

ALTER TABLE "central_inscription_targets"
  ADD CONSTRAINT "central_inscription_targets_inscription_target_nonneg"
  CHECK ("inscriptionTarget" >= 0);

ALTER TABLE "central_campaign_quotas"
  ADD CONSTRAINT "central_campaign_quotas_submission_target_nonneg"
  CHECK ("submissionTarget" >= 0);

-- AddForeignKey
ALTER TABLE "territory_targets" ADD CONSTRAINT "territory_targets_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_targets" ADD CONSTRAINT "territory_targets_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_targets" ADD CONSTRAINT "territory_targets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_targets" ADD CONSTRAINT "territory_targets_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_quotas" ADD CONSTRAINT "campaign_quotas_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_quotas" ADD CONSTRAINT "campaign_quotas_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_quotas" ADD CONSTRAINT "campaign_quotas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_quotas" ADD CONSTRAINT "campaign_quotas_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_quotas" ADD CONSTRAINT "campaign_quotas_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_inscription_targets" ADD CONSTRAINT "central_inscription_targets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_inscription_targets" ADD CONSTRAINT "central_inscription_targets_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_campaign_quotas" ADD CONSTRAINT "central_campaign_quotas_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_campaign_quotas" ADD CONSTRAINT "central_campaign_quotas_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_campaign_quotas" ADD CONSTRAINT "central_campaign_quotas_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
