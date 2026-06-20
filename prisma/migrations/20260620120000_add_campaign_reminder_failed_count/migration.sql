-- Tracks how many reminder emails failed to send, so a fully-failed batch
-- (e.g. SMTP outage) is distinguishable from "nobody needed a reminder"
-- instead of both showing recipientCount: 0.
ALTER TABLE "campaign_reminders" ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0;
