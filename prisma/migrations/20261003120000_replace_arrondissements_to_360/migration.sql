-- =============================================================================
-- Migration: 20261003120000_replace_arrondissements_to_360
--
-- Canonical Cameroon Administrative Hierarchy (360 Subdivisions, 58 Departments, 10 Regions)
-- Sourced from reviewed mapping docs/reference/arrondissements-mapping.xlsx.
--
-- POLICY NOTE:
-- Subdivision codes are FROZEN from now on.
-- Any future new arrondissements added to the database MUST receive the next free
-- sequential number within their department (e.g. department 12 gets 1208, 1209, etc.).
-- Existing codes MUST NEVER be shifted, re-indexed, or re-used.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Department spelling updates (preserve IDs)
-- =============================================================================
UPDATE "departments" SET "name" = 'Kupe-Manenguba' WHERE "name" = 'Koupé-Muanenguba' AND "regionId" = (SELECT id FROM "regions" WHERE "name" = 'Sud-Ouest');
UPDATE "departments" SET "name" = 'Mefou-et-Afamba' WHERE "name" = 'Méfou-et-Afamba' AND "regionId" = (SELECT id FROM "regions" WHERE "name" = 'Centre');
UPDATE "departments" SET "name" = 'Mefou-et-Akono' WHERE "name" = 'Méfou-et-Akono' AND "regionId" = (SELECT id FROM "regions" WHERE "name" = 'Centre');

-- Update denormalized department/region text in users, notifications, companies, establishments, submissions
-- NOTE: Onefop*Detail tables remain completely untouched.
UPDATE "users" SET "department" = 'Kupe-Manenguba' WHERE "department" = 'Koupé-Muanenguba';
UPDATE "users" SET "department" = 'Mefou-et-Afamba' WHERE "department" = 'Méfou-et-Afamba';
UPDATE "users" SET "department" = 'Mefou-et-Akono' WHERE "department" = 'Méfou-et-Akono';

UPDATE "notifications" SET "departmentFilter" = 'Kupe-Manenguba' WHERE "departmentFilter" = 'Koupé-Muanenguba';
UPDATE "notifications" SET "departmentFilter" = 'Mefou-et-Afamba' WHERE "departmentFilter" = 'Méfou-et-Afamba';
UPDATE "notifications" SET "departmentFilter" = 'Mefou-et-Akono' WHERE "departmentFilter" = 'Méfou-et-Akono';

UPDATE "companies" SET "department" = 'Kupe-Manenguba' WHERE "department" = 'Koupé-Muanenguba';
UPDATE "companies" SET "department" = 'Mefou-et-Afamba' WHERE "department" = 'Méfou-et-Afamba';
UPDATE "companies" SET "department" = 'Mefou-et-Akono' WHERE "department" = 'Méfou-et-Akono';

UPDATE "establishments" SET "department" = 'Kupe-Manenguba' WHERE "department" = 'Koupé-Muanenguba';
UPDATE "establishments" SET "department" = 'Mefou-et-Afamba' WHERE "department" = 'Méfou-et-Afamba';
UPDATE "establishments" SET "department" = 'Mefou-et-Akono' WHERE "department" = 'Méfou-et-Akono';

UPDATE "onefop_submissions" SET "department" = 'Kupe-Manenguba' WHERE "department" = 'Koupé-Muanenguba';
UPDATE "onefop_submissions" SET "department" = 'Mefou-et-Afamba' WHERE "department" = 'Méfou-et-Afamba';
UPDATE "onefop_submissions" SET "department" = 'Mefou-et-Akono' WHERE "department" = 'Méfou-et-Akono';

-- =============================================================================
-- 2. Move subdivisions to their new departments (preserve IDs)
-- =============================================================================
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina'), "name" = 'Nganha', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ngan-Ha' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Banyo');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Akono'), "name" = 'Mbankomo', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Mbankomo' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-So''o');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mfoundi'), "name" = 'Yaoundé 7', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Yaoundé VII' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Afamba');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari'), "name" = 'Blangoua', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Blangoua' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay'), "name" = 'Kai-Kai', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kaïkaï' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani'), "name" = 'Kaélé', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kaélé' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani'), "name" = 'Mindif', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Mindif' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila'), "name" = 'Biwong-Bane', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Biwong-Bané' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila'), "name" = 'Biwong-Bulu', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Biwong-Bulu' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem'), "name" = 'Ambam', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ambam' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem'), "name" = 'Ma''an', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ma''an' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mvila');

