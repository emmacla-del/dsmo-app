-- AlterTable: add reference period columns to data_campaigns
ALTER TABLE "data_campaigns" ADD COLUMN IF NOT EXISTS "referenceYear" INTEGER,
ADD COLUMN IF NOT EXISTS "referenceQuarter" INTEGER;

-- Backfill reference periods
-- QUARTERLY_2026_T2_003 -> 2026/2
UPDATE "data_campaigns"
SET "referenceYear" = 2026, "referenceQuarter" = 2
WHERE "code" = 'QUARTERLY_2026_T2_003';

-- All T3 campaigns -> 2026/3
UPDATE "data_campaigns"
SET "referenceYear" = 2026, "referenceQuarter" = 3
WHERE "code" LIKE '%T3%';

-- Check constraint: ONEFOP campaigns must have referenceYear and referenceQuarter
ALTER TABLE "data_campaigns" DROP CONSTRAINT IF EXISTS "data_campaigns_onefop_reference_period_check";
ALTER TABLE "data_campaigns" ADD CONSTRAINT "data_campaigns_onefop_reference_period_check"
    CHECK ("collectionType" <> 'ONEFOP' OR ("referenceYear" IS NOT NULL AND "referenceQuarter" IS NOT NULL));

-- Check constraint: referenceQuarter must be between 1 and 4
ALTER TABLE "data_campaigns" DROP CONSTRAINT IF EXISTS "data_campaigns_reference_quarter_range_check";
ALTER TABLE "data_campaigns" ADD CONSTRAINT "data_campaigns_reference_quarter_range_check"
    CHECK ("referenceQuarter" IS NULL OR ("referenceQuarter" >= 1 AND "referenceQuarter" <= 4));

-- Partial unique index: one active ONEFOP campaign per reference period
DROP INDEX IF EXISTS "data_campaigns_onefop_reference_period_key";
CREATE UNIQUE INDEX "data_campaigns_onefop_reference_period_key"
    ON "data_campaigns" ("referenceYear", "referenceQuarter")
    WHERE "collectionType" = 'ONEFOP' AND "status" <> 'ARCHIVED';

-- AlterTable: add lateness tracking columns to onefop_submissions
ALTER TABLE "onefop_submissions" ADD COLUMN IF NOT EXISTS "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "effectiveDeadlineSnapshot" TIMESTAMP(3);
