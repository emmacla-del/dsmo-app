-- Projects & Programs: nature / status / stopReason stored as the option
-- string, like every other entity's coded Section 1 answers.
--
-- These three columns held String(code) — "1", "2" … — while their siblings
-- (area, sector) held the AST option string. The exported .sps declares
-- VALUE LABELS keyed by the option string, so SPSS applied none of them and
-- an analyst read a bare "1" for PP_S1Q01 and PP_S1Q13 (E2E 2026-10-17, B1).
-- onefop-questionnaire.dto.ts has always documented the option-string
-- convention for all five fields; three of them were never given a mapper.
--
-- Data only: no column is added, dropped or retyped. The codes below are the
-- AST option order (lib/core/focus/compiler/onefop_ast.dart, PP_S1Q01/13/14),
-- the inverse of mapNature / mapPPStatus / mapStopReason in
-- src/common/normalizers/flat-key-normalizer.ts. Rows already holding an
-- option string, an empty string or NULL are left untouched, so re-running
-- this migration changes nothing.

UPDATE "onefop_project_program_details" SET "nature" = CASE "nature"
  WHEN '1' THEN 'Projet/ Project'
  WHEN '2' THEN 'Programme/ Program'
  WHEN '3' THEN 'Structure sous-tutelle/ Structure under supervision'
  WHEN '4' THEN 'Autres/ Other'
END
WHERE "nature" IN ('1', '2', '3', '4');

UPDATE "onefop_project_program_details" SET "status" = CASE "status"
  WHEN '1' THEN 'En arrêt/ Stopped'
  WHEN '2' THEN 'Actif/ Active'
  WHEN '3' THEN 'En cours de démarrage/ Starting up'
END
WHERE "status" IN ('1', '2', '3');

UPDATE "onefop_project_program_details" SET "stopReason" = CASE "stopReason"
  WHEN '1' THEN 'Arrivé à terme/ Expired'
  WHEN '2' THEN 'Manque de fonds/ Lack of funds'
  WHEN '3' THEN 'Résultats insuffisants/ Insufficient results'
  WHEN '4' THEN 'Autre/ Other'
END
WHERE "stopReason" IN ('1', '2', '3', '4');
