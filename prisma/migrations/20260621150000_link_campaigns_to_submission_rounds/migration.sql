-- CreateEnum
CREATE TYPE "SubmissionModule" AS ENUM ('ONEFOP', 'DSMO');

-- AlterTable
ALTER TABLE "data_campaigns" ADD COLUMN     "collectionType" "SubmissionModule" NOT NULL DEFAULT 'ONEFOP';

-- AlterTable
ALTER TABLE "submission_rounds" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "module" "SubmissionModule" NOT NULL DEFAULT 'ONEFOP';

-- CreateIndex
CREATE UNIQUE INDEX "submission_rounds_campaignId_key" ON "submission_rounds"("campaignId");

-- CreateIndex
CREATE INDEX "submission_rounds_module_status_idx" ON "submission_rounds"("module", "status");

-- AddForeignKey
ALTER TABLE "submission_rounds" ADD CONSTRAINT "submission_rounds_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
