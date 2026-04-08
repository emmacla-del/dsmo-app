/*
  Warnings:

  - You are about to drop the column `deaths` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `dismissals` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `promotions` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `recruitments` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `retirements` on the `Company` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Company" DROP COLUMN "deaths",
DROP COLUMN "dismissals",
DROP COLUMN "promotions",
DROP COLUMN "recruitments",
DROP COLUMN "retirements",
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "lastYearMenCount" INTEGER,
ADD COLUMN     "lastYearWomenCount" INTEGER;
