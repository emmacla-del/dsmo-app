-- VT registration-time identification fields on Company, closing the
-- account-creation/prefill gap the 2026-08-30 VT audit found:
-- VOCATIONAL_TRAINING was the only entity type with no registration-time
-- fields at all for its own Section 1 identification (cfpType,
-- educationSystem, functionalStatus, nonFunctionalReason(Other)) or its
-- second Promoteur/Directeur contact block (1.16), distinct from the
-- shared respondent fields already on this table (1.15).
--
-- Additive only — every column is nullable, no existing column, table, or
-- enum is altered. Every other entity type is unaffected: these columns
-- are populated only by the new VOCATIONAL_TRAINING EntityConfig in
-- register_constants.dart, never written to by ENTREPRISE/COOPERATIVE/
-- CTD/ONG/ADMINISTRATION/PROJECT_PROGRAM/VOCATIONAL_TRAINING_CENTER
-- registration.
--
-- cfpType/educationSystem/functionalStatus/nonFunctionalReason are plain
-- strings, not a Postgres enum — matching onefop_ast.dart's own posture
-- that no VT enum backs these fields (no confirmed printed option-list
-- wording to invent one from), so the registration-time picker values
-- (kCfpTypeOptions etc. in register_constants.dart) are stored verbatim.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "sigle" TEXT,
ADD COLUMN "cfpType" TEXT,
ADD COLUMN "educationSystem" TEXT,
ADD COLUMN "functionalStatus" TEXT,
ADD COLUMN "nonFunctionalReason" TEXT,
ADD COLUMN "nonFunctionalReasonOther" TEXT,
ADD COLUMN "promoterName" TEXT,
ADD COLUMN "promoterSex" TEXT,
ADD COLUMN "promoterPhone1" TEXT,
ADD COLUMN "promoterPhone2" TEXT;
