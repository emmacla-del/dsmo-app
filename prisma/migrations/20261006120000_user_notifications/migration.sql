-- In-app notifications (Phase 3 of docs/plans/territorial-admin-monitoring.md).
--
-- One row per notification addressed to ONE user, with read state. Distinct
-- from the existing `notifications` table, which is an outbound-email audit
-- log: per-campaign rather than per-user, no inbox, no read state. Email
-- delivery is unreliable on this deployment, so the in-app inbox is the
-- channel rather than a fallback.
--
-- `kind` is text, not an enum: DECISION 3 ships NUDGE alone, and adding
-- APPROVAL / REJECTION / ASSIGNMENT later must not need a migration.
--
-- Hand-written, following the convention of the 54 existing migrations in
-- this directory (prisma migrate dev is not used here). Apply in the Supabase
-- SQL Editor, then record it with:
--   npx prisma migrate resolve --applied 20261006120000_user_notifications

CREATE TABLE "user_notifications" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "kind"      TEXT NOT NULL,
    "subject"   TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "linkHref"  TEXT,
    "readAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- The unread-badge query (userId + readAt IS NULL) and the inbox listing
-- (userId, newest first). Both are always scoped by userId, so userId leads
-- both indexes.
CREATE INDEX "user_notifications_userId_readAt_idx" ON "user_notifications" ("userId", "readAt");
CREATE INDEX "user_notifications_userId_createdAt_idx" ON "user_notifications" ("userId", "createdAt");

-- CASCADE: a notification has no meaning without its recipient, and deleting
-- a user must not be blocked by its inbox.
ALTER TABLE "user_notifications"
    ADD CONSTRAINT "user_notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
