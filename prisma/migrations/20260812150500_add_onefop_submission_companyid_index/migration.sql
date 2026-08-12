-- CreateIndex
-- OnefopSubmission had 8 secondary indexes but none on companyId, despite
-- it being the FK every company-scoped query (getSubmissions,
-- assertCanAccessSubmission, the write-IDOR fix in
-- QuestionnairesService.submitQuestionnaire) filters or joins on.
CREATE INDEX IF NOT EXISTS "idx_onefop_submissions_companyId" ON "onefop_submissions"("companyId");
