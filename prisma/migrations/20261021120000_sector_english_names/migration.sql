-- English names of the 19 sectors (defect 7 of the 2026-10-15 VT run,
-- approved by the owner on 2026-10-16). Sector.nameEn existed but was empty,
-- so English screens showed the French name. Data only, no schema change.
-- Matched on the French name; a name already set (by hand) is kept.

UPDATE "sectors" SET "nameEn" = 'Financial and insurance activities' WHERE "name" = 'Activités financières et d''assurance' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Real estate activities' WHERE "name" = 'Activités immobilières' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Legal, accounting and consulting activities' WHERE "name" = 'Activités juridiques, comptables et de conseil' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Public administration and defence' WHERE "name" = 'Administration publique et défense' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Agriculture, livestock, forestry and fishing' WHERE "name" = 'Agriculture, élevage, sylviculture et pêche' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Arts, entertainment and recreation' WHERE "name" = 'Arts, spectacles et loisirs' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Other service activities' WHERE "name" = 'Autres activités de services' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Wholesale and retail trade' WHERE "name" = 'Commerce de gros et de détail' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Construction and public works' WHERE "name" = 'Construction et BTP' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Education' WHERE "name" = 'Enseignement' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Accommodation and food services' WHERE "name" = 'Hôtellerie et restauration' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Manufacturing' WHERE "name" = 'Industrie manufacturière' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Mining and quarrying' WHERE "name" = 'Industries extractives' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Information and communication' WHERE "name" = 'Information et communication' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Extraterritorial organisations' WHERE "name" = 'Organismes extraterritoriaux' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Water, electricity and gas supply' WHERE "name" = 'Production et distribution d''eau, électricité et gaz' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Research and development' WHERE "name" = 'Recherche et développement' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Human health and social work' WHERE "name" = 'Santé humaine et action sociale' AND "nameEn" IS NULL;
UPDATE "sectors" SET "nameEn" = 'Transport and storage' WHERE "name" = 'Transport et entreposage' AND "nameEn" IS NULL;
