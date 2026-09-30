-- Admin rebuild B1 — registration review states for UserStatus.
--
-- Additive only: four new values, none removed or renamed. No existing row
-- changes status. Values follow the enum's SCREAMING_SNAKE_CASE convention
-- (PENDING_APPROVAL, ACTIVE, REJECTED).
--
-- AlterEnum
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside any transaction
-- that also references the new value, so this is its own migration step,
-- consistent with 20260828140000_add_administration_entity,
-- 20260829120000_add_project_program_entity and
-- 20260831030000_add_vocational_training_center_enum.
ALTER TYPE "UserStatus" ADD VALUE 'DRAFT';
ALTER TYPE "UserStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "UserStatus" ADD VALUE 'COMPLEMENTS_REQUESTED';
ALTER TYPE "UserStatus" ADD VALUE 'DOCUMENTS_INCOMPLETE';
