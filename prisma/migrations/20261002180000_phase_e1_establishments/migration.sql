-- Phase E.1: Multi-site establishment schema, migration, and backfill.
-- Transactional DDL: Steps 1-9 executed atomically.

-- Step 1: DDL — Enum & Establishment Table
CREATE TYPE "EstablishmentStatus" AS ENUM ('ACTIVE', 'CLOSED', 'SUSPENDED');

CREATE TABLE "establishments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "isPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "status" "EstablishmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "companyId" UUID NOT NULL,
    "regionId" VARCHAR(255) NOT NULL,
    "departmentId" VARCHAR(255) NOT NULL,
    "subdivisionId" VARCHAR(255) NOT NULL,
    "region" VARCHAR(255) NOT NULL,
    "department" VARCHAR(255) NOT NULL,
    "subdivision" VARCHAR(255) NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" VARCHAR(255),
    "email" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "establishments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "establishments_code_key" UNIQUE ("code"),
    CONSTRAINT "establishments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "establishments_companyId_idx" ON "establishments"("companyId");
CREATE INDEX "establishments_regionId_idx" ON "establishments"("regionId");
CREATE INDEX "establishments_departmentId_idx" ON "establishments"("departmentId");
CREATE INDEX "establishments_subdivisionId_idx" ON "establishments"("subdivisionId");

-- Step 2: DDL — Partial Unique Index on Principal Site
CREATE UNIQUE INDEX "establishments_company_principal_uidx"
  ON "establishments" ("companyId")
  WHERE "isPrincipal" = true;

-- Step 3: DML Backfill — Generate Principal '-01' Establishments (ACTIVE Only)
INSERT INTO "establishments" (
    "id",
    "code",
    "name",
    "isPrincipal",
    "status",
    "companyId",
    "regionId",
    "departmentId",
    "subdivisionId",
    "region",
    "department",
    "subdivision",
    "address",
    "phone",
    "email",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    c."establishmentId" || '-01',
    COALESCE(NULLIF(TRIM(c.name), ''), 'Siège Principal'),
    true,
    'ACTIVE'::"EstablishmentStatus",
    c.id,
    c."regionId",
    c."departmentId",
    c."subdivisionId",
    c.region,
    c.department,
    c.subdivision,
    COALESCE(c.address, ''),
    c.phone,
    u.email,
    c."createdAt",
    CURRENT_TIMESTAMP
FROM "companies" c
JOIN "users" u ON u.id = c."userId"
WHERE u.status = 'ACTIVE'
  AND c."establishmentId" IS NOT NULL
  AND c."regionId" IS NOT NULL
  AND c."departmentId" IS NOT NULL
  AND c."subdivisionId" IS NOT NULL;

-- Step 4: DML Backfill — Relink OnefopSubmission.establishmentId to UUID
UPDATE "onefop_submissions" s
SET "establishmentId" = e.id::text
FROM "establishments" e
WHERE e."companyId" = s."companyId"
  AND e."isPrincipal" = true;

-- Step 5: DML Backfill — Relink CampaignSubmission.establishmentId to UUID
UPDATE "campaign_submissions" cs
SET "establishmentId" = e.id::text
FROM "establishments" e
WHERE e."companyId" = cs."companyId"
  AND e."isPrincipal" = true;

-- Step 6: DML Backfill — Suffix SubmissionDraft.establishmentId with '-01'
UPDATE "submission_drafts"
SET "establishmentId" = "establishmentId" || '-01'
WHERE "establishmentId" IS NOT NULL
  AND "establishmentId" NOT LIKE '%-%';

-- Step 7: DDL — Enforce Foreign Keys & NOT NULL
ALTER TABLE "onefop_submissions"
  ALTER COLUMN "establishmentId" SET NOT NULL;

ALTER TABLE "onefop_submissions"
  ADD CONSTRAINT "onefop_submissions_establishmentId_fkey"
  FOREIGN KEY ("establishmentId") REFERENCES "establishments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campaign_submissions"
  ALTER COLUMN "establishmentId" SET NOT NULL;

ALTER TABLE "campaign_submissions"
  ADD CONSTRAINT "campaign_submissions_establishmentId_fkey"
  FOREIGN KEY ("establishmentId") REFERENCES "establishments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 8: DDL — Drop Obsolete Constraints
ALTER TABLE "campaign_submissions"
  DROP CONSTRAINT IF EXISTS "campaign_submissions_campaignId_companyId_key";

DROP INDEX IF EXISTS "onefop_submissions_company_quarter_live_uidx";

-- Step 9: DDL — Create Establishment Live Return Unique Index
CREATE UNIQUE INDEX "onefop_submissions_establishment_quarter_live_uidx"
  ON "onefop_submissions" ("establishmentId", "quarterCode")
  WHERE "status" IN ('PENDING_REVIEW', 'APPROVED');
