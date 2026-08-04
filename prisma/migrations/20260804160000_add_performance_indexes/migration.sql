-- CreateIndex
-- These indexes back real WHERE/ORDER BY clauses in the app (see
-- DsmoService, ValidationService, NotificationService, auth.service.ts) on
-- tables that previously had no index beyond their primary key. Declaration
-- in particular had zero secondary indexes despite being filtered by
-- companyId/year/status on every DSMO declaration submission.
--
-- CONCURRENTLY avoids taking a table-level write lock while the index is
-- built, so existing traffic against these tables isn't blocked during
-- deploy. Prisma Migrate detects CONCURRENTLY and runs this file outside a
-- transaction automatically — do not wrap these statements in BEGIN/COMMIT.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "declarations_companyId_year_status_idx" ON "declarations"("companyId", "year", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "declarations_status_idx" ON "declarations"("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "declarations_region_idx" ON "declarations"("region");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "declarations_division_idx" ON "declarations"("division");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "declarations_year_idx" ON "declarations"("year");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "declarations_createdAt_idx" ON "declarations"("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "declarations_submittedAt_idx" ON "declarations"("submittedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "employees_declarationId_idx" ON "employees"("declarationId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "declaration_movements_declarationId_idx" ON "declaration_movements"("declarationId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "validation_steps_declarationId_idx" ON "validation_steps"("declarationId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "qualitative_questions_declarationId_idx" ON "qualitative_questions"("declarationId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_regionFilter_idx" ON "notifications"("regionFilter");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_sentAt_idx" ON "notifications"("sentAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_recipients_notificationId_idx" ON "notification_recipients"("notificationId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_recipients_companyId_idx" ON "notification_recipients"("companyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_status_idx" ON "users"("status");
