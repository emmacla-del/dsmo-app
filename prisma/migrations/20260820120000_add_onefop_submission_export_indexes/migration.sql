-- CreateIndex
-- The SPSS/Excel bulk-export filters (DataManagementService.exportSubmissions
-- / exportSubmissionsSpss) accept region, department, surveyYear and a
-- createdAt date range. Every other filter column already had an index;
-- department and createdAt didn't, forcing a sequential scan of the whole
-- onefop_submissions table for those two filters as the table grows across
-- campaign cycles.
CREATE INDEX IF NOT EXISTS "OnefopSubmission_department_idx" ON "onefop_submissions"("department");
CREATE INDEX IF NOT EXISTS "OnefopSubmission_createdAt_idx" ON "onefop_submissions"("createdAt");
