-- Align establishments and campaign_submissions with schema.prisma.
--
-- Phase E.1 (20261002180000_phase_e1_establishments) was hand-written and
-- left three differences from the schema it shipped with:
--
-- (a) Ten establishments columns were created VARCHAR(20)/VARCHAR(255); the
--     schema declares them String (TEXT), like every other ID and name column.
--     A company name over 255 characters, copied into establishments.name at
--     approval, would fail the approval transaction. VARCHAR to TEXT is
--     binary-coercible: no table rewrite, no index rebuild, and the three
--     territory foreign keys stay as they are.
-- (c) id, address and updatedAt carried database defaults the schema does not
--     declare. Prisma always sends all three, and nothing in src/ inserts into
--     establishments by raw SQL.
-- (d) The (campaignId, companyId) unique index on campaign_submissions was
--     meant to go, but Step 8 used DROP CONSTRAINT IF EXISTS on what is an
--     index, so it stayed. Left in place it would make
--     createMany({ skipDuplicates }) silently skip a company's second site
--     once campaigns seed more than the principal one. IF EXISTS: the table
--     first came from db push, so the index is not guaranteed to exist.

ALTER TABLE "establishments"
  ALTER COLUMN "code" SET DATA TYPE TEXT,
  ALTER COLUMN "name" SET DATA TYPE TEXT,
  ALTER COLUMN "regionId" SET DATA TYPE TEXT,
  ALTER COLUMN "departmentId" SET DATA TYPE TEXT,
  ALTER COLUMN "subdivisionId" SET DATA TYPE TEXT,
  ALTER COLUMN "region" SET DATA TYPE TEXT,
  ALTER COLUMN "department" SET DATA TYPE TEXT,
  ALTER COLUMN "subdivision" SET DATA TYPE TEXT,
  ALTER COLUMN "phone" SET DATA TYPE TEXT,
  ALTER COLUMN "email" SET DATA TYPE TEXT,
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "address" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

DROP INDEX IF EXISTS "campaign_submissions_campaignId_companyId_key";
