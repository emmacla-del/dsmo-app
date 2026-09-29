-- AddCheckConstraint (not representable in schema.prisma)
--
-- A DIVISIONAL account is scoped by region AND department (src/auth/
-- territory.ts): department names repeat across regions, so a department
-- alone does not identify a territory. AuthService validates this on
-- register, adminCreateMinefopUser and updateUserRole; this constraint is
-- the guarantee for everything that bypasses the app (seed scripts,
-- direct SQL).
--
-- Prisma's schema DSL cannot declare CHECK constraints and ignores them
-- when diffing, so this is not mirrored in schema.prisma. Existing rows
-- are validated when the constraint is added: this fails if any DIVISIONAL
-- user still lacks a region or department (0 such rows as of 2026-09-29).
ALTER TABLE "users"
  ADD CONSTRAINT "users_divisional_requires_territory_chk"
  CHECK (
    role <> 'DIVISIONAL'
    OR (region IS NOT NULL AND btrim(region) <> ''
        AND department IS NOT NULL AND btrim(department) <> '')
  );