-- =============================================================================
-- 3. Rename subdivisions (same department, new spelling - preserve IDs)
-- =============================================================================
UPDATE "subdivisions" SET "name" = 'Hile-Halifa', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Hilé-Alifa' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari' OR "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "name" = 'Bourrha', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bourha' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga' OR "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "name" = 'Malentouen', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Malantouen' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Noun' OR "name" = 'Noun');
UPDATE "subdivisions" SET "name" = 'Eyumodjock', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Eyumojock' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Manyu' OR "name" = 'Manyu');
UPDATE "subdivisions" SET "name" = 'Mayo-Darlé', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Mayo-Darle' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Banyo' OR "name" = 'Mayo-Banyo');
UPDATE "subdivisions" SET "name" = 'Bélél', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Belel' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Vina' OR "name" = 'Vina');
UPDATE "subdivisions" SET "name" = 'Ngaoundéré 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ngaoundéré I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Vina' OR "name" = 'Vina');
UPDATE "subdivisions" SET "name" = 'Ngaoundéré 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ngaoundéré II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Vina' OR "name" = 'Vina');
UPDATE "subdivisions" SET "name" = 'Ngaoundéré 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ngaoundéré III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Vina' OR "name" = 'Vina');
UPDATE "subdivisions" SET "name" = 'Makenene', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Makénéné' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou' OR "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "name" = 'Ndikinimeki', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ndikiniméki' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou' OR "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "name" = 'Ngambé-Tikar', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ngambe-Tikar' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Kim' OR "name" = 'Mbam-et-Kim');
UPDATE "subdivisions" SET "name" = 'Awaé', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Awaé' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Afamba' OR "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "name" = 'Esse', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Esse' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Afamba' OR "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "name" = 'Mfou', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Mfou' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Afamba' OR "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "name" = 'Nkolafamba', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Nkolafamba' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Afamba' OR "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "name" = 'Soa', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Soa' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Afamba' OR "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "name" = 'Akono', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Akono' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Akono' OR "name" = 'Mefou-et-Akono');
UPDATE "subdivisions" SET "name" = 'Bikok', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bikok' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Akono' OR "name" = 'Mefou-et-Akono');
UPDATE "subdivisions" SET "name" = 'Ngoumou', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ngoumou' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Méfou-et-Akono' OR "name" = 'Mefou-et-Akono');
UPDATE "subdivisions" SET "name" = 'Yaoundé 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Yaoundé I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mfoundi' OR "name" = 'Mfoundi');
UPDATE "subdivisions" SET "name" = 'Yaoundé 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Yaoundé II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mfoundi' OR "name" = 'Mfoundi');
UPDATE "subdivisions" SET "name" = 'Yaoundé 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Yaoundé III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mfoundi' OR "name" = 'Mfoundi');
UPDATE "subdivisions" SET "name" = 'Yaoundé 4', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Yaoundé IV' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mfoundi' OR "name" = 'Mfoundi');
UPDATE "subdivisions" SET "name" = 'Yaoundé 5', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Yaoundé V' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mfoundi' OR "name" = 'Mfoundi');
UPDATE "subdivisions" SET "name" = 'Yaoundé 6', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Yaoundé VI' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mfoundi' OR "name" = 'Mfoundi');
UPDATE "subdivisions" SET "name" = 'Eséka', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Éséka' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé' OR "name" = 'Nyong-et-Kelle');
UPDATE "subdivisions" SET "name" = 'Doumé', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Doume' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong' OR "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "name" = 'Messaména', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Messamena' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong' OR "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "name" = 'Kétté', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kette' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Kadey' OR "name" = 'Kadey');
UPDATE "subdivisions" SET "name" = 'Ndélélé', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ndelele' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Kadey' OR "name" = 'Kadey');
UPDATE "subdivisions" SET "name" = 'Belabo', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bélabo' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem' OR "name" = 'Lom-et-Djerem');
UPDATE "subdivisions" SET "name" = 'Bertoua 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bertoua I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem' OR "name" = 'Lom-et-Djerem');
UPDATE "subdivisions" SET "name" = 'Bertoua 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bertoua II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem' OR "name" = 'Lom-et-Djerem');
UPDATE "subdivisions" SET "name" = 'Bétaré-Oya', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Betaré-Oya' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem' OR "name" = 'Lom-et-Djerem');
UPDATE "subdivisions" SET "name" = 'Maroua 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Maroua I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Diamaré' OR "name" = 'Diamare');
UPDATE "subdivisions" SET "name" = 'Maroua 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Maroua II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Diamaré' OR "name" = 'Diamare');
UPDATE "subdivisions" SET "name" = 'Maroua 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Maroua III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Diamaré' OR "name" = 'Diamare');
UPDATE "subdivisions" SET "name" = 'Méri', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Meri' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Diamaré' OR "name" = 'Diamare');
UPDATE "subdivisions" SET "name" = 'Petté', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Pette' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Diamaré' OR "name" = 'Diamare');
UPDATE "subdivisions" SET "name" = 'Datchéka', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Datcheka' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay' OR "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "name" = 'Soulede-Roua', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Soulédé-Roua' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga' OR "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "name" = 'Baré-Bakem', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bare-Bakem' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Moungo' OR "name" = 'Moungo');
UPDATE "subdivisions" SET "name" = 'Njombé-Penja', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Njombe-Penja' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Moungo' OR "name" = 'Moungo');
UPDATE "subdivisions" SET "name" = 'Nkongsamba 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Nkongsamba I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Moungo' OR "name" = 'Moungo');
UPDATE "subdivisions" SET "name" = 'Nkongsamba 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Nkongsamba II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Moungo' OR "name" = 'Moungo');
UPDATE "subdivisions" SET "name" = 'Nkongsamba 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Nkongsamba III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Moungo' OR "name" = 'Moungo');
UPDATE "subdivisions" SET "name" = 'Dizangué', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Dizangue' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime' OR "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "name" = 'Edéa 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Édéa I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime' OR "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "name" = 'Edéa 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Édéa II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime' OR "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "name" = 'Ngambé', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ngambe' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime' OR "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "name" = 'Douala 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Douala I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Wouri' OR "name" = 'Wouri');
UPDATE "subdivisions" SET "name" = 'Douala 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Douala II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Wouri' OR "name" = 'Wouri');
UPDATE "subdivisions" SET "name" = 'Douala 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Douala III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Wouri' OR "name" = 'Wouri');
UPDATE "subdivisions" SET "name" = 'Douala 4', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Douala IV' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Wouri' OR "name" = 'Wouri');
UPDATE "subdivisions" SET "name" = 'Douala 5', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Douala V' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Wouri' OR "name" = 'Wouri');
UPDATE "subdivisions" SET "name" = 'Garoua 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Garoua I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Bénoué' OR "name" = 'Benoue');
UPDATE "subdivisions" SET "name" = 'Garoua 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Garoua II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Bénoué' OR "name" = 'Benoue');
UPDATE "subdivisions" SET "name" = 'Garoua 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Garoua III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Bénoué' OR "name" = 'Benoue');
UPDATE "subdivisions" SET "name" = 'Tcheboa', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Tchéboa' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Bénoué' OR "name" = 'Benoue');
UPDATE "subdivisions" SET "name" = 'Béka', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Beka' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Faro' OR "name" = 'Faro');
UPDATE "subdivisions" SET "name" = 'Bamenda 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bamenda I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mezam' OR "name" = 'Mezam');
UPDATE "subdivisions" SET "name" = 'Bamenda 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bamenda II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mezam' OR "name" = 'Mezam');
UPDATE "subdivisions" SET "name" = 'Bamenda 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bamenda III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mezam' OR "name" = 'Mezam');
UPDATE "subdivisions" SET "name" = 'Kékem', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kekem' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Haut-Nkam' OR "name" = 'Haut-Nkam');
UPDATE "subdivisions" SET "name" = 'Bafoussam 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bafoussam I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mifi' OR "name" = 'Mifi');
UPDATE "subdivisions" SET "name" = 'Bafoussam 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bafoussam II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mifi' OR "name" = 'Mifi');
UPDATE "subdivisions" SET "name" = 'Bafoussam 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bafoussam III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mifi' OR "name" = 'Mifi');
UPDATE "subdivisions" SET "name" = 'Sangmelima', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Sangmélima' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo' OR "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "name" = 'Ebolowa 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ebolowa I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mvila' OR "name" = 'Mvila');
UPDATE "subdivisions" SET "name" = 'Ebolowa 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ebolowa II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Mvila' OR "name" = 'Mvila');
UPDATE "subdivisions" SET "name" = 'Kribi 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kribi I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Océan' OR "name" = 'Ocean');
UPDATE "subdivisions" SET "name" = 'Kribi 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kribi II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Océan' OR "name" = 'Ocean');
UPDATE "subdivisions" SET "name" = 'Limbe 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Limbe I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Fako' OR "name" = 'Fako');
UPDATE "subdivisions" SET "name" = 'Limbe 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Limbe II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Fako' OR "name" = 'Fako');
UPDATE "subdivisions" SET "name" = 'Limbe 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Limbe III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Fako' OR "name" = 'Fako');
UPDATE "subdivisions" SET "name" = 'Bangem', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Bangem' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Koupé-Muanenguba' OR "name" = 'Koupe-Muanenguba');
UPDATE "subdivisions" SET "name" = 'Nguti', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Nguti' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Koupé-Muanenguba' OR "name" = 'Koupe-Muanenguba');
UPDATE "subdivisions" SET "name" = 'Tombel', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Tombel' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Koupé-Muanenguba' OR "name" = 'Koupe-Muanenguba');
UPDATE "subdivisions" SET "name" = 'Kumba 1', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kumba I' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Meme' OR "name" = 'Meme');
UPDATE "subdivisions" SET "name" = 'Kumba 2', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kumba II' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Meme' OR "name" = 'Meme');
UPDATE "subdivisions" SET "name" = 'Kumba 3', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Kumba III' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Meme' OR "name" = 'Meme');
UPDATE "subdivisions" SET "name" = 'Ekondo Titi', "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'Ekondo-Titi' AND "departmentId" IN (SELECT id FROM "departments" WHERE "name" = 'Ndian' OR "name" = 'Ndian');

-- =============================================================================
-- 4. Repoint references for 20 duplicate copies and safely delete duplicate rows
-- =============================================================================
DO $$
DECLARE
    v_dup_id TEXT;
    v_kept_id TEXT;
    v_kept_name TEXT;
    v_kept_dept TEXT;
    v_kept_dept_id TEXT;
    v_kept_reg TEXT;
    v_kept_reg_id TEXT;
    v_ref_check INT;
