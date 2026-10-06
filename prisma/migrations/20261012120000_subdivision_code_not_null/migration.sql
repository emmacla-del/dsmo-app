-- Subdivision.code becomes NOT NULL.
--
-- The establishment ID's two-digit suffix is the last two digits of the
-- subdivision code, so registration has no fallback for an uncoded
-- subdivision. All 360 subdivisions are coded (rechecked against production
-- on 2026-10-06: 0 rows with a NULL or empty code); the constraint keeps it
-- that way for subdivisions added later. The seed sets a code on every
-- subdivision it creates.
--
-- If this fails, a subdivision without a code was added since that check:
-- give it a code, then redeploy.

ALTER TABLE "subdivisions" ALTER COLUMN "code" SET NOT NULL;
