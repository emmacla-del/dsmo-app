-- Rename DataCampaign.type → periodicity and convert to enum.
-- DataCampaign.purpose added as a new enum with default COLLECTION.
-- The legacy wire key `type` is preserved in the response mappers
-- in src/campaign/campaign.service.ts, not in the database.

CREATE TYPE "CampaignPeriodicity" AS ENUM ('QUARTERLY','SEMESTER','ANNUAL');
CREATE TYPE "CampaignPurpose" AS ENUM ('COLLECTION','REGISTRATION');

ALTER TABLE "data_campaigns" RENAME COLUMN "type" TO "periodicity";

ALTER TABLE "data_campaigns"
  ALTER COLUMN "periodicity" TYPE "CampaignPeriodicity"
  USING (
    CASE
      WHEN "periodicity" IS NULL   THEN NULL
      WHEN "periodicity" = 'SEMESTER'  THEN 'SEMESTER'::"CampaignPeriodicity"
      WHEN "periodicity" = 'ANNUAL'    THEN 'ANNUAL'::"CampaignPeriodicity"
      WHEN "periodicity" = 'QUARTERLY' THEN 'QUARTERLY'::"CampaignPeriodicity"
      ELSE 'QUARTERLY'::"CampaignPeriodicity"
    END
  );

ALTER TABLE "data_campaigns"
  ADD COLUMN "purpose" "CampaignPurpose" NOT NULL DEFAULT 'COLLECTION';
