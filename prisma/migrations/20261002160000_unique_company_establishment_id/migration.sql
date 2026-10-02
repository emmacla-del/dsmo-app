-- Company.establishmentId becomes unique (R.1).
--
-- Allocation is serialised in application code by pg_advisory_xact_lock on
-- (prefix, year) inside EstablishmentIdGenerator. This is the database
-- backstop behind that lock, so a bug or a direct SQL write cannot leave two
-- establishments sharing a public identifier.
--
-- The column stays nullable and Postgres permits repeated NULLs, so
-- companies awaiting approval, and any row the backfill script skipped, are
-- unaffected.
--
-- THIS WILL FAIL IF DUPLICATES ALREADY EXIST. Run
-- scripts/sql/find-duplicate-establishment-ids.sql first and resolve any row
-- it returns.
--
-- New folder. Do not edit 20261002120000_add_company_territory_indexes.
-- NOT applied by this commit.

-- CreateIndex
CREATE UNIQUE INDEX "companies_establishmentId_key" ON "companies"("establishmentId");
