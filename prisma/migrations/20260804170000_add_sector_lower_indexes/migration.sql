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
-- Originally written with CONCURRENTLY to avoid a table lock during
-- deploy, but Prisma only runs a migration file outside a transaction
-- when it contains a single statement — with 4 statements in one file, it
-- got wrapped in a transaction anyway and CONCURRENTLY is rejected
-- outright by Postgres in that context (error 25001). Dropped
-- CONCURRENTLY rather than splitting into 4 files; these are small
-- lookup tables, so the brief lock during a plain CREATE INDEX is an
-- acceptable trade for keeping this as one file.
CREATE INDEX IF NOT EXISTS "onefop_enterprise_details_sector_lower_idx" ON "onefop_enterprise_details" (LOWER("sector"));
CREATE INDEX IF NOT EXISTS "onefop_cooperative_details_sector_lower_idx" ON "onefop_cooperative_details" (LOWER("sector"));
CREATE INDEX IF NOT EXISTS "onefop_ctd_details_sector_lower_idx" ON "onefop_ctd_details" (LOWER("sector"));
CREATE INDEX IF NOT EXISTS "onefop_ong_details_sector_lower_idx" ON "onefop_ong_details" (LOWER("sector"));
