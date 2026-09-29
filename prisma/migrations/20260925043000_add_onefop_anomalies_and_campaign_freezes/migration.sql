-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('OPEN', 'RESOLVED', 'WAIVED');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('CRITICAL', 'WARNING');

-- CreateEnum
CREATE TYPE "AnomalyResolutionType" AS ENUM ('DECLARANT_CORRECTION', 'FIELD_INSPECTION', 'LEGAL_DEROGATION');

-- CreateTable
CREATE TABLE "onefop_anomalies" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleFamily" TEXT NOT NULL,
    "severity" "AnomalySeverity" NOT NULL DEFAULT 'CRITICAL',
    "isBlocking" BOOLEAN NOT NULL DEFAULT true,
    "status" "AnomalyStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "observedValue" TEXT NOT NULL,
    "expectedValue" TEXT NOT NULL,
    "deltaValue" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionType" "AnomalyResolutionType",
    "resolutionNote" TEXT,
    "evidenceUrl" TEXT,

    CONSTRAINT "onefop_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_freezes" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozenById" TEXT NOT NULL,
    "totalTargeted" INTEGER NOT NULL DEFAULT 0,
    "totalSubmitted" INTEGER NOT NULL DEFAULT 0,
    "totalIncluded" INTEGER NOT NULL DEFAULT 0,
    "totalExcluded" INTEGER NOT NULL DEFAULT 0,
    "sha256Digest" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "campaign_freezes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onefop_anomalies_submissionId_idx" ON "onefop_anomalies"("submissionId");

-- CreateIndex
CREATE INDEX "onefop_anomalies_status_isBlocking_idx" ON "onefop_anomalies"("status", "isBlocking");

-- CreateIndex
CREATE INDEX "onefop_anomalies_ruleCode_idx" ON "onefop_anomalies"("ruleCode");

-- CreateIndex
CREATE INDEX "campaign_freezes_campaignId_idx" ON "campaign_freezes"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_freezes_campaignId_versionTag_key" ON "campaign_freezes"("campaignId", "versionTag");

-- AddForeignKey
ALTER TABLE "onefop_anomalies" ADD CONSTRAINT "onefop_anomalies_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_anomalies" ADD CONSTRAINT "onefop_anomalies_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_freezes" ADD CONSTRAINT "campaign_freezes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "data_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_freezes" ADD CONSTRAINT "campaign_freezes_frozenById_fkey" FOREIGN KEY ("frozenById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
