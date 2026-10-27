-- Add the actor attribution for rejected User registrations.
-- The inverse relation keeps the rejectedBy reference navigable in Prisma.
ALTER TABLE "users" ADD COLUMN "rejectedBy" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_rejectedBy_fkey"
  FOREIGN KEY ("rejectedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Rollback: ALTER TABLE "users" DROP CONSTRAINT "users_rejectedBy_fkey";
--           ALTER TABLE "users" DROP COLUMN "rejectedBy";