BEGIN

    -- Duplicate: Méfou-et-Akono -> Dzeng (Kept under Nyong-et-So'o -> Dzeng)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Méfou-et-Akono' OR d.name = 'Mefou-et-Akono')
      AND s.name = 'Dzeng';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Nyong-et-So''o' AND s.name = 'Dzeng';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Dzeng'
          AND ("department" = 'Méfou-et-Akono' OR "department" = 'Mefou-et-Akono');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Dzeng', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Méfou-et-Akono -> Mengueme (Kept under Nyong-et-So'o -> Mengueme)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Méfou-et-Akono' OR d.name = 'Mefou-et-Akono')
      AND s.name = 'Mengueme';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Nyong-et-So''o' AND s.name = 'Mengueme';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Mengueme'
          AND ("department" = 'Méfou-et-Akono' OR "department" = 'Mefou-et-Akono');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Mengueme', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Méfou-et-Akono -> Ngog-Mapubi (Kept under Nyong-et-Kellé -> Ngog-Mapubi)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Méfou-et-Akono' OR d.name = 'Mefou-et-Akono')
      AND s.name = 'Ngog-Mapubi';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Nyong-et-Kellé' AND s.name = 'Ngog-Mapubi';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Ngog-Mapubi'
          AND ("department" = 'Méfou-et-Akono' OR "department" = 'Mefou-et-Akono');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Ngog-Mapubi', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Nyong-et-Kellé -> Nyanon (Kept under Sanaga-Maritime -> Nyanon)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Nyong-et-Kellé' OR d.name = 'Nyong-et-Kelle')
      AND s.name = 'Nyanon';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Sanaga-Maritime' AND s.name = 'Nyanon';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Nyanon'
          AND ("department" = 'Nyong-et-Kellé' OR "department" = 'Nyong-et-Kelle');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Nyanon', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Nyong-et-Kellé -> Pouma (Kept under Sanaga-Maritime -> Pouma)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Nyong-et-Kellé' OR d.name = 'Nyong-et-Kelle')
      AND s.name = 'Pouma';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Sanaga-Maritime' AND s.name = 'Pouma';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Pouma'
          AND ("department" = 'Nyong-et-Kellé' OR "department" = 'Nyong-et-Kelle');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Pouma', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Nyong-et-Mfoumou -> Ngomedzap (Kept under Nyong-et-So'o -> Ngomedzap)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Nyong-et-Mfoumou' OR d.name = 'Nyong-et-Mfoumou')
      AND s.name = 'Ngomedzap';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Nyong-et-So''o' AND s.name = 'Ngomedzap';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Ngomedzap'
          AND ("department" = 'Nyong-et-Mfoumou' OR "department" = 'Nyong-et-Mfoumou');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Ngomedzap', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Nyong-et-So'o -> Mfou (Kept under Mefou-et-Afamba -> Mfou)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Nyong-et-So''o' OR d.name = 'Nyong-et-So''o')
      AND s.name = 'Mfou';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Mefou-et-Afamba' AND s.name = 'Mfou';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Mfou'
          AND ("department" = 'Nyong-et-So''o' OR "department" = 'Nyong-et-So''o');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Mfou', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Nyong-et-So'o -> Ngoumou (Kept under Mefou-et-Akono -> Ngoumou)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Nyong-et-So''o' OR d.name = 'Nyong-et-So''o')
      AND s.name = 'Ngoumou';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Mefou-et-Akono' AND s.name = 'Ngoumou';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Ngoumou'
          AND ("department" = 'Nyong-et-So''o' OR "department" = 'Nyong-et-So''o');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Ngoumou', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Mayo-Danay -> Gazawa (Kept under Diamaré -> Gazawa)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Mayo-Danay' OR d.name = 'Mayo-Danay')
      AND s.name = 'Gazawa';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Diamaré' AND s.name = 'Gazawa';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Gazawa'
          AND ("department" = 'Mayo-Danay' OR "department" = 'Mayo-Danay');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Gazawa', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Mayo-Sava -> Méri (Kept under Diamaré -> Méri)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Mayo-Sava' OR d.name = 'Mayo-Sava')
      AND s.name = 'Méri';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Diamaré' AND s.name = 'Méri';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Méri'
          AND ("department" = 'Mayo-Sava' OR "department" = 'Mayo-Sava');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Méri', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Nkam -> Ndom (Kept under Sanaga-Maritime -> Ndom)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Nkam' OR d.name = 'Nkam')
      AND s.name = 'Ndom';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Sanaga-Maritime' AND s.name = 'Ndom';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Ndom'
          AND ("department" = 'Nkam' OR "department" = 'Nkam');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Ndom', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Nkam -> Ngambe (Kept under Sanaga-Maritime -> Ngambé)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Nkam' OR d.name = 'Nkam')
      AND s.name = 'Ngambe';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Sanaga-Maritime' AND s.name = 'Ngambé';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Ngambe'
          AND ("department" = 'Nkam' OR "department" = 'Nkam');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Ngambe', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Haut-Nkam -> Batcham (Kept under Bamboutos -> Batcham)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Haut-Nkam' OR d.name = 'Haut-Nkam')
      AND s.name = 'Batcham';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Bamboutos' AND s.name = 'Batcham';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Batcham'
          AND ("department" = 'Haut-Nkam' OR "department" = 'Haut-Nkam');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Batcham', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Koung-Khi -> Bamendjou (Kept under Hauts-Plateaux -> Bamendjou)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Koung-Khi' OR d.name = 'Koung-Khi')
      AND s.name = 'Bamendjou';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Hauts-Plateaux' AND s.name = 'Bamendjou';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Bamendjou'
          AND ("department" = 'Koung-Khi' OR "department" = 'Koung-Khi');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Bamendjou', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Koung-Khi -> Kouoptamo (Kept under Noun -> Kouoptamo)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Koung-Khi' OR d.name = 'Koung-Khi')
      AND s.name = 'Kouoptamo';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Noun' AND s.name = 'Kouoptamo';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Kouoptamo'
          AND ("department" = 'Koung-Khi' OR "department" = 'Koung-Khi');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Kouoptamo', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Menoua -> Kekem (Kept under Haut-Nkam -> Kékem)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Menoua' OR d.name = 'Menoua')
      AND s.name = 'Kekem';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Haut-Nkam' AND s.name = 'Kékem';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Kekem'
          AND ("department" = 'Menoua' OR "department" = 'Menoua');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Kekem', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Dja-et-Lobo -> Mvangan (Kept under Mvila -> Mvangan)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Dja-et-Lobo' OR d.name = 'Dja-et-Lobo')
      AND s.name = 'Mvangan';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Mvila' AND s.name = 'Mvangan';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Mvangan'
          AND ("department" = 'Dja-et-Lobo' OR "department" = 'Dja-et-Lobo');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Mvangan', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Mvila -> Bengbis (Kept under Dja-et-Lobo -> Bengbis)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Mvila' OR d.name = 'Mvila')
      AND s.name = 'Bengbis';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Dja-et-Lobo' AND s.name = 'Bengbis';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Bengbis'
          AND ("department" = 'Mvila' OR "department" = 'Mvila');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Bengbis', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Vallée-du-Ntem -> Djoum (Kept under Dja-et-Lobo -> Djoum)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Vallée-du-Ntem' OR d.name = 'Vallee-du-Ntem')
      AND s.name = 'Djoum';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Dja-et-Lobo' AND s.name = 'Djoum';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Djoum'
          AND ("department" = 'Vallée-du-Ntem' OR "department" = 'Vallee-du-Ntem');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Djoum', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

    -- Duplicate: Vallée-du-Ntem -> Meyomessala (Kept under Dja-et-Lobo -> Meyomessala)
    v_dup_id := NULL;
    v_kept_id := NULL;

    SELECT s.id INTO v_dup_id
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    WHERE (d.name = 'Vallée-du-Ntem' OR d.name = 'Vallee-du-Ntem')
      AND s.name = 'Meyomessala';

    SELECT s.id, s.name, d.id, d.name, r.id, r.name
    INTO v_kept_id, v_kept_name, v_kept_dept_id, v_kept_dept, v_kept_reg_id, v_kept_reg
    FROM "subdivisions" s
    JOIN "departments" d ON d.id = s."departmentId"
    JOIN "regions" r ON r.id = d."regionId"
    WHERE d.name = 'Dja-et-Lobo' AND s.name = 'Meyomessala';

    IF v_dup_id IS NOT NULL AND v_kept_id IS NOT NULL THEN
        -- Repoint companies
        UPDATE "companies"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint establishments
        UPDATE "establishments"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint onefop_submissions
        UPDATE "onefop_submissions"
        SET "subdivisionId" = v_kept_id,
            "subdivision" = v_kept_name,
            "departmentId" = v_kept_dept_id,
            "department" = v_kept_dept,
            "regionId" = v_kept_reg_id,
            "region" = v_kept_reg
        WHERE "subdivisionId" = v_dup_id;

        -- Repoint users
        UPDATE "users"
        SET "subdivision" = v_kept_name,
            "department" = v_kept_dept,
            "region" = v_kept_reg
        WHERE "subdivision" = 'Meyomessala'
          AND ("department" = 'Vallée-du-Ntem' OR "department" = 'Vallee-du-Ntem');

        -- Check if any unexpected references remain before deleting
        SELECT (
            (SELECT COUNT(*) FROM "companies" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "establishments" WHERE "subdivisionId" = v_dup_id) +
            (SELECT COUNT(*) FROM "onefop_submissions" WHERE "subdivisionId" = v_dup_id)
        ) INTO v_ref_check;

        IF v_ref_check > 0 THEN
            RAISE EXCEPTION 'Unexpected active reference to duplicate subdivision % (%) after repoint',
                'Meyomessala', v_dup_id;
        END IF;

        DELETE FROM "subdivisions" WHERE id = v_dup_id;
    END IF;

