-- Role model refactor — collapse the 11-value UserRole enum to 6.
--
-- Applied manually in the Supabase SQL Editor on 2026-10-03; this file is
-- the audit trail so future environments reach the same state. Recorded in
-- _prisma_migrations with `prisma migrate resolve --applied`.
--
-- Mapping:
--   SUPER_ADMIN_ONEFOP, CENTRAL, CAMPAIGN_MANAGER,
--   DATA_MANAGER, ANALYST                        -> ADMIN_ONEFOP
--   SUPER_ADMIN_DSMO                             -> SUPER_ADMIN
--   REGIONAL                                     -> REGIONAL_ADMIN
--   DIVISIONAL                                   -> DIVISIONAL_ADMIN
--   COMPANY, SUPER_ADMIN, AUDITOR                 unchanged
--
-- Two columns use UserRole: users.role and minefop_services."roleMapping".
-- Postgres cannot ALTER TYPE ... DROP VALUE, so the enum is rebuilt under a
-- temporary name and swapped in. The two CHECK constraints on users.role
-- reference the old labels as literals, so they are dropped before the swap
-- and recreated afterwards against the new labels (see 20260929180000 and
-- 20260929181000, which they replace).
--
-- users.role is cast straight across (no USING remap): no row in this
-- database held a removed label. A fresh environment carrying such rows
-- must remap them before step 8, the way minefop_services is remapped in
-- step 6.

-- 1. Drop the CHECK constraints that hard-code the old role labels.
ALTER TABLE public.users DROP CONSTRAINT "users_divisional_requires_territory_chk";
ALTER TABLE public.users DROP CONSTRAINT "users_regional_requires_region_chk";

-- 2-3. Defaults must go before the column type can change.
ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.minefop_services ALTER COLUMN "roleMapping" DROP DEFAULT;

-- 4. The target enum.
CREATE TYPE "UserRole_new" AS ENUM (
  'COMPANY',
  'SUPER_ADMIN',
  'ADMIN_ONEFOP',
  'REGIONAL_ADMIN',
  'DIVISIONAL_ADMIN',
  'AUDITOR'
);

-- 5-7. minefop_services."roleMapping" holds removed labels, so it detours
-- through text to be remapped before it can take the new type.
ALTER TABLE public.minefop_services
  ALTER COLUMN "roleMapping" TYPE text USING "roleMapping"::text;

UPDATE public.minefop_services
SET "roleMapping" = CASE "roleMapping"
  WHEN 'CENTRAL'    THEN 'ADMIN_ONEFOP'
  WHEN 'DIVISIONAL' THEN 'DIVISIONAL_ADMIN'
  WHEN 'REGIONAL'   THEN 'REGIONAL_ADMIN'
  ELSE "roleMapping"
END;

ALTER TABLE public.minefop_services
  ALTER COLUMN "roleMapping" TYPE "UserRole_new" USING "roleMapping"::"UserRole_new";

-- 8. users.role casts directly.
ALTER TABLE public.users
  ALTER COLUMN role TYPE "UserRole_new" USING role::text::"UserRole_new";

-- 9. Retire the old enum and take its name.
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- 10. Recreate the territory CHECK constraints against the new labels.
ALTER TABLE public.users
  ADD CONSTRAINT "users_divisional_requires_territory_chk"
  CHECK (
    role <> 'DIVISIONAL_ADMIN'
    OR (region IS NOT NULL AND btrim(region) <> ''
        AND department IS NOT NULL AND btrim(department) <> '')
  );

ALTER TABLE public.users
  ADD CONSTRAINT "users_regional_requires_region_chk"
  CHECK (
    role <> 'REGIONAL_ADMIN'
    OR (region IS NOT NULL AND btrim(region) <> '')
  );

-- 11. Restore the default dropped in step 2 (schema.prisma: @default(COMPANY)).
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'COMPANY';
