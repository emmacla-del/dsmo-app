-- Phase 4 archive lifecycle: nullable metadata only; existing rows remain unarchived.
-- Rollback: drop the two archivedBy foreign keys, archivedAt indexes, and the
-- archiveReason, archivedBy, and archivedAt columns from users and onefop_submissions.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT;

-- AlterTable
ALTER TABLE "onefop_submissions" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT;

-- CreateIndex
CREATE INDEX "users_archivedAt_idx" ON "users"("archivedAt");

-- CreateIndex
CREATE INDEX "onefop_submissions_archivedAt_idx" ON "onefop_submissions"("archivedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_archivedBy_fkey" FOREIGN KEY ("archivedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_submissions" ADD CONSTRAINT "onefop_submissions_archivedBy_fkey" FOREIGN KEY ("archivedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
