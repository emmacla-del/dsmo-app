-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordResetTokenHash" TEXT,
ADD COLUMN "passwordResetExpires" TIMESTAMP(3);
