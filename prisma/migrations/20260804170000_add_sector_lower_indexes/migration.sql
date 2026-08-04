-- CreateIndex (functional, not representable in schema.prisma)
--
-- AnalyticsQueryService.resolveSubmissionIdsBySector() filters these four
-- tables with `{ sector: { equals: sector, mode: 'insensitive' } }`, which
-- Prisma compiles to a case-insensitive comparison on Postgres
-- (LOWER("sector") = LOWER($1)) rather than a plain "sector" = $1. A regular
-- B-tree index on "sector" is not used by the planner for that predicate —
-- it needs a functional index on the lowercased expression instead.
--
-- Prisma's schema DSL has no way to declare an expression index, so this
-- migration is not mirrored by an @@index(...) in schema.prisma. It is,
-- however, tracked here in the normal migrations folder so it's applied the
-- same way as every other migration in this project.
--
-- CONCURRENTLY avoids a table lock while building the index; Prisma Migrate
-- detects CONCURRENTLY and runs this file outside a transaction
-- automatically — do not wrap these statements in BEGIN/COMMIT.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "onefop_enterprise_details_sector_lower_idx" ON "onefop_enterprise_details" (LOWER("sector"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS "onefop_cooperative_details_sector_lower_idx" ON "onefop_cooperative_details" (LOWER("sector"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS "onefop_ctd_details_sector_lower_idx" ON "onefop_ctd_details" (LOWER("sector"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS "onefop_ong_details_sector_lower_idx" ON "onefop_ong_details" (LOWER("sector"));
