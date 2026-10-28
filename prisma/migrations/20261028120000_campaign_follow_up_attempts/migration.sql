-- Per-establishment follow-up history, separate from campaign-wide email reminders.
-- Actor snapshots preserve the identity that was shown when a manual action was logged.
CREATE TABLE IF NOT EXISTS "campaign_follow_up_attempts" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorTitle" TEXT,
    "actorRegion" TEXT,
    "actorDepartment" TEXT,
    "channel" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "messageLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_follow_up_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_follow_up_attempts_campaignId_companyId_createdAt_idx"
    ON "campaign_follow_up_attempts"("campaignId", "companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "campaign_follow_up_attempts_actorId_createdAt_idx"
    ON "campaign_follow_up_attempts"("actorId", "createdAt");

ALTER TABLE "campaign_follow_up_attempts"
    DROP CONSTRAINT IF EXISTS "campaign_follow_up_attempts_campaignId_fkey";
ALTER TABLE "campaign_follow_up_attempts"
    ADD CONSTRAINT "campaign_follow_up_attempts_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaign_follow_up_attempts"
    DROP CONSTRAINT IF EXISTS "campaign_follow_up_attempts_companyId_fkey";
ALTER TABLE "campaign_follow_up_attempts"
    ADD CONSTRAINT "campaign_follow_up_attempts_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaign_follow_up_attempts"
    DROP CONSTRAINT IF EXISTS "campaign_follow_up_attempts_actorId_fkey";
ALTER TABLE "campaign_follow_up_attempts"
    ADD CONSTRAINT "campaign_follow_up_attempts_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
