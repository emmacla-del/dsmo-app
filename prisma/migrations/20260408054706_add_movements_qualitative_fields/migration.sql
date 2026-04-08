-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "deaths" INTEGER,
ADD COLUMN     "dismissals" INTEGER,
ADD COLUMN     "promotions" INTEGER,
ADD COLUMN     "recruitments" INTEGER,
ADD COLUMN     "retirements" INTEGER;

-- AlterTable
ALTER TABLE "Declaration" ADD COLUMN     "fillingDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QualitativeQuestion" ADD COLUMN     "tempAgencyDetails" TEXT;
