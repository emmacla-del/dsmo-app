-- Three content gaps found while implementing the "MINEFOP Collect"
-- Figma wizard redesign of the existing VT questionnaire — fields shown
-- in the new design that had no home in the existing AST/schema:
--
-- 1. §2.2 latrines (Figma screen 06): total cabin count and girls-only
--    cabin count. The existing hasFunctionalLatrines/latrinesSeparate*
--    booleans capture status, not counts.
-- 2. §6 post-training follow-up (Figma screen 10): formal-sector /
--    informal-sector / still-seeking counts for last year's graduates.
--    No prior AST field captured graduate outcomes by employment status.
-- 3. §8.5 trainer occupational status (Figma screen 11): a third
--    "Contractuel" category alongside the existing Permanent/Vacataire
--    (professionnel/non-professionnel) split.
--
-- Additive only — every column is nullable, no existing column/table/enum
-- is altered. Populated only via the new VT wizard mode
-- (lib/screens/onefop/wizard/); Spreadsheet Mode and Simple Mode simply
-- don't render these fields yet (same AST-driven field list all three
-- modes share, so nothing further to wire once this migration lands).

-- AlterTable
ALTER TABLE "onefop_vocational_training_details"
ADD COLUMN "latrineCabinTotalCount" INTEGER,
ADD COLUMN "latrineCabinGirlsCount" INTEGER,
ADD COLUMN "insertedFormalSectorCount" INTEGER,
ADD COLUMN "insertedInformalSectorCount" INTEGER,
ADD COLUMN "seekingEmploymentCount" INTEGER,
ADD COLUMN "contractualMale" INTEGER,
ADD COLUMN "contractualFemale" INTEGER;
