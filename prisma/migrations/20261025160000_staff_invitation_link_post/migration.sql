-- A group invitation link can carry the post it is for.
--
-- The administrator who creates the link fixes the service and the position
-- type; the officer who opens it confirms that post instead of finding their
-- own service in a 126-node organigramme. Plain TEXT, like "region" and
-- "department" on the same table, which are not foreign keys either: the
-- service is validated against the organigramme when the link is made
-- (assertServiceInScope), not by a constraint here.
--
-- Additive and nullable. Every link created before today keeps both NULL,
-- which means what it has always meant -- the officer chooses service and
-- post -- so no row is rewritten and no live link changes behaviour. That
-- fallback is permanent, not a transition: whether a NEW link may still be
-- made without a post is enforced at creation, never by migrating old rows.
ALTER TABLE "staff_invitation_links" ADD COLUMN IF NOT EXISTS "serviceCode" TEXT;
ALTER TABLE "staff_invitation_links" ADD COLUMN IF NOT EXISTS "positionType" TEXT;
