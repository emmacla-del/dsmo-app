-- The owner confirmed that ONEFOP reports through the Secrétariat Général,
-- and that its statistics chief is a CHEF_SERVICE position on ONEFOP itself.
UPDATE "minefop_services"
SET "parentCode" = 'SG',
    "level" = 2,
    "orderIndex" = 43,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'ONEFOP';

INSERT INTO "service_positions"
  ("id", "serviceCode", "positionType", "title", "titleEn", "level", "orderIndex", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'ONEFOP', 'DIRECTEUR', 'Secrétaire Permanent', 'Permanent Secretary', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ONEFOP', 'CHEF_SERVICE', 'Chef du Service des Statistiques', 'Head of Statistics Service', 1, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceCode", "positionType") DO UPDATE
SET "title" = EXCLUDED."title",
    "titleEn" = EXCLUDED."titleEn",
    "level" = EXCLUDED."level",
    "orderIndex" = EXCLUDED."orderIndex",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;
