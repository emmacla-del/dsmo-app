-- A missing taxpayer number is absence of data, not a synthetic identifier.
-- PostgreSQL's unique constraint permits any number of NULL values.
UPDATE "companies"
SET "taxNumber" = NULL
WHERE "taxNumber" LIKE 'NA-%';

ALTER TABLE "companies"
ALTER COLUMN "taxNumber" DROP NOT NULL;

-- Bind assisted-registration retries to the original submitted body so a
-- client request key cannot be reused for a different declarant or payload.
ALTER TABLE "users"
ADD COLUMN "registrationRequestHash" TEXT;
