-- Remove the 29 "pending" subdivisions preserved by
-- 20261003120000_replace_arrondissements_to_360, per explicit decision to
-- converge the reference table to the canonical 360 list.
--
-- All data in this database is test data. FK chain for the only referencing
-- records ("Tata" company / establishment in Mbakaou):
--   campaign_submissions (7)  \
--   onefop_submissions (2)     >-- establishment + company -- subdivisions
--   submission_drafts (0)     /
-- Delete leaves first, then parents, then the 29 subdivisions.

DELETE FROM campaign_submissions WHERE "establishmentId" = '92dd4851-50e1-4c75-8158-f7a29812d139';
DELETE FROM campaign_submissions WHERE "companyId"       = '8ba2e116-6d85-42fe-b7c8-7218a28fe0aa';

DELETE FROM onefop_submissions  WHERE "establishmentId" = '92dd4851-50e1-4c75-8158-f7a29812d139';
DELETE FROM onefop_submissions  WHERE "companyId"       = '8ba2e116-6d85-42fe-b7c8-7218a28fe0aa';

DELETE FROM submission_drafts   WHERE "establishmentId" = '92dd4851-50e1-4c75-8158-f7a29812d139';

DELETE FROM establishments WHERE id = '92dd4851-50e1-4c75-8158-f7a29812d139';
DELETE FROM companies      WHERE id = '8ba2e116-6d85-42fe-b7c8-7218a28fe0aa';

DELETE FROM "subdivisions" WHERE name IN (
  'Mbakaou','Gonmé','Meidougou','Koro','Kobdombo','Menomale',
  'Angossas','Atok','Dimako','Nguelebok','Ouli','Moulouvaye',
  'Tchanaga','Toulourou','Limani','Mozogo','Roua','Bonalea',
  'Ekom','Manoka','Ngong','Pignde','Fonfuka','Benakuma','Zhoa',
  'Bansoa','Grand Batanga','Nkpwa','Tinto'
);
