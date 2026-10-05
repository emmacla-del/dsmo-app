-- Moves the ADMINISTRATION cohort target from central_campaign_quotas into
-- campaign_quotas behind a scopeKind discriminator.
--
-- Ministries answer the ONEFOP questionnaire as one national cohort, not as
-- a region. Their returns are counted in the "central" bucket of
-- PilotageService.getCampaignReturns and excluded from territorial buckets.
-- SUM(campaign_quotas) could not express their target while regionId was
-- NOT NULL, which is why central_campaign_quotas existed. scopeKind removes
-- that reason: campaign_quotas now holds either TERRITORIAL rows (region or
-- department) or the one ADMINISTRATION row per campaign.
--
-- Supersedes the two campaign_quotas partial unique indexes created in
-- 20261001153000_add_territory_targets_and_campaign_quotas. That migration is
-- already applied and is left byte-identical; the indexes it created are
-- dropped and replaced below with scope-qualified equivalents. Its
-- campaign_quotas_submission_target_nonneg CHECK is untouched.
--
-- Partial unique indexes, again: Prisma cannot express WHERE on @@unique, nor
-- CHECK constraints at all, so the uniqueness rules and the scope shape are
-- these statements and nothing else. campaign_quotas_scope_shape is the only
-- enforcement of the shape rule — it is proven at deploy time against the real
-- database and is not reachable from the in-memory test harness, which has no
-- constraints.
--
-- campaign_quotas, central_campaign_quotas, territory_targets,
-- central_inscription_targets and data_campaigns were all verified empty in
-- the live project on 2026-10-05. No backfill.
--
-- central_campaign_quotas is NOT dropped here. It keeps its rows (none) and
-- its relation for rollback safety until Phase 6.
--
-- NOT applied by this commit.

-- CreateEnum
CREATE TYPE "CampaignQuotaScope" AS ENUM ('TERRITORIAL', 'ADMINISTRATION');

-- AlterTable
ALTER TABLE "campaign_quotas" ADD COLUMN "scopeKind" "CampaignQuotaScope" NOT NULL DEFAULT 'TERRITORIAL';

-- AlterTable
ALTER TABLE "campaign_quotas" ALTER COLUMN "regionId" DROP NOT NULL;

-- DropIndex
DROP INDEX "campaign_quotas_campaign_region_level_uidx";

-- DropIndex
DROP INDEX "campaign_quotas_campaign_region_department_uidx";

-- One ADMINISTRATION row per campaign. The cohort has no finer granularity.
CREATE UNIQUE INDEX "campaign_quotas_administration_uidx"
  ON "campaign_quotas" ("campaignId")
  WHERE "scopeKind" = 'ADMINISTRATION';

-- One region-level quota per (campaign, region). NULL departmentId is the
-- region-level marker, so the TERRITORIAL predicate is needed to keep the
-- ADMINISTRATION row (departmentId also NULL) out of this index.
CREATE UNIQUE INDEX "campaign_quotas_territorial_region_uidx"
  ON "campaign_quotas" ("campaignId", "regionId")
  WHERE "departmentId" IS NULL AND "scopeKind" = 'TERRITORIAL';

-- One department quota per (campaign, region, department).
CREATE UNIQUE INDEX "campaign_quotas_territorial_department_uidx"
  ON "campaign_quotas" ("campaignId", "regionId", "departmentId")
  WHERE "departmentId" IS NOT NULL AND "scopeKind" = 'TERRITORIAL';

ALTER TABLE "campaign_quotas"
  ADD CONSTRAINT "campaign_quotas_scope_shape"
  CHECK (
    ("scopeKind" = 'ADMINISTRATION' AND "regionId" IS NULL AND "departmentId" IS NULL)
    OR
    ("scopeKind" = 'TERRITORIAL' AND "regionId" IS NOT NULL)
  );