END $$;

-- =============================================================================
-- 5. Add missing subdivisions (78 rows)
-- =============================================================================
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Dir', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mbéré' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Mbé', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Vina' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bibey', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haute-Sanaga' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Mbandjock', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haute-Sanaga' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Nsem', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haute-Sanaga' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Lobo', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Lékié' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Okola', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Lékié' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Kom-Yambetta', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mbam-et-Inoubou' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Afanloum', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mefou-et-Afamba' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Assamba', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mefou-et-Afamba' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Edzendouan', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mefou-et-Afamba' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Biyouha', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-Kellé' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bondjock', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-Kellé' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bot-Makak', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-Kellé' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Dibang', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-Kellé' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Nguibassal', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-Kellé' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Mengang', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-Mfoumou' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Nyakokombo', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-Mfoumou' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Akoeman', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-So''o' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Nkolmetet', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nyong-et-So''o' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bebend', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haut-Nyong' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Dja', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haut-Nyong' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Mboanz', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haut-Nyong' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Messok', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haut-Nyong' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bombé', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Kadey' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Mbotoro', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Kadey' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Ndem-Nam', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Kadey' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Garoua-Boulaï', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Lom-et-Djérem' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Mandjou', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Lom-et-Djérem' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bogo', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Diamaré' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Dargala', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Diamaré' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Darak', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Logone-et-Chari' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Gobo', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Danay' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Guéré', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Danay' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Kalfou', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Danay' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Vélé', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Danay' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Wina', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Danay' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Moutourwa', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Kani' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Porhi', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Kani' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Taibong', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Kani' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Mayo-Moskota', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Tsanaga' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Fiko', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Moungo' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Nlonako', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Moungo' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Nkondjock', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nkam' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Nord-Makombe', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Nkam' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Massock-Songloulou', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Sanaga-Maritime' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Ngwei', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Sanaga-Maritime' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Douala 6', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Wouri' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Baschéo', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Bénoué' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Demsa', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Bénoué' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Mayo-Hourna', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Bénoué' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Touroua', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Bénoué' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Madingring', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Mayo-Rey' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bum', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Boyo' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Njinikom', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Boyo' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Misaje', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Donga-Mantung' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Furu-Awa', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Menchum' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Menchum-Valley', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Menchum' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Ngie', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Momo' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bakou', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haut-Nkam' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bana', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haut-Nkam' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Banwa', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Haut-Nkam' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Batié', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Hauts-Plateaux' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bayangam', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Koung-Khi' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Djebem', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Koung-Khi' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bangourain', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Noun' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Zoétélé', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Dja-et-Lobo' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bipindi', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Océan' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Lokoundje', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Océan' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Niété', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Océan' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Kyé-Ossi', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Vallée-du-Ntem' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Olamzé', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Vallée-du-Ntem' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'West-Coast', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Fako' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Upper-Bayang', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Manyu' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Bamusso', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Ndian' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Dikome-Balue', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Ndian' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Idabato', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Ndian' ON CONFLICT ("departmentId", "name") DO NOTHING;
INSERT INTO "subdivisions" ("id", "name", "departmentId", "createdAt", "updatedAt") SELECT gen_random_uuid()::text, 'Toko', d.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "departments" d WHERE d."name" = 'Ndian' ON CONFLICT ("departmentId", "name") DO NOTHING;

-- =============================================================================
-- 6. Regenerate and freeze subdivision codes
--    Clear existing codes first to avoid unique constraint violations during renumbering
-- =============================================================================
UPDATE "subdivisions" SET "code" = NULL;

