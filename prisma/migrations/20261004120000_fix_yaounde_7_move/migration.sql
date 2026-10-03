-- Fix: migration 20261003120000_replace_arrondissements_to_360 skipped one
-- row from the "Move to another department" set in
-- docs/reference/arrondissements-mapping.xlsx.
--
-- Row id 58afcd22-d085-4fd4-9c38-a8b66d37a6f9 (name "Yaoundé VII") should
-- have been renamed to "Yaoundé 7", moved from Mefou-et-Afamba to Mfoundi,
-- and coded 1207. None of the three applied.
--
-- Preconditions verified: no duplicate Yaoundé 7 exists; code 1207 is free;
-- Mfoundi is 46d44a34-a48b-473b-87fe-fb168d2d800e.

UPDATE "subdivisions"
SET name           = 'Yaoundé 7',
    "departmentId" = '46d44a34-a48b-473b-87fe-fb168d2d800e',
    code           = '1207'
WHERE id = '58afcd22-d085-4fd4-9c38-a8b66d37a6f9';
