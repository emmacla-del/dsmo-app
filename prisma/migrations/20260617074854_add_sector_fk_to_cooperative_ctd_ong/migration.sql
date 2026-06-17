-- AlterTable
ALTER TABLE "onefop_cooperative_details" ADD COLUMN     "sectorId" TEXT;

-- AlterTable
ALTER TABLE "onefop_ctd_details" ADD COLUMN     "sectorId" TEXT;

-- AlterTable
ALTER TABLE "onefop_ong_details" ADD COLUMN     "sectorId" TEXT;

-- AddForeignKey
ALTER TABLE "onefop_cooperative_details" ADD CONSTRAINT "onefop_cooperative_details_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_ctd_details" ADD CONSTRAINT "onefop_ctd_details_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_ong_details" ADD CONSTRAINT "onefop_ong_details_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