-- 6a. Canonical 360 Subdivisions
UPDATE "subdivisions" SET "code" = '0101' WHERE "name" = 'Ngaoundal' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Djérem');
UPDATE "subdivisions" SET "code" = '0102' WHERE "name" = 'Tibati' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Djérem');
UPDATE "subdivisions" SET "code" = '0201' WHERE "name" = 'Galim-Tignère' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Faro-et-Déo');
UPDATE "subdivisions" SET "code" = '0202' WHERE "name" = 'Kontcha' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Faro-et-Déo');
UPDATE "subdivisions" SET "code" = '0203' WHERE "name" = 'Mayo-Baléo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Faro-et-Déo');
UPDATE "subdivisions" SET "code" = '0204' WHERE "name" = 'Tignère' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Faro-et-Déo');
UPDATE "subdivisions" SET "code" = '0301' WHERE "name" = 'Bankim' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Banyo');
UPDATE "subdivisions" SET "code" = '0302' WHERE "name" = 'Banyo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Banyo');
UPDATE "subdivisions" SET "code" = '0303' WHERE "name" = 'Mayo-Darlé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Banyo');
UPDATE "subdivisions" SET "code" = '0401' WHERE "name" = 'Dir' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbéré');
UPDATE "subdivisions" SET "code" = '0402' WHERE "name" = 'Djohong' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbéré');
UPDATE "subdivisions" SET "code" = '0403' WHERE "name" = 'Meiganga' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbéré');
UPDATE "subdivisions" SET "code" = '0404' WHERE "name" = 'Ngaoui' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbéré');
UPDATE "subdivisions" SET "code" = '0501' WHERE "name" = 'Bélél' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0502' WHERE "name" = 'Martap' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0503' WHERE "name" = 'Mbé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0504' WHERE "name" = 'Nganha' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0505' WHERE "name" = 'Ngaoundéré 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0506' WHERE "name" = 'Ngaoundéré 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0507' WHERE "name" = 'Ngaoundéré 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0508' WHERE "name" = 'Nyambaka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0601' WHERE "name" = 'Bibey' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haute-Sanaga');
UPDATE "subdivisions" SET "code" = '0602' WHERE "name" = 'Lembe-Yezoum' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haute-Sanaga');
UPDATE "subdivisions" SET "code" = '0603' WHERE "name" = 'Mbandjock' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haute-Sanaga');
UPDATE "subdivisions" SET "code" = '0604' WHERE "name" = 'Minta' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haute-Sanaga');
UPDATE "subdivisions" SET "code" = '0605' WHERE "name" = 'Nanga-Eboko' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haute-Sanaga');
UPDATE "subdivisions" SET "code" = '0606' WHERE "name" = 'Nkoteng' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haute-Sanaga');
UPDATE "subdivisions" SET "code" = '0607' WHERE "name" = 'Nsem' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haute-Sanaga');
UPDATE "subdivisions" SET "code" = '0701' WHERE "name" = 'Batchenga' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0702' WHERE "name" = 'Ebebda' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0703' WHERE "name" = 'Elig-Mfomo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0704' WHERE "name" = 'Evodoula' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0705' WHERE "name" = 'Lobo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0706' WHERE "name" = 'Monatélé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0707' WHERE "name" = 'Obala' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0708' WHERE "name" = 'Okola' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0709' WHERE "name" = 'Sa''a' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lékié');
UPDATE "subdivisions" SET "code" = '0801' WHERE "name" = 'Bafia' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0802' WHERE "name" = 'Bokito' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0803' WHERE "name" = 'Deuk' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0804' WHERE "name" = 'Kiiki' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0805' WHERE "name" = 'Kom-Yambetta' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0806' WHERE "name" = 'Makenene' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0807' WHERE "name" = 'Ndikinimeki' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0808' WHERE "name" = 'Nitoukou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0809' WHERE "name" = 'Ombessa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '0901' WHERE "name" = 'Mbangassina' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Kim');
UPDATE "subdivisions" SET "code" = '0902' WHERE "name" = 'Ngambé-Tikar' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Kim');
UPDATE "subdivisions" SET "code" = '0903' WHERE "name" = 'Ngoro' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Kim');
UPDATE "subdivisions" SET "code" = '0904' WHERE "name" = 'Ntui' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Kim');
UPDATE "subdivisions" SET "code" = '0905' WHERE "name" = 'Yoko' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Kim');
UPDATE "subdivisions" SET "code" = '1001' WHERE "name" = 'Afanloum' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "code" = '1002' WHERE "name" = 'Assamba' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "code" = '1003' WHERE "name" = 'Awaé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "code" = '1004' WHERE "name" = 'Edzendouan' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "code" = '1005' WHERE "name" = 'Esse' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "code" = '1006' WHERE "name" = 'Mfou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "code" = '1007' WHERE "name" = 'Nkolafamba' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "code" = '1008' WHERE "name" = 'Soa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Afamba');
UPDATE "subdivisions" SET "code" = '1101' WHERE "name" = 'Akono' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Akono');
UPDATE "subdivisions" SET "code" = '1102' WHERE "name" = 'Bikok' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Akono');
UPDATE "subdivisions" SET "code" = '1103' WHERE "name" = 'Mbankomo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Akono');
UPDATE "subdivisions" SET "code" = '1104' WHERE "name" = 'Ngoumou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mefou-et-Akono');
UPDATE "subdivisions" SET "code" = '1201' WHERE "name" = 'Yaoundé 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mfoundi');
UPDATE "subdivisions" SET "code" = '1202' WHERE "name" = 'Yaoundé 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mfoundi');
UPDATE "subdivisions" SET "code" = '1203' WHERE "name" = 'Yaoundé 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mfoundi');
UPDATE "subdivisions" SET "code" = '1204' WHERE "name" = 'Yaoundé 4' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mfoundi');
UPDATE "subdivisions" SET "code" = '1205' WHERE "name" = 'Yaoundé 5' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mfoundi');
UPDATE "subdivisions" SET "code" = '1206' WHERE "name" = 'Yaoundé 6' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mfoundi');
UPDATE "subdivisions" SET "code" = '1207' WHERE "name" = 'Yaoundé 7' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mfoundi');
UPDATE "subdivisions" SET "code" = '1301' WHERE "name" = 'Biyouha' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1302' WHERE "name" = 'Bondjock' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1303' WHERE "name" = 'Bot-Makak' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1304' WHERE "name" = 'Dibang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1305' WHERE "name" = 'Eséka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1306' WHERE "name" = 'Makak' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1307' WHERE "name" = 'Matomb' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1308' WHERE "name" = 'Messondo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1309' WHERE "name" = 'Ngog-Mapubi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1310' WHERE "name" = 'Nguibassal' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Kellé');
UPDATE "subdivisions" SET "code" = '1401' WHERE "name" = 'Akonolinga' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Mfoumou');
UPDATE "subdivisions" SET "code" = '1402' WHERE "name" = 'Ayos' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Mfoumou');
UPDATE "subdivisions" SET "code" = '1403' WHERE "name" = 'Endom' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Mfoumou');
UPDATE "subdivisions" SET "code" = '1404' WHERE "name" = 'Mengang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Mfoumou');
UPDATE "subdivisions" SET "code" = '1405' WHERE "name" = 'Nyakokombo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Mfoumou');
UPDATE "subdivisions" SET "code" = '1501' WHERE "name" = 'Akoeman' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-So''o');
UPDATE "subdivisions" SET "code" = '1502' WHERE "name" = 'Dzeng' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-So''o');
UPDATE "subdivisions" SET "code" = '1503' WHERE "name" = 'Mbalmayo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-So''o');
UPDATE "subdivisions" SET "code" = '1504' WHERE "name" = 'Mengueme' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-So''o');
UPDATE "subdivisions" SET "code" = '1505' WHERE "name" = 'Ngomedzap' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-So''o');
UPDATE "subdivisions" SET "code" = '1506' WHERE "name" = 'Nkolmetet' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-So''o');
UPDATE "subdivisions" SET "code" = '1601' WHERE "name" = 'Gari-Gombo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boumba-et-Ngoko');
UPDATE "subdivisions" SET "code" = '1602' WHERE "name" = 'Moloundou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boumba-et-Ngoko');
UPDATE "subdivisions" SET "code" = '1603' WHERE "name" = 'Salapoumbé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boumba-et-Ngoko');
UPDATE "subdivisions" SET "code" = '1604' WHERE "name" = 'Yokadouma' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boumba-et-Ngoko');
UPDATE "subdivisions" SET "code" = '1701' WHERE "name" = 'Abong-Mbang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1702' WHERE "name" = 'Bebend' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1703' WHERE "name" = 'Dja' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1704' WHERE "name" = 'Doumaintang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1705' WHERE "name" = 'Doumé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1706' WHERE "name" = 'Lomié' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1707' WHERE "name" = 'Mboanz' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1708' WHERE "name" = 'Mboma' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1709' WHERE "name" = 'Messaména' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1710' WHERE "name" = 'Messok' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1711' WHERE "name" = 'Mindourou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1712' WHERE "name" = 'Ngoyla' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1713' WHERE "name" = 'Nguelemendouka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1714' WHERE "name" = 'Somalomo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1801' WHERE "name" = 'Batouri' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '1802' WHERE "name" = 'Bombé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '1803' WHERE "name" = 'Kétté' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '1804' WHERE "name" = 'Mbang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '1805' WHERE "name" = 'Mbotoro' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '1806' WHERE "name" = 'Ndélélé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '1807' WHERE "name" = 'Ndem-Nam' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '1901' WHERE "name" = 'Belabo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem');
UPDATE "subdivisions" SET "code" = '1902' WHERE "name" = 'Bertoua 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem');
UPDATE "subdivisions" SET "code" = '1903' WHERE "name" = 'Bertoua 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem');
UPDATE "subdivisions" SET "code" = '1904' WHERE "name" = 'Bétaré-Oya' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem');
UPDATE "subdivisions" SET "code" = '1905' WHERE "name" = 'Diang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem');
UPDATE "subdivisions" SET "code" = '1906' WHERE "name" = 'Garoua-Boulaï' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem');
UPDATE "subdivisions" SET "code" = '1907' WHERE "name" = 'Mandjou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem');
UPDATE "subdivisions" SET "code" = '1908' WHERE "name" = 'Ngoura' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lom-et-Djérem');
UPDATE "subdivisions" SET "code" = '2001' WHERE "name" = 'Bogo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2002' WHERE "name" = 'Dargala' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2003' WHERE "name" = 'Gazawa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2004' WHERE "name" = 'Maroua 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2005' WHERE "name" = 'Maroua 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2006' WHERE "name" = 'Maroua 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2007' WHERE "name" = 'Méri' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2008' WHERE "name" = 'Ndoukoula' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2009' WHERE "name" = 'Petté' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Diamaré');
UPDATE "subdivisions" SET "code" = '2101' WHERE "name" = 'Blangoua' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2102' WHERE "name" = 'Darak' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2103' WHERE "name" = 'Fotokol' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2104' WHERE "name" = 'Goulfey' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2105' WHERE "name" = 'Hile-Halifa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2106' WHERE "name" = 'Kousseri' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2107' WHERE "name" = 'Logone-Birni' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2108' WHERE "name" = 'Makary' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2109' WHERE "name" = 'Waza' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2110' WHERE "name" = 'Zina' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Logone-et-Chari');
UPDATE "subdivisions" SET "code" = '2201' WHERE "name" = 'Datchéka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2202' WHERE "name" = 'Gobo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2203' WHERE "name" = 'Guéré' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2204' WHERE "name" = 'Kai-Kai' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2205' WHERE "name" = 'Kalfou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2206' WHERE "name" = 'Kar-Hay' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2207' WHERE "name" = 'Maga' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2208' WHERE "name" = 'Tchatibali' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2209' WHERE "name" = 'Vélé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2210' WHERE "name" = 'Wina' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2211' WHERE "name" = 'Yagoua' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2301' WHERE "name" = 'Guidiguis' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2302' WHERE "name" = 'Kaélé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2303' WHERE "name" = 'Mindif' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2304' WHERE "name" = 'Moulvoudaye' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2305' WHERE "name" = 'Moutourwa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2306' WHERE "name" = 'Porhi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2307' WHERE "name" = 'Taibong' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2401' WHERE "name" = 'Kolofata' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Sava');
UPDATE "subdivisions" SET "code" = '2402' WHERE "name" = 'Mora' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Sava');
UPDATE "subdivisions" SET "code" = '2403' WHERE "name" = 'Tokombéré' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Sava');
UPDATE "subdivisions" SET "code" = '2501' WHERE "name" = 'Bourrha' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2502' WHERE "name" = 'Hina' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2503' WHERE "name" = 'Koza' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2504' WHERE "name" = 'Mayo-Moskota' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2505' WHERE "name" = 'Mogodé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2506' WHERE "name" = 'Mokolo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2507' WHERE "name" = 'Soulede-Roua' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2601' WHERE "name" = 'Baré-Bakem' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2602' WHERE "name" = 'Dibombari' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2603' WHERE "name" = 'Fiko' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2604' WHERE "name" = 'Loum' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2605' WHERE "name" = 'Manjo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2606' WHERE "name" = 'Mbanga' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2607' WHERE "name" = 'Melong' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2608' WHERE "name" = 'Mombo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2609' WHERE "name" = 'Njombé-Penja' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2610' WHERE "name" = 'Nkongsamba 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2611' WHERE "name" = 'Nkongsamba 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2612' WHERE "name" = 'Nkongsamba 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2613' WHERE "name" = 'Nlonako' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2701' WHERE "name" = 'Nkondjock' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nkam');
UPDATE "subdivisions" SET "code" = '2702' WHERE "name" = 'Nord-Makombe' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nkam');
UPDATE "subdivisions" SET "code" = '2703' WHERE "name" = 'Yabassi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nkam');
UPDATE "subdivisions" SET "code" = '2704' WHERE "name" = 'Yingui' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nkam');
UPDATE "subdivisions" SET "code" = '2801' WHERE "name" = 'Dibamba' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2802' WHERE "name" = 'Dizangué' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2803' WHERE "name" = 'Edéa 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2804' WHERE "name" = 'Edéa 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2805' WHERE "name" = 'Massock-Songloulou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2806' WHERE "name" = 'Mouanko' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2807' WHERE "name" = 'Ndom' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2808' WHERE "name" = 'Ngambé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2809' WHERE "name" = 'Ngwei' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2810' WHERE "name" = 'Nyanon' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2811' WHERE "name" = 'Pouma' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Sanaga-Maritime');
UPDATE "subdivisions" SET "code" = '2901' WHERE "name" = 'Douala 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Wouri');
UPDATE "subdivisions" SET "code" = '2902' WHERE "name" = 'Douala 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Wouri');
UPDATE "subdivisions" SET "code" = '2903' WHERE "name" = 'Douala 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Wouri');
UPDATE "subdivisions" SET "code" = '2904' WHERE "name" = 'Douala 4' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Wouri');
UPDATE "subdivisions" SET "code" = '2905' WHERE "name" = 'Douala 5' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Wouri');
UPDATE "subdivisions" SET "code" = '2906' WHERE "name" = 'Douala 6' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Wouri');
UPDATE "subdivisions" SET "code" = '3001' WHERE "name" = 'Baschéo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3002' WHERE "name" = 'Bibemi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3003' WHERE "name" = 'Dembo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3004' WHERE "name" = 'Demsa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3005' WHERE "name" = 'Garoua 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3006' WHERE "name" = 'Garoua 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3007' WHERE "name" = 'Garoua 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3008' WHERE "name" = 'Lagdo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3009' WHERE "name" = 'Mayo-Hourna' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3010' WHERE "name" = 'Pitoa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3011' WHERE "name" = 'Tcheboa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3012' WHERE "name" = 'Touroua' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3101' WHERE "name" = 'Béka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Faro');
UPDATE "subdivisions" SET "code" = '3102' WHERE "name" = 'Poli' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Faro');
UPDATE "subdivisions" SET "code" = '3201' WHERE "name" = 'Figuil' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Louti');
UPDATE "subdivisions" SET "code" = '3202' WHERE "name" = 'Guider' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Louti');
UPDATE "subdivisions" SET "code" = '3203' WHERE "name" = 'Mayo-Oulo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Louti');
UPDATE "subdivisions" SET "code" = '3301' WHERE "name" = 'Madingring' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Rey');
UPDATE "subdivisions" SET "code" = '3302' WHERE "name" = 'Rey-Bouba' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Rey');
UPDATE "subdivisions" SET "code" = '3303' WHERE "name" = 'Tcholliré' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Rey');
UPDATE "subdivisions" SET "code" = '3304' WHERE "name" = 'Touboro' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Rey');
UPDATE "subdivisions" SET "code" = '3401' WHERE "name" = 'Belo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boyo');
UPDATE "subdivisions" SET "code" = '3402' WHERE "name" = 'Bum' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boyo');
UPDATE "subdivisions" SET "code" = '3403' WHERE "name" = 'Fundong' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boyo');
UPDATE "subdivisions" SET "code" = '3404' WHERE "name" = 'Njinikom' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boyo');
UPDATE "subdivisions" SET "code" = '3501' WHERE "name" = 'Jakiri' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bui');
UPDATE "subdivisions" SET "code" = '3502' WHERE "name" = 'Kumbo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bui');
UPDATE "subdivisions" SET "code" = '3503' WHERE "name" = 'Mbven' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bui');
UPDATE "subdivisions" SET "code" = '3504' WHERE "name" = 'Nkum' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bui');
UPDATE "subdivisions" SET "code" = '3505' WHERE "name" = 'Noni' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bui');
UPDATE "subdivisions" SET "code" = '3506' WHERE "name" = 'Oku' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bui');
UPDATE "subdivisions" SET "code" = '3601' WHERE "name" = 'Ako' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Donga-Mantung');
UPDATE "subdivisions" SET "code" = '3602' WHERE "name" = 'Misaje' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Donga-Mantung');
UPDATE "subdivisions" SET "code" = '3603' WHERE "name" = 'Ndu' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Donga-Mantung');
UPDATE "subdivisions" SET "code" = '3604' WHERE "name" = 'Nkambe' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Donga-Mantung');
UPDATE "subdivisions" SET "code" = '3605' WHERE "name" = 'Nwa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Donga-Mantung');
UPDATE "subdivisions" SET "code" = '3701' WHERE "name" = 'Fungom' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menchum');
UPDATE "subdivisions" SET "code" = '3702' WHERE "name" = 'Furu-Awa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menchum');
UPDATE "subdivisions" SET "code" = '3703' WHERE "name" = 'Menchum-Valley' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menchum');
UPDATE "subdivisions" SET "code" = '3704' WHERE "name" = 'Wum' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menchum');
UPDATE "subdivisions" SET "code" = '3801' WHERE "name" = 'Bafut' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mezam');
UPDATE "subdivisions" SET "code" = '3802' WHERE "name" = 'Bali' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mezam');
UPDATE "subdivisions" SET "code" = '3803' WHERE "name" = 'Bamenda 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mezam');
UPDATE "subdivisions" SET "code" = '3804' WHERE "name" = 'Bamenda 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mezam');
UPDATE "subdivisions" SET "code" = '3805' WHERE "name" = 'Bamenda 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mezam');
UPDATE "subdivisions" SET "code" = '3806' WHERE "name" = 'Santa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mezam');
UPDATE "subdivisions" SET "code" = '3807' WHERE "name" = 'Tubah' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mezam');
UPDATE "subdivisions" SET "code" = '3901' WHERE "name" = 'Batibo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Momo');
UPDATE "subdivisions" SET "code" = '3902' WHERE "name" = 'Mbengwi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Momo');
UPDATE "subdivisions" SET "code" = '3903' WHERE "name" = 'Ngie' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Momo');
UPDATE "subdivisions" SET "code" = '3904' WHERE "name" = 'Njikwa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Momo');
UPDATE "subdivisions" SET "code" = '3905' WHERE "name" = 'Widikum-Menka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Momo');
UPDATE "subdivisions" SET "code" = '4001' WHERE "name" = 'Babessi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ngo-Ketunjia');
UPDATE "subdivisions" SET "code" = '4002' WHERE "name" = 'Balikumbat' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ngo-Ketunjia');
UPDATE "subdivisions" SET "code" = '4003' WHERE "name" = 'Ndop' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ngo-Ketunjia');
UPDATE "subdivisions" SET "code" = '4101' WHERE "name" = 'Babadjou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bamboutos');
UPDATE "subdivisions" SET "code" = '4102' WHERE "name" = 'Batcham' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bamboutos');
UPDATE "subdivisions" SET "code" = '4103' WHERE "name" = 'Galim' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bamboutos');
UPDATE "subdivisions" SET "code" = '4104' WHERE "name" = 'Mbouda' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bamboutos');
UPDATE "subdivisions" SET "code" = '4201' WHERE "name" = 'Bafang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nkam');
UPDATE "subdivisions" SET "code" = '4202' WHERE "name" = 'Bakou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nkam');
UPDATE "subdivisions" SET "code" = '4203' WHERE "name" = 'Bana' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nkam');
UPDATE "subdivisions" SET "code" = '4204' WHERE "name" = 'Bandja' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nkam');
UPDATE "subdivisions" SET "code" = '4205' WHERE "name" = 'Banka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nkam');
UPDATE "subdivisions" SET "code" = '4206' WHERE "name" = 'Banwa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nkam');
UPDATE "subdivisions" SET "code" = '4207' WHERE "name" = 'Kékem' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nkam');
UPDATE "subdivisions" SET "code" = '4301' WHERE "name" = 'Baham' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Hauts-Plateaux');
UPDATE "subdivisions" SET "code" = '4302' WHERE "name" = 'Bamendjou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Hauts-Plateaux');
UPDATE "subdivisions" SET "code" = '4303' WHERE "name" = 'Bangou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Hauts-Plateaux');
UPDATE "subdivisions" SET "code" = '4304' WHERE "name" = 'Batié' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Hauts-Plateaux');
UPDATE "subdivisions" SET "code" = '4401' WHERE "name" = 'Bayangam' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Koung-Khi');
UPDATE "subdivisions" SET "code" = '4402' WHERE "name" = 'Djebem' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Koung-Khi');
UPDATE "subdivisions" SET "code" = '4403' WHERE "name" = 'Poumougne' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Koung-Khi');
UPDATE "subdivisions" SET "code" = '4501' WHERE "name" = 'Dschang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menoua');
UPDATE "subdivisions" SET "code" = '4502' WHERE "name" = 'Fokoué' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menoua');
UPDATE "subdivisions" SET "code" = '4503' WHERE "name" = 'Fongo-Tongo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menoua');
UPDATE "subdivisions" SET "code" = '4504' WHERE "name" = 'Nkong-Ni' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menoua');
UPDATE "subdivisions" SET "code" = '4505' WHERE "name" = 'Penka-Michel' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menoua');
UPDATE "subdivisions" SET "code" = '4506' WHERE "name" = 'Santchou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menoua');
UPDATE "subdivisions" SET "code" = '4601' WHERE "name" = 'Bafoussam 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mifi');
UPDATE "subdivisions" SET "code" = '4602' WHERE "name" = 'Bafoussam 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mifi');
UPDATE "subdivisions" SET "code" = '4603' WHERE "name" = 'Bafoussam 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mifi');
UPDATE "subdivisions" SET "code" = '4701' WHERE "name" = 'Bangangté' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndé');
UPDATE "subdivisions" SET "code" = '4702' WHERE "name" = 'Bassamba' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndé');
UPDATE "subdivisions" SET "code" = '4703' WHERE "name" = 'Bazou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndé');
UPDATE "subdivisions" SET "code" = '4704' WHERE "name" = 'Tonga' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndé');
UPDATE "subdivisions" SET "code" = '4801' WHERE "name" = 'Bangourain' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4802' WHERE "name" = 'Foumban' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4803' WHERE "name" = 'Foumbot' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4804' WHERE "name" = 'Kouoptamo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4805' WHERE "name" = 'Koutaba' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4806' WHERE "name" = 'Magba' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4807' WHERE "name" = 'Malentouen' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4808' WHERE "name" = 'Massangam' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4809' WHERE "name" = 'Njimom' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Noun');
UPDATE "subdivisions" SET "code" = '4901' WHERE "name" = 'Bengbis' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "code" = '4902' WHERE "name" = 'Djoum' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "code" = '4903' WHERE "name" = 'Meyomessala' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "code" = '4904' WHERE "name" = 'Meyomessi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "code" = '4905' WHERE "name" = 'Mintom' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "code" = '4906' WHERE "name" = 'Oveng' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "code" = '4907' WHERE "name" = 'Sangmelima' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "code" = '4908' WHERE "name" = 'Zoétélé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Dja-et-Lobo');
UPDATE "subdivisions" SET "code" = '5001' WHERE "name" = 'Biwong-Bane' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "code" = '5002' WHERE "name" = 'Biwong-Bulu' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "code" = '5003' WHERE "name" = 'Ebolowa 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "code" = '5004' WHERE "name" = 'Ebolowa 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "code" = '5005' WHERE "name" = 'Efoulan' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "code" = '5006' WHERE "name" = 'Mengong' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "code" = '5007' WHERE "name" = 'Mvangan' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "code" = '5008' WHERE "name" = 'Ngoulemakong' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mvila');
UPDATE "subdivisions" SET "code" = '5101' WHERE "name" = 'Akom II' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5102' WHERE "name" = 'Bipindi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5103' WHERE "name" = 'Campo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5104' WHERE "name" = 'Kribi 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5105' WHERE "name" = 'Kribi 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5106' WHERE "name" = 'Lokoundje' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5107' WHERE "name" = 'Lolodorf' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5108' WHERE "name" = 'Mvengue' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5109' WHERE "name" = 'Niété' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5201' WHERE "name" = 'Ambam' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem');
UPDATE "subdivisions" SET "code" = '5202' WHERE "name" = 'Kyé-Ossi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem');
UPDATE "subdivisions" SET "code" = '5203' WHERE "name" = 'Ma''an' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem');
UPDATE "subdivisions" SET "code" = '5204' WHERE "name" = 'Olamzé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem');
UPDATE "subdivisions" SET "code" = '5301' WHERE "name" = 'Buea' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Fako');
UPDATE "subdivisions" SET "code" = '5302' WHERE "name" = 'Limbe 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Fako');
UPDATE "subdivisions" SET "code" = '5303' WHERE "name" = 'Limbe 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Fako');
UPDATE "subdivisions" SET "code" = '5304' WHERE "name" = 'Limbe 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Fako');
UPDATE "subdivisions" SET "code" = '5305' WHERE "name" = 'Muyuka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Fako');
UPDATE "subdivisions" SET "code" = '5306' WHERE "name" = 'Tiko' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Fako');
UPDATE "subdivisions" SET "code" = '5307' WHERE "name" = 'West-Coast' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Fako');
UPDATE "subdivisions" SET "code" = '5401' WHERE "name" = 'Bangem' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kupe-Manenguba');
UPDATE "subdivisions" SET "code" = '5402' WHERE "name" = 'Nguti' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kupe-Manenguba');
UPDATE "subdivisions" SET "code" = '5403' WHERE "name" = 'Tombel' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kupe-Manenguba');
UPDATE "subdivisions" SET "code" = '5501' WHERE "name" = 'Alou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lebialem');
UPDATE "subdivisions" SET "code" = '5502' WHERE "name" = 'Fontem' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lebialem');
UPDATE "subdivisions" SET "code" = '5503' WHERE "name" = 'Wabane' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Lebialem');
UPDATE "subdivisions" SET "code" = '5601' WHERE "name" = 'Akwaya' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Manyu');
UPDATE "subdivisions" SET "code" = '5602' WHERE "name" = 'Eyumodjock' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Manyu');
UPDATE "subdivisions" SET "code" = '5603' WHERE "name" = 'Mamfe' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Manyu');
UPDATE "subdivisions" SET "code" = '5604' WHERE "name" = 'Upper-Bayang' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Manyu');
UPDATE "subdivisions" SET "code" = '5701' WHERE "name" = 'Konye' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Meme');
UPDATE "subdivisions" SET "code" = '5702' WHERE "name" = 'Kumba 1' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Meme');
UPDATE "subdivisions" SET "code" = '5703' WHERE "name" = 'Kumba 2' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Meme');
UPDATE "subdivisions" SET "code" = '5704' WHERE "name" = 'Kumba 3' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Meme');
UPDATE "subdivisions" SET "code" = '5705' WHERE "name" = 'Mbonge' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Meme');
UPDATE "subdivisions" SET "code" = '5801' WHERE "name" = 'Bamusso' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');
UPDATE "subdivisions" SET "code" = '5802' WHERE "name" = 'Dikome-Balue' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');
UPDATE "subdivisions" SET "code" = '5803' WHERE "name" = 'Ekondo Titi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');
UPDATE "subdivisions" SET "code" = '5804' WHERE "name" = 'Idabato' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');
UPDATE "subdivisions" SET "code" = '5805' WHERE "name" = 'Isangele' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');
UPDATE "subdivisions" SET "code" = '5806' WHERE "name" = 'Kombo-Abedimo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');
UPDATE "subdivisions" SET "code" = '5807' WHERE "name" = 'Kombo-Itindi' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');
UPDATE "subdivisions" SET "code" = '5808' WHERE "name" = 'Mundemba' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');
UPDATE "subdivisions" SET "code" = '5809' WHERE "name" = 'Toko' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Ndian');

