-- AddCheckConstraint (not representable in schema.prisma)
--
-- Sibling of 20260929180000 (users_divisional_requires_territory_chk): a
-- REGIONAL account is scoped by its region (src/auth/territory.ts), so it
-- cannot exist without one. AuthService validates this on register,
-- adminCreateMinefopUser and updateUserRole; this constraint covers seed
-- scripts and direct SQL. Kept as its own migration so 20260929180000
-- stays unchanged if it has already been applied.
--
-- Prisma's schema DSL cannot declare CHECK constraints and ignores them
-- when diffing, so this is not mirrored in schema.prisma. Existing rows
-- are validated when the constraint is added: this fails if any REGIONAL
-- user lacks a region.
ALTER TABLE "users"
  ADD CONSTRAINT "users_regional_requires_region_chk"
  CHECK (
    role <> 'REGIONAL'
    OR (region IS NOT NULL AND btrim(region) <> '')
  );
