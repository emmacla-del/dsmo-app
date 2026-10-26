-- Who approved an account, beside approvedAt.
--
-- Until 2026-10-26 one answer fitted every row: the national administration,
-- the only authority that could approve a staff account. From that date a
-- territory's delegate approves its staff, and either the delegate or a
-- non-delegate admin of the territory may approve an entity -- whichever
-- acts first -- with national as fallback at every tier. The approver is
-- therefore no longer derivable from anything stored, which is why it is
-- recorded.
--
-- Additive and nullable, like createdBy and assigneeId above it, with the
-- same self-referencing foreign key and ON DELETE SET NULL, so removing an
-- approver's account never removes the approval it granted. No backfill: an
-- account approved before today reads NULL, which says truthfully that the
-- platform did not record who acted, rather than naming someone it has not
-- verified.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;

CREATE INDEX IF NOT EXISTS "users_approvedBy_idx" ON "users"("approvedBy");

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_approvedBy_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
