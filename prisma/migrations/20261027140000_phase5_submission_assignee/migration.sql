-- Phase 5 team workflow: a submission's review owner.
--
-- The registration queue has carried an assignee since the B1 rebuild
-- (users.assigneeId); the dossier queue had none, so two officers reading the
-- same pending file could not say who was handling it. This column records the
-- administrative owner of a file's review, beside the file's own reviewer.
--
-- Additive and nullable: every row written before today reads NULL, which
-- means unclaimed. Nothing is rewritten, and no statistical variable, export,
-- PDF or dataset version changes -- this is administrative routing, not
-- questionnaire data.
--
-- ON DELETE SET NULL, like archivedBy on the same table, so removing an
-- officer's account never removes the file itself.
ALTER TABLE "onefop_submissions" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;

CREATE INDEX IF NOT EXISTS "onefop_submissions_assigneeId_idx" ON "onefop_submissions"("assigneeId");

ALTER TABLE "onefop_submissions" DROP CONSTRAINT IF EXISTS "onefop_submissions_assigneeId_fkey";
ALTER TABLE "onefop_submissions" ADD CONSTRAINT "onefop_submissions_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