-- 6b. Pending Subdivisions (29 rows left in place, assigned next free sequential code)
UPDATE "subdivisions" SET "code" = '0103' WHERE "name" = 'Mbakaou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Djérem');
UPDATE "subdivisions" SET "code" = '0405' WHERE "name" = 'Gonmé' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbéré');
UPDATE "subdivisions" SET "code" = '0509' WHERE "name" = 'Meidougou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vina');
UPDATE "subdivisions" SET "code" = '0810' WHERE "name" = 'Koro' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mbam-et-Inoubou');
UPDATE "subdivisions" SET "code" = '1406' WHERE "name" = 'Kobdombo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Mfoumou');
UPDATE "subdivisions" SET "code" = '1407' WHERE "name" = 'Menomale' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Nyong-et-Mfoumou');
UPDATE "subdivisions" SET "code" = '1715' WHERE "name" = 'Angossas' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1716' WHERE "name" = 'Atok' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1717' WHERE "name" = 'Dimako' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Haut-Nyong');
UPDATE "subdivisions" SET "code" = '1808' WHERE "name" = 'Nguelebok' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '1809' WHERE "name" = 'Ouli' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Kadey');
UPDATE "subdivisions" SET "code" = '2212' WHERE "name" = 'Moulouvaye' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Danay');
UPDATE "subdivisions" SET "code" = '2308' WHERE "name" = 'Tchanaga' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2309' WHERE "name" = 'Toulourou' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Kani');
UPDATE "subdivisions" SET "code" = '2404' WHERE "name" = 'Limani' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Sava');
UPDATE "subdivisions" SET "code" = '2508' WHERE "name" = 'Mozogo' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2509' WHERE "name" = 'Roua' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Tsanaga');
UPDATE "subdivisions" SET "code" = '2614' WHERE "name" = 'Bonalea' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2615' WHERE "name" = 'Ekom' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Moungo');
UPDATE "subdivisions" SET "code" = '2907' WHERE "name" = 'Manoka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Wouri');
UPDATE "subdivisions" SET "code" = '3013' WHERE "name" = 'Ngong' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Bénoué');
UPDATE "subdivisions" SET "code" = '3305' WHERE "name" = 'Pignde' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Mayo-Rey');
UPDATE "subdivisions" SET "code" = '3405' WHERE "name" = 'Fonfuka' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Boyo');
UPDATE "subdivisions" SET "code" = '3705' WHERE "name" = 'Benakuma' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menchum');
UPDATE "subdivisions" SET "code" = '3706' WHERE "name" = 'Zhoa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Menchum');
UPDATE "subdivisions" SET "code" = '4305' WHERE "name" = 'Bansoa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Hauts-Plateaux');
UPDATE "subdivisions" SET "code" = '5110' WHERE "name" = 'Grand Batanga' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Océan');
UPDATE "subdivisions" SET "code" = '5205' WHERE "name" = 'Nkpwa' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Vallée-du-Ntem');
UPDATE "subdivisions" SET "code" = '5605' WHERE "name" = 'Tinto' AND "departmentId" = (SELECT id FROM "departments" WHERE "name" = 'Manyu');

