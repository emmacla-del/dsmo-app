/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('DECONCENTRE', 'CENTRALE', 'RATTACHE');

-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('HEAD', 'DEPUTY_HEAD', 'DIVISION_HEAD', 'SUB_DIRECTION_HEAD', 'OFFICER', 'ASSISTANT', 'TECHNICIAN', 'ADMIN');

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_sentBy_fkey";

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "salary" INTEGER;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "nameEn" TEXT;

-- AlterTable
ALTER TABLE "regions" ADD COLUMN     "nameEn" TEXT;

-- AlterTable
ALTER TABLE "sectors" ADD COLUMN     "nameEn" TEXT;

-- AlterTable
ALTER TABLE "subdivisions" ADD COLUMN     "nameEn" TEXT;

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "minefop_services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "acronym" TEXT,
    "category" "ServiceCategory" NOT NULL DEFAULT 'CENTRALE',
    "level" INTEGER NOT NULL,
    "parentCode" TEXT,
    "roleMapping" "UserRole" NOT NULL,
    "requiresRegion" BOOLEAN NOT NULL DEFAULT false,
    "requiresDepartment" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "minefop_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_positions" (
    "id" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "positionType" "PositionType" NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "level" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'COMPANY',
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "matricule" TEXT,
    "poste" TEXT,
    "serviceCode" TEXT,
    "positionType" "PositionType",
    "positionTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "minefop_services_parentCode_idx" ON "minefop_services"("parentCode");

-- CreateIndex
CREATE INDEX "minefop_services_level_idx" ON "minefop_services"("level");

-- CreateIndex
CREATE INDEX "minefop_services_category_idx" ON "minefop_services"("category");

-- CreateIndex
CREATE UNIQUE INDEX "minefop_services_code_unique" ON "minefop_services"("code");

-- CreateIndex
CREATE INDEX "service_positions_serviceCode_idx" ON "service_positions"("serviceCode");

-- CreateIndex
CREATE INDEX "service_positions_level_idx" ON "service_positions"("level");

-- CreateIndex
CREATE UNIQUE INDEX "service_positions_serviceCode_positionType_key" ON "service_positions"("serviceCode", "positionType");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_serviceCode_idx" ON "users"("serviceCode");

-- CreateIndex
CREATE INDEX "users_positionType_idx" ON "users"("positionType");

-- AddForeignKey
ALTER TABLE "minefop_services" ADD CONSTRAINT "minefop_services_parentCode_fkey" FOREIGN KEY ("parentCode") REFERENCES "minefop_services"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_positions" ADD CONSTRAINT "service_positions_serviceCode_fkey" FOREIGN KEY ("serviceCode") REFERENCES "minefop_services"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_serviceCode_fkey" FOREIGN KEY ("serviceCode") REFERENCES "minefop_services"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
