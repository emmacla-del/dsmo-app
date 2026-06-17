-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('DRAFT', 'OPEN', 'EXTENDED', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "submission_rounds" (
    "id" TEXT NOT NULL,
    "quarterCode" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'DRAFT',
    "targetRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetEntityTypes" "OnefopEntityType"[] DEFAULT ARRAY[]::"OnefopEntityType"[],
    "openedBy" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_rounds_quarterCode_key" ON "submission_rounds"("quarterCode");

-- CreateIndex
CREATE INDEX "submission_rounds_status_idx" ON "submission_rounds"("status");

-- CreateIndex
CREATE INDEX "submission_rounds_deadline_idx" ON "submission_rounds"("deadline");

-- CreateIndex
CREATE INDEX "submission_rounds_quarterCode_idx" ON "submission_rounds"("quarterCode");

-- AddForeignKey
ALTER TABLE "submission_rounds" ADD CONSTRAINT "submission_rounds_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_rounds" ADD CONSTRAINT "submission_rounds_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
