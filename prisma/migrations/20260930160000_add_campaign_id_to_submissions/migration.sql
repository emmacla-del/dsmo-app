-- Campaign progress, phase B1 — link submissions to their campaign.
--
-- Additive only: one nullable column on each of onefop_submissions and
-- declarations, an index on each, and a foreign key to data_campaigns with
-- ON DELETE SET NULL (deleting a campaign never deletes a submission). No
-- drop, rename or NOT NULL. Existing rows keep all their values; the new
-- columns start NULL. Nothing in the application reads or writes them yet.

-- AlterTable
ALTER TABLE "onefop_submissions" ADD COLUMN     "campaignId" TEXT;

-- AlterTable
ALTER TABLE "declarations" ADD COLUMN     "campaignId" TEXT;

-- CreateIndex
CREATE INDEX "onefop_submissions_campaignId_idx" ON "onefop_submissions"("campaignId");

-- CreateIndex
CREATE INDEX "declarations_campaignId_idx" ON "declarations"("campaignId");

-- AddForeignKey
ALTER TABLE "onefop_submissions" ADD CONSTRAINT "onefop_submissions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declarations" ADD CONSTRAINT "declarations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
