-- Adds the DSMO-only "Centre de formation professionnelle" registration
-- category (EntityType.vocationalCenter in minefop_models.dart) to the
-- Company.entityType enum. This value has no ONEFOP questionnaire — it is
-- unrelated to VOCATIONAL_TRAINING (VT-1/VT-2), which already has its own
-- enum value and full submission pipeline.
--
-- Fixes a production 500 (registerCompany -> EstablishmentIdGenerator.generate
-- threw "Unknown entity type: VOCATIONAL_TRAINING_CENTER") caused by this
-- value having been selectable in the Flutter register screen without ever
-- being wired into this enum.

-- AlterEnum
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside any transaction
-- that also references the new value, so this is its own migration step,
-- consistent with 20260828140000_add_administration_entity and
-- 20260829120000_add_project_program_entity.
ALTER TYPE "OnefopEntityType" ADD VALUE 'VOCATIONAL_TRAINING_CENTER';
