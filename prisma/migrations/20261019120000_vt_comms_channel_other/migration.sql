-- 7.1.3 communication channels became coded choices (01..08, 96 "Autre");
-- each stakeholder row gets the "précisez" text of its 96:
--   VT7_7_OTHER  -> pupilsCommsChannelsOther
--   VT7_8_OTHER  -> teachingStaffCommsChannelsOther
--   VT7_9_OTHER  -> nonTeachingStaffCommsChannelsOther
--   VT7_10_OTHER -> parentsCommsChannelsOther
--   VT7_11_OTHER -> schoolCouncilCommsChannelsOther
-- Additive only: nullable columns, no existing data touched.

-- AlterTable
ALTER TABLE "onefop_vocational_training_details"
ADD COLUMN "pupilsCommsChannelsOther" TEXT,
ADD COLUMN "teachingStaffCommsChannelsOther" TEXT,
ADD COLUMN "nonTeachingStaffCommsChannelsOther" TEXT,
ADD COLUMN "parentsCommsChannelsOther" TEXT,
ADD COLUMN "schoolCouncilCommsChannelsOther" TEXT;
