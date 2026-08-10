-- CreateIndex
-- These indexes back real WHERE/ORDER BY clauses in the app (see
-- DsmoService, ValidationService, NotificationService, auth.service.ts) on
-- tables that previously had no index beyond their primary key. Declaration
-- in particular had zero secondary indexes despite being filtered by
-- companyId/year/status on every DSMO declaration submission.
--
-- Originally written with CONCURRENTLY to avoid a table-level write lock
-- during deploy, but Prisma only runs a migration file outside a
-- transaction when it contains a single statement — with 16 statements in
-- one file, it got wrapped in a transaction anyway and every CONCURRENTLY
-- statement is rejected outright by Postgres in that context (error
-- 25001). Dropped CONCURRENTLY rather than splitting into 16 files;
-- these are small/low-traffic tables, so the brief lock during a plain
-- CREATE INDEX is an acceptable trade for keeping this as one file.
CREATE INDEX IF NOT EXISTS "declarations_companyId_year_status_idx" ON "declarations"("companyId", "year", "status");
CREATE INDEX IF NOT EXISTS "declarations_status_idx" ON "declarations"("status");
CREATE INDEX IF NOT EXISTS "declarations_region_idx" ON "declarations"("region");
CREATE INDEX IF NOT EXISTS "declarations_division_idx" ON "declarations"("division");
CREATE INDEX IF NOT EXISTS "declarations_year_idx" ON "declarations"("year");
CREATE INDEX IF NOT EXISTS "declarations_createdAt_idx" ON "declarations"("createdAt");
CREATE INDEX IF NOT EXISTS "declarations_submittedAt_idx" ON "declarations"("submittedAt");

CREATE INDEX IF NOT EXISTS "employees_declarationId_idx" ON "employees"("declarationId");
CREATE INDEX IF NOT EXISTS "declaration_movements_declarationId_idx" ON "declaration_movements"("declarationId");
CREATE INDEX IF NOT EXISTS "validation_steps_declarationId_idx" ON "validation_steps"("declarationId");
CREATE INDEX IF NOT EXISTS "qualitative_questions_declarationId_idx" ON "qualitative_questions"("declarationId");

CREATE INDEX IF NOT EXISTS "notifications_regionFilter_idx" ON "notifications"("regionFilter");
CREATE INDEX IF NOT EXISTS "notifications_sentAt_idx" ON "notifications"("sentAt");
CREATE INDEX IF NOT EXISTS "notification_recipients_notificationId_idx" ON "notification_recipients"("notificationId");
CREATE INDEX IF NOT EXISTS "notification_recipients_companyId_idx" ON "notification_recipients"("companyId");

CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");
