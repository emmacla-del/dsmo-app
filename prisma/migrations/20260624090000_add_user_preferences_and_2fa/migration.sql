-- AlterTable
ALTER TABLE "users" ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twoFactorCodeHash" TEXT,
ADD COLUMN "twoFactorCodeExpires" TIMESTAMP(3);
