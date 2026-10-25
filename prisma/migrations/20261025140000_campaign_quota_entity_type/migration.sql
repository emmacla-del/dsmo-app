-- Registration quotas gain an entity-type dimension, at region x type.
--
-- Additive and nullable: every existing row keeps entityType NULL, which
-- means "this quota covers every entity type" -- the only thing a quota
-- could have meant before today. No row is rewritten and no figure moves.
--
-- Region level only. A row carrying both a departmentId and an entityType is
-- refused by parseTargetBody rather than by a constraint here, because the
-- grain is a product decision that may widen to department x type later;
-- a CHECK would have to be dropped and rewritten to allow it.
ALTER TABLE "campaign_quotas" ADD COLUMN IF NOT EXISTS "entityType" "OnefopEntityType";

CREATE INDEX IF NOT EXISTS "campaign_quotas_entityType_idx" ON "campaign_quotas"("entityType");
