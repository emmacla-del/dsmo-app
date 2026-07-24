-- The standalone /admin/submission-rounds open/close path (which predates
-- the Campaign feature) let a round be opened without ever being tied to a
-- DataCampaign. Since the Campaign Management UI only shows DataCampaign
-- records, a round left OPEN/EXTENDED from that old path made "no active
-- campaign" and "no open submission window" silently diverge — companies
-- could still submit even though nothing showed as launched.
--
-- That direct-open code path is being removed, so from here on a round can
-- only be opened via DataCampaign activation (campaignId always set). This
-- closes out any pre-existing round left open without a campaign, so the
-- two states can't drift apart again.
UPDATE "submission_rounds"
SET "status" = 'CLOSED', "closedAt" = now()
WHERE "campaignId" IS NULL
  AND "status" IN ('OPEN', 'EXTENDED');
