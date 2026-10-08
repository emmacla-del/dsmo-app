-- Three items printed on the ASFOP 2025-2026 training-centre form that the
-- questionnaire did not collect:
--   2.1.10 "Ville" next to the PO box            -> poBoxCity
--   7.1.3  "Oui / Non" before the channel grid   -> stakeholdersInformed
--   7.6    "Si oui, relatif au domaine : Scolaire / Social / Professionnel"
--                                                 -> trainersSexEdDomains
-- Additive only: nullable / defaulted columns, no existing data touched.

-- AlterTable
ALTER TABLE "onefop_vocational_training_details"
ADD COLUMN "poBoxCity" TEXT,
ADD COLUMN "stakeholdersInformed" BOOLEAN,
ADD COLUMN "trainersSexEdDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
