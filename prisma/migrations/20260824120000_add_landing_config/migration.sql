-- Singleton row (fixed id "singleton") holding the Super-Admin-editable
-- content for the public landing page. See prisma/schema.prisma's
-- LandingConfig model doc comment and src/landing-config/.

-- CreateTable
CREATE TABLE "landing_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_config_pkey" PRIMARY KEY ("id")
);
