-- The five 7.1.3 "précisez" columns added by 20261019120000_vt_comms_channel_other
-- (applied as nullable) become NOT NULL with an empty-text default: a row
-- whose 96 "Autre" is not ticked holds '' (the précisez is required whenever
-- 96 is ticked). Existing NULLs are set to '' first, so no row is lost.

UPDATE "onefop_vocational_training_details" SET "pupilsCommsChannelsOther" = '' WHERE "pupilsCommsChannelsOther" IS NULL;
UPDATE "onefop_vocational_training_details" SET "teachingStaffCommsChannelsOther" = '' WHERE "teachingStaffCommsChannelsOther" IS NULL;
UPDATE "onefop_vocational_training_details" SET "nonTeachingStaffCommsChannelsOther" = '' WHERE "nonTeachingStaffCommsChannelsOther" IS NULL;
UPDATE "onefop_vocational_training_details" SET "parentsCommsChannelsOther" = '' WHERE "parentsCommsChannelsOther" IS NULL;
UPDATE "onefop_vocational_training_details" SET "schoolCouncilCommsChannelsOther" = '' WHERE "schoolCouncilCommsChannelsOther" IS NULL;

-- AlterTable
ALTER TABLE "onefop_vocational_training_details"
ALTER COLUMN "pupilsCommsChannelsOther" SET DEFAULT '',
ALTER COLUMN "pupilsCommsChannelsOther" SET NOT NULL,
ALTER COLUMN "teachingStaffCommsChannelsOther" SET DEFAULT '',
ALTER COLUMN "teachingStaffCommsChannelsOther" SET NOT NULL,
ALTER COLUMN "nonTeachingStaffCommsChannelsOther" SET DEFAULT '',
ALTER COLUMN "nonTeachingStaffCommsChannelsOther" SET NOT NULL,
ALTER COLUMN "parentsCommsChannelsOther" SET DEFAULT '',
ALTER COLUMN "parentsCommsChannelsOther" SET NOT NULL,
ALTER COLUMN "schoolCouncilCommsChannelsOther" SET DEFAULT '',
ALTER COLUMN "schoolCouncilCommsChannelsOther" SET NOT NULL;
