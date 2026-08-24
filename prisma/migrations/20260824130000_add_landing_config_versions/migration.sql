-- Append-only snapshot of landing_config.data taken right before each
-- overwrite, so a bad Super Admin save can be rolled back. See
-- prisma/schema.prisma's LandingConfigVersion model doc comment and
-- src/landing-config/landing-config.service.ts.

-- CreateTable
CREATE TABLE "landing_config_versions" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_config_versions_createdAt_idx" ON "landing_config_versions"("createdAt");
