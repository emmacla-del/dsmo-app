-- Let a region hold one registration quota per entity type.
--
-- 20261025140000 added campaign_quotas."entityType" and the region x type
-- grain, but left campaign_quotas_territorial_region_uidx as it was:
--
--   UNIQUE ("campaignId", "regionId")
--     WHERE "departmentId" IS NULL AND "scopeKind" = 'TERRITORIAL'
--
-- Every per-type row carries that same shape -- TERRITORIAL, a regionId,
-- departmentId NULL -- and the index does not mention "entityType", so the
-- rows of one region all share its indexed tuple. The second per-type insert
-- raised 23505, and because writeQuotas runs in a transaction the whole save
-- failed: a region with two or more types filled in could not be saved at all.
-- The 13 unit tests did not see it because they reach CampaignQuota through a
-- mocked table, which has no constraints.
--
-- Replaced by two partial indexes rather than one
-- UNIQUE ("campaignId", "regionId", "entityType"): Postgres treats NULLs as
-- distinct, so the single form would admit any number of all-types rows for a
-- region -- a worse defect than the one being fixed. Splitting on
-- "entityType" IS NULL keeps "all types" exactly one row, as it has always
-- been, and gives each named type one row of its own.
--
-- Not enforced here: that a region holds EITHER an all-types row OR per-type
-- rows, never both. That is the MIXED rule in assertNoMixedMode, kept in
-- application code for the same reason 20261025140000 left the grain to
-- parseTargetBody -- a CHECK would have to be dropped and rewritten when the
-- grain widens.
--
-- No row is read, rewritten or moved: both indexes are over the same rows the
-- dropped one covered, and every existing row has "entityType" NULL, so it
-- lands in the first index exactly as before.

DROP INDEX IF EXISTS "campaign_quotas_territorial_region_uidx";

-- One all-types region quota per (campaign, region). This is every row
-- written before 2026-10-25.
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_quotas_territorial_region_uidx"
  ON "campaign_quotas" ("campaignId", "regionId")
  WHERE "departmentId" IS NULL AND "entityType" IS NULL AND "scopeKind" = 'TERRITORIAL';

-- One quota per (campaign, region, entity type).
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_quotas_territorial_region_type_uidx"
  ON "campaign_quotas" ("campaignId", "regionId", "entityType")
  WHERE "departmentId" IS NULL AND "entityType" IS NOT NULL AND "scopeKind" = 'TERRITORIAL';