-- =============================================================================
-- 7. Synchronize test company establishment IDs and submission drafts
--    Rewrites submission_drafts.establishmentId when the test company establishment code changes
-- =============================================================================
-- Rewrite submission_drafts.establishmentId (13-character code, e.g. EN26000100-01)
UPDATE "submission_drafts" sd
SET "establishmentId" = SUBSTRING(c."establishmentId", 1, LENGTH(c."establishmentId") - 2) || RIGHT(s."code", 2) || '-01'
FROM "companies" c
JOIN "subdivisions" s ON s.id = c."subdivisionId"
JOIN "establishments" e ON e."companyId" = c.id AND e."isPrincipal" = true
WHERE sd."establishmentId" = e."code"
  AND c."establishmentId" IS NOT NULL
  AND LENGTH(c."establishmentId") >= 10
  AND RIGHT(c."establishmentId", 2) <> RIGHT(s."code", 2);

-- Update companies establishmentId
UPDATE "companies" c
SET "establishmentId" = SUBSTRING(c."establishmentId", 1, LENGTH(c."establishmentId") - 2) || RIGHT(s."code", 2)
FROM "subdivisions" s
WHERE c."subdivisionId" = s.id
  AND c."establishmentId" IS NOT NULL
  AND LENGTH(c."establishmentId") >= 10
  AND RIGHT(c."establishmentId", 2) <> RIGHT(s."code", 2);

-- Update principal establishments code
UPDATE "establishments" e
SET "code" = c."establishmentId" || '-01'
FROM "companies" c
WHERE e."companyId" = c.id
  AND e."isPrincipal" = true
  AND c."establishmentId" IS NOT NULL
  AND e."code" <> (c."establishmentId" || '-01');

COMMIT;
