-- Read-only. Run this BEFORE applying
-- prisma/migrations/20261002160000_unique_company_establishment_id, which
-- creates a unique index on companies."establishmentId" and will fail if any
-- row below comes back.
--
-- Writes nothing. Safe to run on production.

-- 1. Duplicate establishment IDs, worst first.
--    NULLs are excluded: the column is nullable, Postgres allows repeated
--    NULLs under a unique index, and companies awaiting approval have none.
SELECT
    c."establishmentId",
    COUNT(*) AS occurrences,
    ARRAY_AGG(c.id ORDER BY c."createdAt") AS company_ids,
    ARRAY_AGG(c.name ORDER BY c."createdAt") AS company_names,
    ARRAY_AGG(c."createdAt" ORDER BY c."createdAt") AS created_at
FROM companies c
WHERE c."establishmentId" IS NOT NULL
GROUP BY c."establishmentId"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, c."establishmentId";

-- 2. Totals, to confirm the first query covered everything.
SELECT
    COUNT(*)                                                   AS companies_total,
    COUNT(c."establishmentId")                                 AS with_establishment_id,
    COUNT(*) - COUNT(c."establishmentId")                      AS without_establishment_id,
    COUNT(DISTINCT c."establishmentId")                        AS distinct_establishment_ids,
    COUNT(c."establishmentId") - COUNT(DISTINCT c."establishmentId") AS duplicate_rows
FROM companies c;

-- 3. The backfill script's workload: ACTIVE companies with no ID.
--    Expected to be ~29. A row with a NULL entity_type or subdivision_id is
--    one the script reports as SKIPPED.
SELECT
    c.id,
    c.name,
    c."entityType",
    c."subdivisionId",
    u.email,
    u.status,
    c."createdAt"
FROM companies c
JOIN users u ON u.id = c."userId"
WHERE c."establishmentId" IS NULL
  AND u.role = 'COMPANY'
  AND u.status = 'ACTIVE'
ORDER BY c."createdAt";
